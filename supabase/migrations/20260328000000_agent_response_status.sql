-- =============================================================================
-- Agent response: optional status change + email_log metadata for follow-ups
-- =============================================================================

-- Allow agents to optionally change issue status when responding via the portal
ALTER TABLE agent_responses
  ADD COLUMN IF NOT EXISTS new_status text
  CHECK (new_status IS NULL OR new_status IN ('acknowledged', 'in_progress', 'resolved', 'escalated'));

-- email_log needs metadata + recipient so we can dedup agent digests
-- (which have no profile_id) and look up which agent/dev a row belongs to
ALTER TABLE email_log ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE email_log ADD COLUMN IF NOT EXISTS recipient_email text;

CREATE INDEX IF NOT EXISTS idx_email_log_type_recipient
  ON email_log (email_type, recipient_email, sent_at DESC);
