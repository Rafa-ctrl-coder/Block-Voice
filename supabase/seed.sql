-- BlockVoice Seed Data
-- 19 Battersea & Nine Elms developments with managing agents, freeholders, and links

-- =============================================================================
-- MANAGING AGENTS
-- =============================================================================
INSERT INTO managing_agents (id, name, phone, email, website, address) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Rendall & Rittner', '020 7702 0701', 'office@rendallandrittner.co.uk', 'rendallandrittner.co.uk', '13b St George Wharf SW8 2LE'),
  ('a0000000-0000-0000-0000-000000000002', 'RMG', '0345 002 4444', 'customerservice@rmguk.com', 'rmguk.com', 'RMG House Essex Rd Hoddesdon EN11 0DR'),
  ('a0000000-0000-0000-0000-000000000003', 'BPS Estate Management', '020 7062 1882', 'info@bpsestates.co.uk', 'bpsestates.co.uk', '44 Electric Boulevard SW11 8BJ'),
  ('a0000000-0000-0000-0000-000000000004', 'Ballymore Asset Management', '020 7510 9100', 'info@ballymoregroup.com', 'ballymoream.com', '161 Marsh Wall E14 9SJ'),
  ('a0000000-0000-0000-0000-000000000005', 'Moda Living', '020 3916 5500', 'hello@modaliving.com', 'modaliving.com', NULL),
  ('a0000000-0000-0000-0000-000000000006', 'Greystar', '020 3884 2725', 'bloomnineelms@greystar.com', 'greystar.com', NULL),
  ('a0000000-0000-0000-0000-000000000007', 'Cushman & Wakefield', '020 3296 3000', 'residential.services@cushwake.com', 'cushmanwakefield.com', NULL),
  ('a0000000-0000-0000-0000-000000000008', 'GWRC (Self-Managed)', '020 7811 7594', 'info@grosvenorwaterside.com', NULL, NULL);

-- =============================================================================
-- FREEHOLDERS
-- =============================================================================
INSERT INTO freeholders (id, name, phone, email, address, companies_house_number, parent_company) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'Battersea Reach Estates Ltd', NULL, NULL, NULL, NULL, 'St George (Berkeley Group)'),
  ('f0000000-0000-0000-0000-000000000002', 'Battersea Power Station Development Company', NULL, NULL, '188 Kirtling Street London SW8 5BN', NULL, 'BPS Consortium (SP Setia, Sime Darby, EPF)'),
  ('f0000000-0000-0000-0000-000000000003', 'EcoWorld Ballymore (Embassy Gardens) LLP', NULL, NULL, NULL, NULL, 'EcoWorld / Ballymore JV'),
  ('f0000000-0000-0000-0000-000000000004', 'St James Group Ltd', NULL, NULL, NULL, NULL, 'Berkeley Group'),
  ('f0000000-0000-0000-0000-000000000005', 'Chelsea Bridge Wharf Ltd', NULL, NULL, NULL, NULL, 'Hutchison Whampoa'),
  ('f0000000-0000-0000-0000-000000000006', 'St George South London Ltd', NULL, NULL, NULL, NULL, 'Berkeley Group'),
  ('f0000000-0000-0000-0000-000000000007', 'R&F Properties (UK) Ltd', NULL, NULL, NULL, NULL, 'R&F Properties / CC Land'),
  ('f0000000-0000-0000-0000-000000000008', 'DAMAC (London) Ltd', NULL, NULL, NULL, NULL, 'DAMAC Properties'),
  ('f0000000-0000-0000-0000-000000000009', 'Vauxhall Sky Gardens Ltd', NULL, NULL, NULL, NULL, 'Sainsbury''s / Mount Anvil'),
  ('f0000000-0000-0000-0000-000000000010', 'Greystar Europe Holdings Ltd', NULL, NULL, NULL, NULL, 'Greystar'),
  ('f0000000-0000-0000-0000-000000000011', 'Barratt London Ltd', NULL, NULL, NULL, NULL, 'Barratt Developments'),
  ('f0000000-0000-0000-0000-000000000012', 'London Square Developments Ltd', NULL, NULL, NULL, NULL, 'London Square'),
  ('f0000000-0000-0000-0000-000000000013', 'Taylor Wimpey Central London', NULL, NULL, NULL, NULL, 'Taylor Wimpey'),
  ('f0000000-0000-0000-0000-000000000014', 'Grosvenor Waterside Residents Company', NULL, NULL, NULL, NULL, NULL),
  ('f0000000-0000-0000-0000-000000000015', 'Moda (Embassy Boulevard) Ltd', NULL, NULL, NULL, NULL, 'Moda Living'),
  ('f0000000-0000-0000-0000-000000000016', 'Berkeley Homes (South East London) Ltd', NULL, NULL, NULL, NULL, 'Berkeley Group'),
  ('f0000000-0000-0000-0000-000000000017', 'Mount Anvil (Nine Elms) Ltd', NULL, NULL, NULL, NULL, 'Mount Anvil');

