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

    // Calculate summary totals from sessions
    const summary = {
      sessionCount: sessions.length,
      totalTokens: sessions.reduce((sum, r) => sum + (r.total_tokens ?? 0), 0),
      totalCostUsd: sessions.reduce((sum, r) => sum + Number(r.total_cost_usd ?? 0), 0),
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
