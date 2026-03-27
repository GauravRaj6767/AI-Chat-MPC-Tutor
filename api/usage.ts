import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[usage] Missing Supabase credentials");
    return res.status(500).json({ error: "Supabase not configured" });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Fetch recent sessions and monthly summary in parallel
    const [sessionsResult, monthlyResult] = await Promise.all([
      supabase
        .from("ai_chat_mpc_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("ai_chat_mpc_monthly_summary")
        .select("*")
        .order("month", { ascending: false }),
    ]);

    if (sessionsResult.error) {
      console.error("[usage] Sessions fetch error:", sessionsResult.error.message);
      return res.status(500).json({ error: sessionsResult.error.message });
    }

    const sessions = sessionsResult.data ?? [];

    // Calculate summary totals from all sessions (not just last 20)
    const allSessionsResult = await supabase
      .from("ai_chat_mpc_sessions")
      .select("input_tokens, output_tokens, total_tokens, input_cost_usd, output_cost_usd, total_cost_usd");

    const allRows = allSessionsResult.data ?? [];
    const summary = {
      sessionCount: allRows.length,
      totalInputTokens: allRows.reduce((s, r) => s + (r.input_tokens ?? 0), 0),
      totalOutputTokens: allRows.reduce((s, r) => s + (r.output_tokens ?? 0), 0),
      totalTokens: allRows.reduce((s, r) => s + (r.total_tokens ?? 0), 0),
      totalInputCostUsd: allRows.reduce((s, r) => s + Number(r.input_cost_usd ?? 0), 0),
      totalOutputCostUsd: allRows.reduce((s, r) => s + Number(r.output_cost_usd ?? 0), 0),
      totalCostUsd: allRows.reduce((s, r) => s + Number(r.total_cost_usd ?? 0), 0),
    };

    console.log(`[usage] Fetched ${sessions.length} sessions`);

    return res.status(200).json({
      sessions,
      monthly: monthlyResult.data ?? [],
      summary,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[usage] Unexpected error:", msg);
    return res.status(500).json({ error: msg });
  }
}
