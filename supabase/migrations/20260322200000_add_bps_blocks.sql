-- =============================================================================
-- Add blocks for Circus West Village (BPS Phase 1)
-- Source: Buildington, Buro Happold, SimpsonHaugh project pages
-- The main Circus West building (RS1-A, SimpsonHaugh) has 7 named sections.
-- Faraday House (RS1-B, dRMM) is the neighbouring block.
-- Total: 752 units across 8 blocks.
-- Individual block counts are estimates — exact per-section breakdowns
-- are not publicly available. Corrections welcome via the app.
-- =============================================================================

INSERT INTO blocks (id, development_id, name, total_units) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'Bessborough House', 100),
  ('b1000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'Scott House', 100),
  ('b1000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 'Ambrose House', 95),
  ('b1000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', 'Dawson House', 95),
  ('b1000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002', 'Pierce House', 95),
  ('b1000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000002', 'Fladgate House', 95),
  ('b1000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000002', 'Halliday House', 92),
  ('b1000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000002', 'Faraday House', 80);

-- Also add SW8 4BE to Battersea Exchange postcodes (flagged in testing)
UPDATE developments SET postcodes = ARRAY[
  'SW8 4LR', 'SW8 4EX', 'SW8 4EY', 'SW8 4BE'
] WHERE id = 'd0000000-0000-0000-0000-000000000015';
