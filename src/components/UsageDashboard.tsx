import { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import type { SessionRow, MonthlySummary } from "../lib/supabase";

const USD_TO_INR = 85;

function fmtUsd(n: number): string {
  if (n < 0.0001) return "<$0.0001";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function fmtInr(n: number): string {
  const inr = n * USD_TO_INR;
  if (inr < 0.01) return `<Rs.0.01`;
  if (inr < 1) return `Rs.${inr.toFixed(2)}`;
  return `Rs.${inr.toFixed(2)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtMonth(val: string): string {
  // Handles both "YYYY-MM" and full ISO timestamps
  const d = val.length === 7 ? new Date(`${val}-01`) : new Date(val);
  return d.toLocaleString("en-IN", { month: "long", year: "numeric" });
}

export default function UsageDashboard() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [summary, setSummary] = useState({
    sessionCount: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    totalInputCostUsd: 0,
    totalOutputCostUsd: 0,
    totalCostUsd: 0,
  });
  const [monthly, setMonthly] = useState<MonthlySummary[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [loadingRefresh, setLoadingRefresh] = useState(false);

  const refresh = useCallback(async () => {
    setLoadingRefresh(true);
    try {
      const res = await fetch("/api/usage");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSessions(data.sessions ?? []);
      setSummary(data.summary ?? { totalTokens: 0, totalCostUsd: 0, sessionCount: 0 });
      setMonthly(data.monthly ?? []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("[UsageDashboard] Failed to fetch:", err);
    } finally {
      setLoadingRefresh(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="usage-dashboard">
      <div className="usage-header">
        <h2>Usage Dashboard</h2>
        <button
          className="input-btn"
          onClick={refresh}
          disabled={loadingRefresh}
          title="Refresh"
          style={{ padding: 6 }}
        >
          <RefreshCw size={16} className={loadingRefresh ? "spin" : ""} />
        </button>
      </div>

      <div className="usage-refresh-text">
        Last updated: {lastRefresh.toLocaleTimeString()}
      </div>

      {/* Summary Cards */}
      <div className="usage-summary-cards">
        <div className="usage-card">
          <div className="usage-card-label">Total Sessions</div>
          <div className="usage-card-value">{summary.sessionCount}</div>
        </div>
        <div className="usage-card">
          <div className="usage-card-label">Total Tokens</div>
          <div className="usage-card-value">{fmtTokens(summary.totalTokens)}</div>
          <div className="usage-card-sub">
            🔢 {fmtTokens(summary.totalInputTokens)} in · ✨ {fmtTokens(summary.totalOutputTokens)} out
          </div>
        </div>
        <div className="usage-card">
          <div className="usage-card-label">Total Cost (USD)</div>
          <div className="usage-card-value">{fmtUsd(summary.totalCostUsd)}</div>
          <div className="usage-card-sub">
            in {fmtUsd(summary.totalInputCostUsd)} · out {fmtUsd(summary.totalOutputCostUsd)}
          </div>
        </div>
        <div className="usage-card">
          <div className="usage-card-label">Total Cost (INR)</div>
          <div className="usage-card-value">{fmtInr(summary.totalCostUsd)}</div>
          <div className="usage-card-sub">
            in {fmtInr(summary.totalInputCostUsd)} · out {fmtInr(summary.totalOutputCostUsd)}
          </div>
        </div>
      </div>

      {/* Monthly Breakdown */}
      {monthly.length > 0 && (
        <div className="usage-section">
          <h3>Monthly Breakdown</h3>
          <table className="usage-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Subject</th>
                <th>Sessions</th>
                <th>Tokens</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((row, i) => (
                <tr key={i}>
                  <td>{fmtMonth(row.month)}</td>
                  <td>
                    <span
                      className={`subject-badge ${row.subject?.toLowerCase()}`}
                    >
                      {row.subject}
                    </span>
                  </td>
                  <td>{row.total_sessions}</td>
                  <td>{fmtTokens(row.total_tokens)}</td>
                  <td>
                    {fmtUsd(row.total_cost_usd)} / {fmtInr(row.total_cost_usd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent Sessions */}
      <div className="usage-section">
        <h3>Recent Sessions (Last 20)</h3>
        {sessions.length === 0 ? (
          <div className="usage-empty">No sessions recorded yet.</div>
        ) : (
          <table className="usage-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Subject</th>
                <th>Question</th>
                <th>In tokens</th>
                <th>Out tokens</th>
                <th>Cost (USD)</th>
                <th>Cost (INR)</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((row) => (
                <tr key={row.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {fmtTime(row.created_at)}
                  </td>
                  <td>
                    <span className={`subject-badge ${row.subject?.toLowerCase()}`}>
                      {row.subject}
                    </span>
                  </td>
                  <td
                    style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title={row.question_preview}
                  >
                    {row.question_preview}{row.has_image && " [img]"}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {fmtTokens(row.input_tokens)}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {fmtTokens(row.output_tokens)}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {fmtUsd(row.input_cost_usd)} + {fmtUsd(row.output_cost_usd)} = {fmtUsd(row.total_cost_usd)}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {fmtInr(row.total_cost_usd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
