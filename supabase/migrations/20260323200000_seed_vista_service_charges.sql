-- =============================================================================
-- Seed service charge data for Apartment 33, Sophora House, Vista
-- Source: RMG Living portal invoices (H1 + H2 per year)
-- Rafael Haq's profile: 9b30873c-9c92-4542-825c-ffb7c9695cff
-- Building: a2eb21ad-c9c6-4f22-9a73-3a402aa112b9 (Sophora House, SW11 8BW)
-- =============================================================================

-- Annual totals (regular charges only, excludes deficit/surplus adjustments)
INSERT INTO service_charge_annuals (profile_id, building_id, year, annual_total, h1_total, h2_total, adjustment_total)
VALUES
  ('9b30873c-9c92-4542-825c-ffb7c9695cff', 'a2eb21ad-c9c6-4f22-9a73-3a402aa112b9',
   '2023/24', 10843.00, 5421.50, 5421.50, 0),
  ('9b30873c-9c92-4542-825c-ffb7c9695cff', 'a2eb21ad-c9c6-4f22-9a73-3a402aa112b9',
   '2024/25', 11409.00, 5704.50, 5704.50, 0),
  ('9b30873c-9c92-4542-825c-ffb7c9695cff', 'a2eb21ad-c9c6-4f22-9a73-3a402aa112b9',
   '2025/26', 12214.00, 6107.00, 6107.00, 0)
ON CONFLICT (profile_id, building_id, year) DO NOTHING;

-- Property size (user-confirmed 1,235 sqft)
INSERT INTO property_sizes (profile_id, building_id, sqft, sqm, source, confirmed)
VALUES
  ('9b30873c-9c92-4542-825c-ffb7c9695cff', 'a2eb21ad-c9c6-4f22-9a73-3a402aa112b9',
   1235, 115, 'user_exact', true)
ON CONFLICT (profile_id, building_id) DO NOTHING;
