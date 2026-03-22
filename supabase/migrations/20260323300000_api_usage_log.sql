-- API usage tracking for cost monitoring
CREATE TABLE api_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text, -- 'service_charge_extraction'
  model text, -- 'claude-haiku-4-5-20251001'
  input_tokens int,
  output_tokens int,
  cost_estimate decimal(6,4),
  created_at timestamptz DEFAULT now()
);

-- Service role can insert, no public access needed
ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON api_usage_log
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_api_usage_created ON api_usage_log(created_at);