-- =============================================================================
-- DEVELOPMENTS (19 buildings)
-- =============================================================================
INSERT INTO developments (id, name, slug, postcodes, address, lat, lng, total_units, developer, status) VALUES

  -- 1. Vista, Chelsea Bridge
  ('d0000000-0000-0000-0000-000000000001',
   'Vista, Chelsea Bridge', 'vista-chelsea-bridge',
   ARRAY['SW11 8AY', 'SW8 4NR', 'SW8 3QQ'],
   'Queenstown Road, London SW11 8AY',
   51.4801, -0.1480, 988, 'Berkeley Group / St James', 'complete'),

  -- 2. Battersea Power Station Phase 1 (Circus West Village)
  ('d0000000-0000-0000-0000-000000000002',
   'Circus West Village (BPS Phase 1)', 'bps-phase-1',
   ARRAY['SW11 8BW', 'SW11 8AL'],
   'Circus West, Battersea Power Station, London SW11 8BW',
   51.4829, -0.1465, 865, 'Battersea Power Station Development Company', 'complete'),

  -- 3. Embassy Gardens
  ('d0000000-0000-0000-0000-000000000003',
   'Embassy Gardens', 'embassy-gardens',
   ARRAY['SW11 7AY', 'SW11 7BW', 'SW8 5NQ'],
   'Embassy Gardens, Nine Elms Lane, London SW11 7AY',
   51.4824, -0.1387, 2000, 'EcoWorld Ballymore', 'partially_complete'),

  -- 4. Riverlight
  ('d0000000-0000-0000-0000-000000000004',
   'Riverlight', 'riverlight',
   ARRAY['SW11 8EE', 'SW11 8FA'],
   'Nine Elms Lane, London SW11 8EE',
   51.4834, -0.1418, 813, 'St James (Berkeley Group)', 'complete'),

  -- 5. Prince of Wales Drive
  ('d0000000-0000-0000-0000-000000000005',
   'Prince of Wales Drive', 'prince-of-wales-drive',
   ARRAY['SW11 4SA', 'SW11 4TF'],
   'Prince of Wales Drive, London SW11 4SA',
   51.4786, -0.1537, 955, 'St William (Berkeley Group / National Grid)', 'partially_complete'),

  -- 6. Chelsea Bridge Wharf
  ('d0000000-0000-0000-0000-000000000006',
   'Chelsea Bridge Wharf', 'chelsea-bridge-wharf',
   ARRAY['SW8 4NR', 'SW8 4NN'],
   'Queenstown Road, London SW8 4NR',
   51.4812, -0.1510, 290, 'Hutchison Whampoa', 'complete'),

  -- 7. Battersea Reach
  ('d0000000-0000-0000-0000-000000000007',
   'Battersea Reach', 'battersea-reach',
   ARRAY['SW18 1TW', 'SW18 1SU'],
   'Juniper Drive, Wandsworth, London SW18 1TW',
   51.4710, -0.1840, 641, 'St George (Berkeley Group)', 'complete'),

  -- 8. St George Wharf
  ('d0000000-0000-0000-0000-000000000008',
   'St George Wharf', 'st-george-wharf',
   ARRAY['SW8 2LE', 'SW8 2LU', 'SW8 2LX'],
   'St George Wharf, Vauxhall, London SW8 2LE',
   51.4862, -0.1254, 1172, 'St George (Berkeley Group)', 'complete'),

  -- 9. One Thames City
  ('d0000000-0000-0000-0000-000000000009',
   'One Thames City', 'one-thames-city',
   ARRAY['SW11 7AG', 'SW11 7AH'],
   'Nine Elms Lane, London SW11 7AG',
   51.4837, -0.1392, 420, 'R&F Properties / CC Land', 'partially_complete'),

  -- 10. DAMAC Tower
  ('d0000000-0000-0000-0000-000000000010',
   'DAMAC Tower', 'damac-tower',
   ARRAY['SW8 5EH', 'SW8 2LZ'],
   'Nine Elms, Vauxhall, London SW8 5EH',
   51.4855, -0.1275, 457, 'DAMAC Properties', 'complete'),

  -- 11. Sky Gardens (Vauxhall Sky Gardens)
  ('d0000000-0000-0000-0000-000000000011',
   'Vauxhall Sky Gardens', 'sky-gardens',
   ARRAY['SW8 1SJ', 'SW8 1WG'],
   'Wandsworth Road, Vauxhall, London SW8 1SJ',
   51.4830, -0.1239, 240, 'Mount Anvil / Sainsbury''s', 'complete'),

  -- 12. Bloom Nine Elms
  ('d0000000-0000-0000-0000-000000000012',
   'Bloom Nine Elms', 'bloom-nine-elms',
   ARRAY['SW11 7EL', 'SW11 7EQ'],
   'Ponton Road, Nine Elms, London SW11 7EL',
   51.4820, -0.1340, 526, 'Greystar', 'complete'),

  -- 13. Nine Elms Point
  ('d0000000-0000-0000-0000-000000000013',
   'Nine Elms Point', 'nine-elms-point',
   ARRAY['SW8 5BN', 'SW8 5BP'],
   'Kirtling Street, London SW8 5BN',
   51.4835, -0.1445, 732, 'Barratt London', 'partially_complete'),

  -- 14. One Linear Place (London Square Nine Elms)
  ('d0000000-0000-0000-0000-000000000014',
   'London Square Nine Elms', 'one-linear-place',
   ARRAY['SW11 7HF', 'SW11 7HG'],
   'Ponton Road, Nine Elms, London SW11 7HF',
   51.4818, -0.1350, 225, 'London Square', 'complete'),

  -- 15. Battersea Exchange
  ('d0000000-0000-0000-0000-000000000015',
   'Battersea Exchange', 'battersea-exchange',
   ARRAY['SW8 5BQ', 'SW8 5BR'],
   'Battersea Park Road, London SW8 5BQ',
   51.4795, -0.1485, 291, 'Taylor Wimpey', 'complete'),

  -- 16. Grosvenor Waterside
  ('d0000000-0000-0000-0000-000000000016',
   'Grosvenor Waterside', 'grosvenor-waterside',
   ARRAY['SW1W 8QT', 'SW1W 8QS'],
   'Gatliff Road, Chelsea, London SW1W 8QT',
   51.4870, -0.1535, 283, 'Grosvenor Developments', 'complete'),

  -- 17. Moda, Embassy Boulevard
  ('d0000000-0000-0000-0000-000000000017',
   'Moda, Embassy Boulevard', 'moda-embassy-boulevard',
   ARRAY['SW11 7BH', 'SW11 7BJ'],
   'Embassy Boulevard, Nine Elms, London SW11 7BH',
   51.4822, -0.1380, 165, 'Moda Living', 'complete'),

  -- 18. The Dumont
  ('d0000000-0000-0000-0000-000000000018',
   'The Dumont', 'the-dumont',
   ARRAY['SE1 7RY', 'SE1 7RX'],
   'Albert Embankment, London SE1 7RY',
   51.4912, -0.1220, 168, 'St James (Berkeley Group)', 'complete'),

  -- 19. Keybridge
  ('d0000000-0000-0000-0000-000000000019',
   'Keybridge', 'keybridge',
   ARRAY['SW8 1SP', 'SW8 1SS'],
   'South Lambeth Road, Vauxhall, London SW8 1SP',
   51.4838, -0.1235, 595, 'Mount Anvil / A2 Dominion', 'complete');

