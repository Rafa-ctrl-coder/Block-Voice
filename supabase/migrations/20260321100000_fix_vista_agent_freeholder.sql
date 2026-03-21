-- =============================================================================
-- Fix Vista managing agent & freeholder
-- Source: Berkeley sold freehold to Harland (PC) Ltd (subsidiary of Landmark Investments)
-- and R&R were given 10 days notice, replaced by RMG in Nov 2021.
-- https://chelseabridgewharf.org.uk/2021/11/08/youre-fired-rendall-rittner-given-10-days-notice-at-vista-development/
-- =============================================================================

INSERT INTO freeholders (id, name, parent_company)
VALUES ('f0000000-0000-0000-0000-000000000020', 'Harland (PC) Ltd', 'Landmark Investments')
ON CONFLICT (id) DO NOTHING;

UPDATE development_links
SET managing_agent_id = 'a0000000-0000-0000-0000-000000000002',
    freeholder_id = 'f0000000-0000-0000-0000-000000000020',
    agent_confidence = 'confirmed',
    freeholder_confidence = 'confirmed',
    agent_source = 'Resident confirmation & chelseabridgewharf.org.uk Nov 2021',
    freeholder_source = 'chelseabridgewharf.org.uk — Berkeley sold freehold to Harland (PC) Ltd (Landmark Investments)'
WHERE development_id = 'd0000000-0000-0000-0000-000000000001';

-- =============================================================================
-- Fix postcodes for ALL 19 developments
-- Sources: Rightmove, Zoopla, Savills, MyLondonHome, StreetCheck, developer sites
-- =============================================================================

-- 1. Vista, Chelsea Bridge
UPDATE developments SET postcodes = ARRAY[
  'SW11 8BY', 'SW11 8BW', 'SW11 8AZ', 'SW11 8NS', 'SW11 8EW'
] WHERE id = 'd0000000-0000-0000-0000-000000000001';

-- 2. Circus West Village (BPS Phase 1)
UPDATE developments SET postcodes = ARRAY[
  'SW11 8EZ', 'SW11 8BD', 'SW11 8AH', 'SW11 8EU', 'SW11 8BJ'
] WHERE id = 'd0000000-0000-0000-0000-000000000002';

-- 3. Embassy Gardens
UPDATE developments SET postcodes = ARRAY[
  'SW11 7AY', 'SW8 5BL', 'SW8 5AD', 'SW11 7AQ'
] WHERE id = 'd0000000-0000-0000-0000-000000000003';

-- 4. Riverlight
UPDATE developments SET postcodes = ARRAY[
  'SW11 8AU', 'SW11 8AW', 'SW11 8BE', 'SW11 8BF', 'SW11 8DG', 'SW11 8DW', 'SW11 8EA', 'SW11 8EB'
] WHERE id = 'd0000000-0000-0000-0000-000000000004';

-- 5. Prince of Wales Drive
UPDATE developments SET postcodes = ARRAY[
  'SW11 4FA', 'SW11 4EJ'
] WHERE id = 'd0000000-0000-0000-0000-000000000005';

-- 6. Chelsea Bridge Wharf
UPDATE developments SET postcodes = ARRAY[
  'SW8 4NR', 'SW8 4NN', 'SW8 4NU'
] WHERE id = 'd0000000-0000-0000-0000-000000000006';

-- 7. Battersea Reach
UPDATE developments SET postcodes = ARRAY[
  'SW18 1TA', 'SW18 1TS', 'SW18 1TX', 'SW18 1TY', 'SW18 1JE', 'SW18 1FR'
] WHERE id = 'd0000000-0000-0000-0000-000000000007';

-- 8. St George Wharf
UPDATE developments SET postcodes = ARRAY[
  'SW8 2LE', 'SW8 2LU', 'SW8 2LW', 'SW8 2LS'
] WHERE id = 'd0000000-0000-0000-0000-000000000008';

-- 9. One Thames City
UPDATE developments SET postcodes = ARRAY[
  'SW8 5FS', 'SW8 5FT'
] WHERE id = 'd0000000-0000-0000-0000-000000000009';

-- 10. DAMAC Tower Nine Elms
UPDATE developments SET postcodes = ARRAY[
  'SW8 1GS', 'SW8 1GR'
] WHERE id = 'd0000000-0000-0000-0000-000000000010';

-- 11. Vauxhall Sky Gardens
UPDATE developments SET postcodes = ARRAY[
  'SW8 2FZ', 'SW8 2FY', 'SW8 2LY', 'SW8 2TG'
] WHERE id = 'd0000000-0000-0000-0000-000000000011';

-- 12. Bloom Nine Elms
UPDATE developments SET postcodes = ARRAY[
  'SW11 7DS', 'SW11 7DG'
] WHERE id = 'd0000000-0000-0000-0000-000000000012';

-- 13. Nine Elms Point
UPDATE developments SET postcodes = ARRAY[
  'SW8 2LF', 'SW8 2FN', 'SW8 2FR'
] WHERE id = 'd0000000-0000-0000-0000-000000000013';

-- 14. London Square Nine Elms
UPDATE developments SET postcodes = ARRAY[
  'SW11 7BA', 'SW11 7AB'
] WHERE id = 'd0000000-0000-0000-0000-000000000014';

-- 15. Battersea Exchange
UPDATE developments SET postcodes = ARRAY[
  'SW8 4LR', 'SW8 4EX', 'SW8 4EY'
] WHERE id = 'd0000000-0000-0000-0000-000000000015';

-- 16. Grosvenor Waterside
UPDATE developments SET postcodes = ARRAY[
  'SW1W 8QN', 'SW1W 8DP', 'SW1W 8DU', 'SW1W 8DE'
] WHERE id = 'd0000000-0000-0000-0000-000000000016';

-- 17. Moda, Embassy Boulevard
UPDATE developments SET postcodes = ARRAY[
  'SW11 7FD'
] WHERE id = 'd0000000-0000-0000-0000-000000000017';

-- 18. The Dumont
UPDATE developments SET postcodes = ARRAY[
  'SE1 7TJ', 'SE1 7AQ'
] WHERE id = 'd0000000-0000-0000-0000-000000000018';

-- 19. Keybridge
UPDATE developments SET postcodes = ARRAY[
  'SW8 1RG', 'SW8 1DF', 'SW8 1BQ', 'SW8 1BP'
] WHERE id = 'd0000000-0000-0000-0000-000000000019';
