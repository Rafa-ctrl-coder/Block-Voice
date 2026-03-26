-- Agent portal: magic link tokens and responses

CREATE TABLE IF NOT EXISTS agent_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  managing_agent_id uuid NOT NULL REFERENCES managing_agents(id),
  development_id uuid NOT NULL REFERENCES developments(id),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  email text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  agent_token_id uuid NOT NULL REFERENCES agent_tokens(id),
  response_text text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Public read on responses so residents can see them
ALTER TABLE agent_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read agent responses" ON agent_responses FOR SELECT USING (true);
CREATE POLICY "Agents insert via token" ON agent_responses FOR INSERT WITH CHECK (true);

-- Tokens are only readable server-side (service role)
ALTER TABLE agent_tokens ENABLE ROW LEVEL SECURITY;
