import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const PAGE_SIZE = 10;
const INITIAL_SIZE = 7;

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

  // offset param for load-more pagination (default 0 = initial load)
  const offset = parseInt((req.query.offset as string) ?? "0", 10) || 0;
  const limit = offset === 0 ? INITIAL_SIZE : PAGE_SIZE;

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (offset > 0) {
      // Load-more: only fetch the next page of sessions, no summary/monthly needed
      const { data, error } = await supabase
        .from("ai_chat_mpc_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error("[usage] Sessions fetch error:", error.message);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ sessions: data ?? [], hasMore: (data ?? []).length === limit });
    }

    // Initial load: fetch sessions, monthly summary, and totals in parallel
    const [sessionsResult, monthlyResult, totalsResult] = await Promise.all([
      supabase
        .from("ai_chat_mpc_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .range(0, limit - 1),
      supabase
        .from("ai_chat_mpc_monthly_summary")
        .select("*")
        .order("month", { ascending: false }),
      // DB-side aggregation — accurate regardless of how many rows exist
      supabase
        .from("ai_chat_mpc_totals")
        .select("*")
        .single(),
    ]);

    if (sessionsResult.error) {
      console.error("[usage] Sessions fetch error:", sessionsResult.error.message);
      return res.status(500).json({ error: sessionsResult.error.message });
    }

    const sessions = sessionsResult.data ?? [];
    const totals = totalsResult.data;

    const summary = totals
      ? {
          sessionCount:       totals.session_count,
          totalInputTokens:   totals.total_input_tokens,
          totalOutputTokens:  totals.total_output_tokens,
          totalTokens:        totals.total_tokens,
          totalInputCostUsd:  Number(totals.total_input_cost_usd),
          totalOutputCostUsd: Number(totals.total_output_cost_usd),
          totalCostUsd:       Number(totals.total_cost_usd),
        }
      : {
          sessionCount: 0, totalInputTokens: 0, totalOutputTokens: 0,
          totalTokens: 0, totalInputCostUsd: 0, totalOutputCostUsd: 0, totalCostUsd: 0,
        };

    console.log(`[usage] Initial load: ${sessions.length} sessions, ${summary.sessionCount} total`);

    return res.status(200).json({
      sessions,
      hasMore: sessions.length === limit,
      monthly: monthlyResult.data ?? [],
      summary,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[usage] Unexpected error:", msg);
    return res.status(500).json({ error: msg });
  }
}
