-- BlockVoice Schema Migration
-- Creates the full data model per the build specification

-- =============================================================================
-- DROP PRE-EXISTING TABLES (old schema)
-- =============================================================================
DROP TABLE IF EXISTS issue_support CASCADE;
DROP TABLE IF EXISTS issue_reports CASCADE;
DROP TABLE IF EXISTS issues CASCADE;
DROP TABLE IF EXISTS corrections CASCADE;
DROP TABLE IF EXISTS issue_evidence CASCADE;
DROP TABLE IF EXISTS issue_supporters CASCADE;
DROP TABLE IF EXISTS development_links CASCADE;
DROP TABLE IF EXISTS units CASCADE;
DROP TABLE IF EXISTS blocks CASCADE;
DROP TABLE IF EXISTS developments CASCADE;
DROP TABLE IF EXISTS managing_agents CASCADE;
DROP TABLE IF EXISTS freeholders CASCADE;

-- =============================================================================
-- MANAGING AGENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS managing_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  companies_house_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- FREEHOLDERS
-- =============================================================================
CREATE TABLE IF NOT EXISTS freeholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  companies_house_number TEXT,
  parent_company TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- DEVELOPMENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS developments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  postcodes TEXT[] NOT NULL DEFAULT '{}',
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  total_units INTEGER NOT NULL DEFAULT 0,
  developer TEXT,
  status TEXT NOT NULL DEFAULT 'complete'
    CHECK (status IN ('complete', 'partially_complete', 'under_construction')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_developments_slug ON developments (slug);
CREATE INDEX IF NOT EXISTS idx_developments_postcodes ON developments USING GIN (postcodes);

-- =============================================================================
-- BLOCKS
-- =============================================================================
CREATE TABLE IF NOT EXISTS blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id UUID NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_units INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blocks_development ON blocks (development_id);

-- =============================================================================
-- UNITS
-- =============================================================================
CREATE TABLE IF NOT EXISTS units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  development_id UUID NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
  uprn TEXT,
  flat_number TEXT NOT NULL,
  floor INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_units_block ON units (block_id);
CREATE INDEX IF NOT EXISTS idx_units_development ON units (development_id);

-- =============================================================================
-- DEVELOPMENT → AGENT / FREEHOLDER LINKS
-- =============================================================================
CREATE TABLE IF NOT EXISTS development_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id UUID NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
  managing_agent_id UUID REFERENCES managing_agents(id) ON DELETE SET NULL,
  freeholder_id UUID REFERENCES freeholders(id) ON DELETE SET NULL,
  agent_confidence TEXT NOT NULL DEFAULT 'medium'
    CHECK (agent_confidence IN ('confirmed', 'high', 'medium', 'low')),
  freeholder_confidence TEXT NOT NULL DEFAULT 'medium'
    CHECK (freeholder_confidence IN ('confirmed', 'high', 'medium', 'low')),
  agent_source TEXT,
  freeholder_source TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dev_links_development ON development_links (development_id);
CREATE INDEX IF NOT EXISTS idx_dev_links_agent ON development_links (managing_agent_id);
CREATE INDEX IF NOT EXISTS idx_dev_links_freeholder ON development_links (freeholder_id);

-- =============================================================================
-- ISSUES
-- =============================================================================
CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id UUID NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
  block_id UUID REFERENCES blocks(id) ON DELETE SET NULL,
  raised_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN (
      'facilities', 'maintenance', 'service_charge', 'security',
      'safety', 'communal_areas', 'communication', 'other'
    )),
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'acknowledged', 'in_progress', 'resolved', 'escalated')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_issues_development ON issues (development_id);
CREATE INDEX IF NOT EXISTS idx_issues_block ON issues (block_id);
CREATE INDEX IF NOT EXISTS idx_issues_raised_by ON issues (raised_by);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues (status);

-- =============================================================================
-- ISSUE EVIDENCE
-- =============================================================================
CREATE TABLE IF NOT EXISTS issue_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'image'
    CHECK (file_type IN ('image', 'pdf', 'document')),
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_evidence_issue ON issue_evidence (issue_id);

-- =============================================================================
-- ISSUE SUPPORTERS
-- =============================================================================
CREATE TABLE IF NOT EXISTS issue_supporters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (issue_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_issue_supporters_issue ON issue_supporters (issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_supporters_user ON issue_supporters (user_id);

-- =============================================================================
-- CORRECTIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id UUID NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  field TEXT NOT NULL,
  current_value TEXT NOT NULL DEFAULT '',
  suggested_value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_corrections_development ON corrections (development_id);
CREATE INDEX IF NOT EXISTS idx_corrections_status ON corrections (status);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Developments: public read, admin write
ALTER TABLE developments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "developments_public_read" ON developments FOR SELECT USING (true);

-- Blocks: public read
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks_public_read" ON blocks FOR SELECT USING (true);

-- Units: public read
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "units_public_read" ON units FOR SELECT USING (true);

-- Managing agents: public read
ALTER TABLE managing_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents_public_read" ON managing_agents FOR SELECT USING (true);

-- Freeholders: public read
ALTER TABLE freeholders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "freeholders_public_read" ON freeholders FOR SELECT USING (true);

-- Development links: public read
ALTER TABLE development_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_links_public_read" ON development_links FOR SELECT USING (true);

-- Issues: public read, authenticated insert
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "issues_public_read" ON issues FOR SELECT USING (true);
CREATE POLICY "issues_auth_insert" ON issues FOR INSERT
  WITH CHECK (auth.uid() = raised_by);
CREATE POLICY "issues_owner_update" ON issues FOR UPDATE
  USING (auth.uid() = raised_by);

-- Issue evidence: public read, authenticated insert
ALTER TABLE issue_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evidence_public_read" ON issue_evidence FOR SELECT USING (true);
CREATE POLICY "evidence_auth_insert" ON issue_evidence FOR INSERT
  WITH CHECK (auth.uid() = uploaded_by);

-- Issue supporters: public read, authenticated insert/delete own
ALTER TABLE issue_supporters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supporters_public_read" ON issue_supporters FOR SELECT USING (true);
CREATE POLICY "supporters_auth_insert" ON issue_supporters FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "supporters_own_delete" ON issue_supporters FOR DELETE
  USING (auth.uid() = user_id);

-- Corrections: authenticated insert, own read
ALTER TABLE corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "corrections_auth_insert" ON corrections FOR INSERT
  WITH CHECK (auth.uid() = submitted_by);
CREATE POLICY "corrections_own_read" ON corrections FOR SELECT
  USING (auth.uid() = submitted_by);
