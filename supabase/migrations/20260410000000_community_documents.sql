-- =============================================================================
-- Community Document Sharing
--
-- Residents upload building documents (lease, insurance, fire safety report,
-- Section 20 notice, managing agent letter, annual accounts, service charge).
-- Gemini 2.5 Pro generates two JSON blobs:
--   personal_analysis  — full detail, visible only to the uploader
--   community_summary  — redacted structured summary, shared with the building
--                        community if the uploader opts in
--
-- The uploader becomes a "Community Champion" with a stable anonymised
-- per-development handle ("Resident A/B/C…") assigned at first share.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Document type lookup (seeded with 7 rows)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_document_types (
  id          text PRIMARY KEY,
  label       text NOT NULL,
  description text,
  sort_order  int NOT NULL,
  icon        text
);

INSERT INTO community_document_types (id, label, description, sort_order, icon) VALUES
  ('service_charge',      'Service charge statement',        'Annual or half-yearly demands from your managing agent', 1, 'receipt'),
  ('lease',               'Lease agreement',                 'Your flat lease — term, ground rent, covenants',         2, 'file-text'),
  ('buildings_insurance', 'Buildings insurance',             'Annual policy schedule from your freeholder',            3, 'shield'),
  ('fire_safety',         'Fire safety report',              'FRA, EWS1, or fire risk assessment',                     4, 'flame'),
  ('section_20',          'Section 20 notice',               'Major works consultation from your managing agent',      5, 'alert-triangle'),
  ('agent_letter',        'Managing agent letter',           'Any letter or circular from your managing agent',        6, 'mail'),
  ('annual_accounts',     'Annual service charge accounts',  'Year-end accounts audited or signed off',                7, 'book-open')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Main community_documents table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_documents (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  building_id        uuid NOT NULL REFERENCES buildings(id),
  development_name   text NOT NULL,                          -- denormalised from buildings.development_name at insert time (server-side)
  doc_type           text NOT NULL REFERENCES community_document_types(id),
  original_filename  text NOT NULL,
  storage_path       text NOT NULL,                          -- community-documents/{profile_id}/{id}.{ext}
  file_size_bytes    int,
  mime_type          text,
  status             text NOT NULL DEFAULT 'analysing',      -- 'analysing' | 'ready' | 'failed'
  analysis_error     text,
  personal_analysis  jsonb,                                  -- full detail, private to uploader
  community_summary  jsonb,                                  -- redacted structured summary
  is_shared          boolean NOT NULL DEFAULT false,
  shared_at          timestamptz,
  champion_handle    text,                                   -- 'Resident A/B/…' assigned at first share
  document_date      date,                                   -- extracted from personal_analysis when available
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cd_dev_shared ON community_documents(development_name, is_shared, shared_at DESC);
CREATE INDEX IF NOT EXISTS idx_cd_profile    ON community_documents(profile_id);
CREATE INDEX IF NOT EXISTS idx_cd_doc_type   ON community_documents(doc_type);

-- Keep updated_at fresh on row updates
CREATE OR REPLACE FUNCTION set_community_documents_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS community_documents_updated_at ON community_documents;
CREATE TRIGGER community_documents_updated_at
  BEFORE UPDATE ON community_documents
  FOR EACH ROW EXECUTE FUNCTION set_community_documents_updated_at();

-- -----------------------------------------------------------------------------
-- Extend api_usage_log with profile_id so rate limiting is per-user
-- (Existing service-charge extraction route uses a global cap today; the new
-- community_doc_analysis endpoint uses the per-user column from day one.)
-- -----------------------------------------------------------------------------
ALTER TABLE api_usage_log ADD COLUMN IF NOT EXISTS profile_id uuid;
CREATE INDEX IF NOT EXISTS idx_api_usage_profile_endpoint_date
  ON api_usage_log(profile_id, endpoint, created_at DESC);

-- =============================================================================
-- Row Level Security
-- =============================================================================
ALTER TABLE community_document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_documents      ENABLE ROW LEVEL SECURITY;

-- Types: read-only to any authenticated user (drives the UI dropdown)
DROP POLICY IF EXISTS "Read doc types" ON community_document_types;
CREATE POLICY "Read doc types" ON community_document_types
  FOR SELECT TO authenticated USING (true);

-- Own documents: full CRUD for the uploader
DROP POLICY IF EXISTS "Own community documents" ON community_documents;
CREATE POLICY "Own community documents" ON community_documents
  FOR ALL TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Community read: any authenticated user whose profile's building shares the
-- same development_name can SELECT shared rows. Non-recursive on profiles
-- (auth.uid() lookup only) — matches the pattern proven in
-- 20260322400000_fix_profile_rls_no_recursion.sql.
DROP POLICY IF EXISTS "Read shared community documents" ON community_documents;
CREATE POLICY "Read shared community documents" ON community_documents
  FOR SELECT TO authenticated
  USING (
    is_shared = true
    AND EXISTS (
      SELECT 1
      FROM profiles p
      JOIN buildings b ON b.id = p.building_id
      WHERE p.id = auth.uid()
        AND b.development_name = community_documents.development_name
    )
  );

-- Service role bypasses RLS automatically — no policy needed for the backend routes.

-- =============================================================================
-- Storage bucket and policies
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-documents', 'community-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Uploader can INSERT into their own folder (path format: {profileId}/{id}.{ext})
DROP POLICY IF EXISTS "Upload own community doc" ON storage.objects;
CREATE POLICY "Upload own community doc"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'community-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Uploader can SELECT (download) their own files only
DROP POLICY IF EXISTS "Read own community doc" ON storage.objects;
CREATE POLICY "Read own community doc"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'community-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Uploader can DELETE their own files
DROP POLICY IF EXISTS "Delete own community doc" ON storage.objects;
CREATE POLICY "Delete own community doc"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'community-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Service role can read anything in the bucket (used by the analysis route)
DROP POLICY IF EXISTS "Service role read community docs" ON storage.objects;
CREATE POLICY "Service role read community docs"
  ON storage.objects FOR SELECT TO service_role
  USING (bucket_id = 'community-documents');
