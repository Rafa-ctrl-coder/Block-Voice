-- Add quarter_count for quarterly billing support
ALTER TABLE service_charge_annuals
  ADD COLUMN IF NOT EXISTS quarter_count int DEFAULT 0;
