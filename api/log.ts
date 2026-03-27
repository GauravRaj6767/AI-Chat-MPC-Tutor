import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const {
    subject, questionPreview, hasImage,
    inputTokens, outputTokens, totalTokens,
    inputCostUsd, outputCostUsd, totalCostUsd, model,
  } = req.body ?? {};

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[log] Missing Supabase credentials");
    return res.status(500).json({ error: "Supabase not configured" });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await supabase.from("ai_chat_mpc_sessions").insert({
      subject: subject ?? "unknown",
      question_preview: questionPreview ?? "",
      has_image: Boolean(hasImage),
      input_tokens: inputTokens ?? 0,
      output_tokens: outputTokens ?? 0,
      total_tokens: totalTokens ?? 0,
      input_cost_usd: inputCostUsd ?? 0,
      output_cost_usd: outputCostUsd ?? 0,
      total_cost_usd: totalCostUsd ?? 0,
      model: model ?? "unknown",
    });

    if (error) {
      console.error("[log] Supabase insert error:", error.message, "| code:", error.code);
      return res.status(500).json({ error: error.message });
    }

    console.log(`[log] Logged: ${totalTokens} tokens | $${Number(totalCostUsd).toFixed(6)} | ${subject}`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[log] Unexpected error:", msg);
    return res.status(500).json({ error: msg });
  }
}
