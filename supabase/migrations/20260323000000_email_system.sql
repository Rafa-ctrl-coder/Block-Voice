-- =============================================================================
-- Email system: verification_status on profiles + email_log table
-- =============================================================================

-- Add verification_status to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified';
-- Values: unverified, pending, verified, rejected

-- Email log for tracking all sent emails
CREATE TABLE IF NOT EXISTS email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email_type TEXT NOT NULL,  -- welcome, new_issue, verification_reminder
  subject TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'sent'  -- sent, failed, bounced
);

CREATE INDEX IF NOT EXISTS idx_email_log_profile ON email_log (profile_id);
CREATE INDEX IF NOT EXISTS idx_email_log_type_sent ON email_log (email_type, sent_at);

ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_log_auth_insert" ON email_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "email_log_own_read" ON email_log FOR SELECT USING (profile_id = auth.uid());
-- Service role can read/write all (for API routes)
