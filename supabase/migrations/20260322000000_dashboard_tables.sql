-- =============================================================================
-- DASHBOARD TABLES: ratings + profiles.block_id
-- =============================================================================

-- Add block_id to profiles so we know which block the user belongs to
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS block_id UUID REFERENCES blocks(id) ON DELETE SET NULL;

-- =============================================================================
-- AGENT RATINGS (5 categories, 1-5 each)
-- =============================================================================
CREATE TABLE IF NOT EXISTS agent_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id UUID NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  responsiveness INTEGER NOT NULL CHECK (responsiveness BETWEEN 1 AND 5),
  communication INTEGER NOT NULL CHECK (communication BETWEEN 1 AND 5),
  value_for_money INTEGER NOT NULL CHECK (value_for_money BETWEEN 1 AND 5),
  maintenance INTEGER NOT NULL CHECK (maintenance BETWEEN 1 AND 5),
  transparency INTEGER NOT NULL CHECK (transparency BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (development_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_ratings_dev ON agent_ratings (development_id);

-- =============================================================================
-- FREEHOLDER RATINGS (4 categories, 1-5 each)
-- =============================================================================
CREATE TABLE IF NOT EXISTS freeholder_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id UUID NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  building_investment INTEGER NOT NULL CHECK (building_investment BETWEEN 1 AND 5),
  leaseholder_relations INTEGER NOT NULL CHECK (leaseholder_relations BETWEEN 1 AND 5),
  transparency INTEGER NOT NULL CHECK (transparency BETWEEN 1 AND 5),
  accountability INTEGER NOT NULL CHECK (accountability BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (development_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_freeholder_ratings_dev ON freeholder_ratings (development_id);

-- =============================================================================
-- RLS for ratings
-- =============================================================================
ALTER TABLE agent_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_ratings_read" ON agent_ratings FOR SELECT USING (true);
CREATE POLICY "agent_ratings_insert" ON agent_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "agent_ratings_update" ON agent_ratings FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE freeholder_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "freeholder_ratings_read" ON freeholder_ratings FOR SELECT USING (true);
CREATE POLICY "freeholder_ratings_insert" ON freeholder_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "freeholder_ratings_update" ON freeholder_ratings FOR UPDATE USING (auth.uid() = user_id);