-- =============================================================================
-- BLOCKS (notable named blocks within developments)
-- =============================================================================
INSERT INTO blocks (id, development_id, name, total_units) VALUES
  -- Vista, Chelsea Bridge
  ('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Sophora House', 330),
  ('b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Acacia House', 320),
  ('b0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'Cascade Court', 338),

  -- Embassy Gardens
  ('b0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000003', 'Building 1', 500),
  ('b0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000003', 'Building 2', 500),
  ('b0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000003', 'Sky Pool Building', 500),
  ('b0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000003', 'Legacy Building', 500),

  -- Riverlight
  ('b0000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000004', 'Quay House', 200),
  ('b0000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000004', 'Wharf House', 200),
  ('b0000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000004', 'Bridge House', 200),
  ('b0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000004', 'Waterfront House', 213),

  -- Prince of Wales Drive
  ('b0000000-0000-0000-0000-000000000012', 'd0000000-0000-0000-0000-000000000005', 'Kensington House', 320),
  ('b0000000-0000-0000-0000-000000000013', 'd0000000-0000-0000-0000-000000000005', 'Huntington House', 320),
  ('b0000000-0000-0000-0000-000000000014', 'd0000000-0000-0000-0000-000000000005', 'Park House', 315),

  -- Battersea Reach
  ('b0000000-0000-0000-0000-000000000015', 'd0000000-0000-0000-0000-000000000007', 'Commodore House', 200),
  ('b0000000-0000-0000-0000-000000000016', 'd0000000-0000-0000-0000-000000000007', 'Harbour House', 220),
  ('b0000000-0000-0000-0000-000000000017', 'd0000000-0000-0000-0000-000000000007', 'Admiral House', 221),

  -- St George Wharf
  ('b0000000-0000-0000-0000-000000000018', 'd0000000-0000-0000-0000-000000000008', 'The Tower', 214),
  ('b0000000-0000-0000-0000-000000000019', 'd0000000-0000-0000-0000-000000000008', 'Domus Building', 240),
  ('b0000000-0000-0000-0000-000000000020', 'd0000000-0000-0000-0000-000000000008', 'Faulkner House', 240),

  -- Bloom Nine Elms
  ('b0000000-0000-0000-0000-000000000021', 'd0000000-0000-0000-0000-000000000012', 'Bloom East', 263),
  ('b0000000-0000-0000-0000-000000000022', 'd0000000-0000-0000-0000-000000000012', 'Bloom West', 263),

  -- Grosvenor Waterside
  ('b0000000-0000-0000-0000-000000000023', 'd0000000-0000-0000-0000-000000000016', 'Cubitt Building', 75),
  ('b0000000-0000-0000-0000-000000000024', 'd0000000-0000-0000-0000-000000000016', 'Bramah House', 70),
  ('b0000000-0000-0000-0000-000000000025', 'd0000000-0000-0000-0000-000000000016', 'Caro Point', 68),
  ('b0000000-0000-0000-0000-000000000026', 'd0000000-0000-0000-0000-000000000016', 'Hepworth Court', 70),

  -- Battersea Exchange
  ('b0000000-0000-0000-0000-000000000027', 'd0000000-0000-0000-0000-000000000015', 'Patcham Terrace', 145),

  -- Keybridge
  ('b0000000-0000-0000-0000-000000000028', 'd0000000-0000-0000-0000-000000000019', 'Keybridge Tower', 298),
  ('b0000000-0000-0000-0000-000000000029', 'd0000000-0000-0000-0000-000000000019', 'Keybridge Lofts', 297);

-- =============================================================================
-- DEVELOPMENT LINKS (agent + freeholder per development)
-- =============================================================================
INSERT INTO development_links (development_id, managing_agent_id, freeholder_id, agent_confidence, freeholder_confidence, agent_source, freeholder_source) VALUES

  -- 1. Vista → Rendall & Rittner / Berkeley Group freeholder
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000016',
   'confirmed', 'high', 'Rendall & Rittner website & resident confirmation', 'Companies House CCOD'),

  -- 2. BPS Phase 1 → BPS Estate Management
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000002',
   'confirmed', 'confirmed', 'BPS Estates website', 'Companies House'),

  -- 3. Embassy Gardens → Ballymore Asset Management
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000003',
   'high', 'high', 'Ballymore website', 'Companies House'),

  -- 4. Riverlight → Rendall & Rittner
  ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000004',
   'confirmed', 'high', 'Rendall & Rittner website', 'Companies House CCOD'),

  -- 5. Prince of Wales Drive → RMG
  ('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000016',
   'high', 'high', 'Resident reports', 'Companies House CCOD'),

  -- 6. Chelsea Bridge Wharf → Rendall & Rittner
  ('d0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000005',
   'confirmed', 'confirmed', 'Rendall & Rittner website', 'Companies House'),

  -- 7. Battersea Reach → Rendall & Rittner
  ('d0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001',
   'confirmed', 'high', 'Rendall & Rittner website', 'Companies House CCOD'),

  -- 8. St George Wharf → Rendall & Rittner
  ('d0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000006',
   'confirmed', 'confirmed', 'Rendall & Rittner website & onsite plaque', 'Companies House'),

  -- 9. One Thames City → Cushman & Wakefield
  ('d0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000007',
   'high', 'high', 'Press release Nov 2025', 'Companies House CCOD'),

  -- 10. DAMAC Tower → Cushman & Wakefield
  ('d0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000008',
   'high', 'high', 'DAMAC website / industry reports', 'Companies House CCOD'),

  -- 11. Sky Gardens → RMG
  ('d0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000009',
   'high', 'high', 'Resident reports', 'Companies House CCOD'),

  -- 12. Bloom Nine Elms → Greystar
  ('d0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000010',
   'confirmed', 'confirmed', 'Greystar website', 'Companies House'),

  -- 13. Nine Elms Point → RMG
  ('d0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000011',
   'high', 'high', 'Resident reports', 'Companies House CCOD'),

  -- 14. London Square Nine Elms → RMG
  ('d0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000012',
   'high', 'high', 'London Square website', 'Companies House CCOD'),

  -- 15. Battersea Exchange → RMG
  ('d0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000013',
   'high', 'high', 'Resident reports', 'Companies House CCOD'),

  -- 16. Grosvenor Waterside → GWRC (self-managed)
  ('d0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-000000000014',
   'confirmed', 'confirmed', 'GWRC website', 'RTM company registration'),

  -- 17. Moda Embassy Boulevard → Moda Living
  ('d0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000015',
   'confirmed', 'confirmed', 'Moda Living website', 'Companies House'),

  -- 18. The Dumont → Rendall & Rittner
  ('d0000000-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000004',
   'high', 'high', 'Rendall & Rittner website', 'Companies House CCOD'),

  -- 19. Keybridge → RMG
  ('d0000000-0000-0000-0000-000000000019', 'a0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000017',
   'high', 'high', 'Mount Anvil handover docs', 'Companies House CCOD');
