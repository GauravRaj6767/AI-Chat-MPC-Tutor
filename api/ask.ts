import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const SYSTEM_PROMPT =
  "You are an expert JEE tutor. Solve problems step-by-step with clear explanations. For maths show all working. For physics explain concepts and formulas used. For chemistry explain reactions and mechanisms. Use markdown formatting.";

const MODEL_ID = "gemini-2.5-pro";

// Gemini 2.5 Pro pricing (as of March 2026, Google AI Developer API)
// Source: https://ai.google.dev/gemini-api/docs/pricing
// Tiered input pricing based on prompt length:
//   <= 200K tokens: $1.25 / 1M input tokens
//   > 200K tokens:  $2.50 / 1M input tokens
// Output tokens (includes thinking tokens): $10.00 / 1M tokens
const INPUT_COST_STANDARD = 1.25;   // per 1M, for prompts ≤ 200K tokens
const INPUT_COST_LONG = 2.50;       // per 1M, for prompts > 200K tokens
const OUTPUT_COST_PER_MILLION = 10.0; // per 1M (thinking tokens billed same rate)

const TOKEN_TIER_THRESHOLD = 200_000;

function calcCost(
  inputTokens: number,
  outputTokens: number,
): { inputCost: number; outputCost: number; totalCost: number } {
  const inputRate = inputTokens > TOKEN_TIER_THRESHOLD
    ? INPUT_COST_LONG
    : INPUT_COST_STANDARD;
  const inputCost = (inputTokens / 1_000_000) * inputRate;
  const outputCost = (outputTokens / 1_000_000) * OUTPUT_COST_PER_MILLION;
  return { inputCost, outputCost, totalCost: inputCost + outputCost };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { subject, question, imageBase64, imageMimeType, history } = req.body ?? {};

  if (!question || typeof question !== "string") {
    return res.status(400).json({ error: "question is required" });
  }

  // history is an array of { role: "user" | "ai", text: string }
  const chatHistory: Array<{ role: "user" | "ai"; text: string }> =
    Array.isArray(history) ? history : [];

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey || geminiKey === "ADD_YOUR_GEMINI_KEY_HERE") {
    return res
      .status(500)
      .json({ error: "Gemini API key not configured on server" });
  }

  try {
    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL_ID,
      systemInstruction: SYSTEM_PROMPT,
    });

    // Convert history to Gemini's Content format
    // Gemini uses "user" and "model" roles (not "ai")
    const geminiHistory = chatHistory.map((m) => ({
      role: m.role === "ai" ? "model" : "user",
      parts: [{ text: m.text }],
    }));

    // Start a chat session with prior context
    const chat = model.startChat({ history: geminiHistory });

    // Build the new message parts (text + optional image)
    const parts: Array<
      | { text: string }
      | { inlineData: { data: string; mimeType: string } }
    > = [{ text: question }];

    if (imageBase64 && imageMimeType) {
      parts.push({
        inlineData: { data: imageBase64, mimeType: imageMimeType },
      });
    }

    // Send the new message with full prior context
    const result = await chat.sendMessage(parts);
    const response = result.response;
    const answer = response.text();

    // Extract usage metadata
    const usageMetadata = response.usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = usageMetadata?.candidatesTokenCount ?? 0;
    const totalTokens = inputTokens + outputTokens;
    const { inputCost, outputCost, totalCost } = calcCost(
      inputTokens,
      outputTokens,
    );

    // Log to Supabase — runs in parallel, never blocks or breaks the response
    logToSupabase({
      subject: subject ?? "unknown",
      questionPreview: question.slice(0, 200),
      hasImage: Boolean(imageBase64),
      inputTokens,
      outputTokens,
      totalTokens,
      inputCostUsd: inputCost,
      outputCostUsd: outputCost,
      totalCostUsd: totalCost,
      model: MODEL_ID,
    }).then(() => {
      console.log(`[Supabase] Logged: ${totalTokens} tokens, $${totalCost.toFixed(6)}`);
    }).catch((err) => {
      console.error("[Supabase] Insert failed — check RLS policy or credentials:", err?.message ?? err);
    });

    return res.status(200).json({
      answer,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens,
        inputCostUsd: inputCost,
        outputCostUsd: outputCost,
        totalCostUsd: totalCost,
      },
    });
  } catch (err: unknown) {
    console.error("Gemini API error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to generate response";
    return res.status(500).json({ error: message });
  }
}

async function logToSupabase(data: {
  subject: string;
  questionPreview: string;
  hasImage: boolean;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
  model: string;
}): Promise<void> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn("Supabase credentials not configured, skipping logging.");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase.from("ai_chat_mpc_sessions").insert({
    subject: data.subject,
    question_preview: data.questionPreview,
    has_image: data.hasImage,
    input_tokens: data.inputTokens,
    output_tokens: data.outputTokens,
    total_tokens: data.totalTokens,
    input_cost_usd: data.inputCostUsd,
    output_cost_usd: data.outputCostUsd,
    total_cost_usd: data.totalCostUsd,
    model: data.model,
  });

  if (error) {
    throw new Error(`Supabase insert failed: ${error.message}`);
  }
}
