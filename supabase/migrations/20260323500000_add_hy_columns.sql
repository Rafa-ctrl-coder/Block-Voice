-- Add half-yearly tracking columns to service_charge_annuals
ALTER TABLE service_charge_annuals
  ADD COLUMN IF NOT EXISTS is_half_yearly boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_both_halves boolean DEFAULT false;

-- Add charge_category to service_charge_lines
ALTER TABLE service_charge_lines
  ADD COLUMN IF NOT EXISTS charge_category text DEFAULT 'other';
