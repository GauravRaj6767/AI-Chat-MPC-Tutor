import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface SessionRow {
  id: number;
  created_at: string;
  subject: string;
  question_preview: string;
  has_image: boolean;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_cost_usd: number;
  output_cost_usd: number;
  total_cost_usd: number;
  model: string;
}

export interface MonthlySummary {
  month: string;
  subject: string;
  total_sessions: number;
  total_tokens: number;
  total_cost_usd: number;
}

export async function fetchRecentSessions(
  limit = 20,
): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from("ai_chat_mpc_sessions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch sessions:", error);
    return [];
  }
  return data ?? [];
}

export async function fetchUsageSummary(): Promise<{
  totalTokens: number;
  totalCostUsd: number;
  sessionCount: number;
}> {
  const { data, error } = await supabase
    .from("ai_chat_mpc_sessions")
    .select("total_tokens, total_cost_usd");

  if (error) {
    console.error("Failed to fetch usage summary:", error);
    return { totalTokens: 0, totalCostUsd: 0, sessionCount: 0 };
  }

  const rows = data ?? [];
  return {
    totalTokens: rows.reduce((sum, r) => sum + (r.total_tokens ?? 0), 0),
    totalCostUsd: rows.reduce((sum, r) => sum + (r.total_cost_usd ?? 0), 0),
    sessionCount: rows.length,
  };
}

export async function fetchMonthlySummary(): Promise<MonthlySummary[]> {
  const { data, error } = await supabase
    .from("ai_chat_mpc_monthly_summary")
    .select("*")
    .order("month", { ascending: false });

  if (error) {
    console.error("Failed to fetch monthly summary:", error);
    return [];
  }
  return data ?? [];
}
