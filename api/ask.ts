import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT =
  "You are an expert JEE tutor. Solve problems step-by-step with clear explanations. For maths show all working. For physics explain concepts and formulas used. For chemistry explain reactions and mechanisms. Use markdown formatting.";

const MODEL_ID = "gemini-2.5-pro";

// Gemini 2.5 Pro pricing (as of March 2026, Google AI Developer API)
// Source: https://ai.google.dev/gemini-api/docs/pricing
// Tiered input pricing based on prompt length:
//   <= 200K tokens: $1.25 / 1M input tokens
//   > 200K tokens:  $2.50 / 1M input tokens
// Output tokens (includes thinking tokens): $10.00 / 1M tokens
const INPUT_COST_STANDARD = 1.25;
const INPUT_COST_LONG = 2.50;
const OUTPUT_COST_PER_MILLION = 10.0;
const TOKEN_TIER_THRESHOLD = 200_000;

function calcCost(inputTokens: number, outputTokens: number) {
  const inputRate = inputTokens > TOKEN_TIER_THRESHOLD ? INPUT_COST_LONG : INPUT_COST_STANDARD;
  const inputCost = (inputTokens / 1_000_000) * inputRate;
  const outputCost = (outputTokens / 1_000_000) * OUTPUT_COST_PER_MILLION;
  return { inputCost, outputCost, totalCost: inputCost + outputCost };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { subject, question, imageBase64, imageMimeType, history } = req.body ?? {};

  if (!question || typeof question !== "string") {
    return res.status(400).json({ error: "question is required" });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey || geminiKey === "ADD_YOUR_GEMINI_KEY_HERE") {
    return res.status(500).json({ error: "Gemini API key not configured" });
  }

  const chatHistory: Array<{ role: "user" | "ai"; text: string }> =
    Array.isArray(history) ? history : [];

  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_ID, systemInstruction: SYSTEM_PROMPT });

    // Convert history to Gemini format (role: "user" | "model")
    const geminiHistory = chatHistory.map((m) => ({
      role: m.role === "ai" ? "model" : "user",
      parts: [{ text: m.text }],
    }));

    const chat = model.startChat({ history: geminiHistory });

    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> =
      [{ text: question }];

    if (imageBase64 && imageMimeType) {
      parts.push({ inlineData: { data: imageBase64, mimeType: imageMimeType } });
    }

    const result = await chat.sendMessage(parts);
    const response = result.response;
    const answer = response.text();

    const usageMetadata = response.usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = usageMetadata?.candidatesTokenCount ?? 0;
    const totalTokens = inputTokens + outputTokens;
    const { inputCost, outputCost, totalCost } = calcCost(inputTokens, outputTokens);

    console.log(`[ask] ${subject} | ${totalTokens} tokens | $${totalCost.toFixed(6)}`);

    return res.status(200).json({
      answer,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens,
        inputCostUsd: inputCost,
        outputCostUsd: outputCost,
        totalCostUsd: totalCost,
        subject: subject ?? "unknown",
        questionPreview: question.slice(0, 200),
        hasImage: Boolean(imageBase64),
        model: MODEL_ID,
      },
    });
  } catch (err: unknown) {
    console.error("[ask] Gemini error:", err instanceof Error ? err.message : err);
    const message = err instanceof Error ? err.message : "Failed to generate response";
    return res.status(500).json({ error: message });
  }
}
