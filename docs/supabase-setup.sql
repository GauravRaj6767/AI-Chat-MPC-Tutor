-- Run this in your Supabase SQL Editor to set up the required table and view.

-- Sessions table for logging token usage
CREATE TABLE IF NOT EXISTS ai_chat_mpc_sessions (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  subject TEXT NOT NULL,
  question_preview TEXT,
  has_image BOOLEAN DEFAULT FALSE,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  input_cost_usd NUMERIC(12, 8) DEFAULT 0,
  output_cost_usd NUMERIC(12, 8) DEFAULT 0,
  total_cost_usd NUMERIC(12, 8) DEFAULT 0,
  model TEXT
);

-- Enable Row Level Security (allow anon reads for the dashboard)
ALTER TABLE ai_chat_mpc_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: allow anyone to read (dashboard uses anon key)
CREATE POLICY "Allow public read" ON ai_chat_mpc_sessions
  FOR SELECT USING (true);

-- Policy: allow service role to insert (API uses service key)
CREATE POLICY "Allow service insert" ON ai_chat_mpc_sessions
  FOR INSERT WITH CHECK (true);

-- Monthly summary view for the dashboard
CREATE OR REPLACE VIEW ai_chat_mpc_monthly_summary AS
SELECT
  TO_CHAR(created_at, 'YYYY-MM') AS month,
  subject,
  COUNT(*)::INTEGER AS total_sessions,
  SUM(total_tokens)::INTEGER AS total_tokens,
  SUM(total_cost_usd)::NUMERIC(12, 8) AS total_cost_usd
FROM ai_chat_mpc_sessions
GROUP BY TO_CHAR(created_at, 'YYYY-MM'), subject
ORDER BY month DESC, subject;
