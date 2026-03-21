-- =============================================================================
-- Fix buildings with NULL development_name by matching postcodes
-- Many buildings were created during signup without a development_name.
-- This links them to the correct development using postcode matching.
-- =============================================================================

-- Vista, Chelsea Bridge (postcodes: SW11 8BY, SW11 8BW, SW11 8AZ, SW11 8NS, SW11 8EW)
UPDATE buildings SET development_name = 'Vista, Chelsea Bridge'
WHERE development_name IS NULL
  AND UPPER(REPLACE(postcode, ' ', '')) IN ('SW118BY', 'SW118BW', 'SW118AZ', 'SW118NS', 'SW118EW');

-- Also match partial names
UPDATE buildings SET development_name = 'Vista, Chelsea Bridge'
WHERE development_name IS NULL
  AND (LOWER(name) LIKE '%vista%' OR LOWER(name) LIKE '%sophora%' OR LOWER(name) LIKE '%altissima%'
       OR LOWER(name) LIKE '%camellia%' OR LOWER(name) LIKE '%cascade%' OR LOWER(name) LIKE '%valetta%');

-- Fix existing records with wrong/partial development names
UPDATE buildings SET development_name = 'Vista, Chelsea Bridge'
WHERE development_name IN ('Vista Apartments', 'Vista', 'Vista, Chelsea Bridge Wharf');

-- Circus West Village / BPS Phase 1
UPDATE buildings SET development_name = 'Circus West Village (BPS Phase 1)'
WHERE development_name IS NULL
  AND UPPER(REPLACE(postcode, ' ', '')) IN ('SW118EZ', 'SW118BD', 'SW118AH', 'SW118EU', 'SW118BJ');

UPDATE buildings SET development_name = 'Circus West Village (BPS Phase 1)'
WHERE development_name IS NULL
  AND (LOWER(name) LIKE '%circus west%' OR LOWER(name) LIKE '%battersea power%' OR LOWER(name) LIKE '%bps%'
       OR LOWER(name) LIKE '%fladgate%' OR LOWER(name) LIKE '%switch house%' OR LOWER(name) LIKE '%boiler house%');

-- Embassy Gardens
UPDATE buildings SET development_name = 'Embassy Gardens'
WHERE development_name IS NULL
  AND UPPER(REPLACE(postcode, ' ', '')) IN ('SW117AY', 'SW85BL', 'SW85AD', 'SW117AQ');

UPDATE buildings SET development_name = 'Embassy Gardens'
WHERE development_name IS NULL
  AND LOWER(name) LIKE '%embassy garden%';

-- Riverlight
UPDATE buildings SET development_name = 'Riverlight'
WHERE development_name IS NULL
  AND UPPER(REPLACE(postcode, ' ', '')) IN ('SW118AU', 'SW118AW', 'SW118BE', 'SW118BF', 'SW118DG', 'SW118DW', 'SW118EA', 'SW118EB');

UPDATE buildings SET development_name = 'Riverlight'
WHERE development_name IS NULL
  AND LOWER(name) LIKE '%riverlight%';

-- Prince of Wales Drive
UPDATE buildings SET development_name = 'Prince of Wales Drive'
WHERE development_name IS NULL
  AND UPPER(REPLACE(postcode, ' ', '')) IN ('SW114FA', 'SW114EJ');

UPDATE buildings SET development_name = 'Prince of Wales Drive'
WHERE development_name IS NULL
  AND LOWER(name) LIKE '%prince of wales%';

-- Chelsea Bridge Wharf
UPDATE buildings SET development_name = 'Chelsea Bridge Wharf'
WHERE development_name IS NULL
  AND UPPER(REPLACE(postcode, ' ', '')) IN ('SW84NR', 'SW84NN', 'SW84NU');

UPDATE buildings SET development_name = 'Chelsea Bridge Wharf'
WHERE development_name IS NULL
  AND LOWER(name) LIKE '%chelsea bridge wharf%';

-- Battersea Reach
UPDATE buildings SET development_name = 'Battersea Reach'
WHERE development_name IS NULL
  AND UPPER(REPLACE(postcode, ' ', '')) IN ('SW181TA', 'SW181TS', 'SW181TX', 'SW181TY', 'SW181JE', 'SW181FR');

-- St George Wharf
UPDATE buildings SET development_name = 'St George Wharf'
WHERE development_name IS NULL
  AND UPPER(REPLACE(postcode, ' ', '')) IN ('SW82LE', 'SW82LU', 'SW82LW', 'SW82LS');

UPDATE buildings SET development_name = 'St George Wharf'
WHERE development_name IS NULL
  AND LOWER(name) LIKE '%st george wharf%';

-- DAMAC Tower
UPDATE buildings SET development_name = 'DAMAC Tower'
WHERE development_name IS NULL
  AND UPPER(REPLACE(postcode, ' ', '')) IN ('SW81GS', 'SW81GR');

UPDATE buildings SET development_name = 'DAMAC Tower'
WHERE development_name IS NULL
  AND LOWER(name) LIKE '%damac%';

-- Vauxhall Sky Gardens
UPDATE buildings SET development_name = 'Vauxhall Sky Gardens'
WHERE development_name IS NULL
  AND UPPER(REPLACE(postcode, ' ', '')) IN ('SW82FZ', 'SW82FY', 'SW82LY', 'SW82TG');

-- Bloom Nine Elms
UPDATE buildings SET development_name = 'Bloom Nine Elms'
WHERE development_name IS NULL
  AND UPPER(REPLACE(postcode, ' ', '')) IN ('SW117DS', 'SW117DG');

-- Nine Elms Point
UPDATE buildings SET development_name = 'Nine Elms Point'
WHERE development_name IS NULL
  AND UPPER(REPLACE(postcode, ' ', '')) IN ('SW82LF', 'SW82FN', 'SW82FR');

-- London Square Nine Elms
UPDATE buildings SET development_name = 'London Square Nine Elms'
WHERE development_name IS NULL
  AND UPPER(REPLACE(postcode, ' ', '')) IN ('SW117BA', 'SW117AB');

-- Battersea Exchange
UPDATE buildings SET development_name = 'Battersea Exchange'
WHERE development_name IS NULL
  AND UPPER(REPLACE(postcode, ' ', '')) IN ('SW84LR', 'SW84EX', 'SW84EY', 'SW84BE');

-- Grosvenor Waterside
UPDATE buildings SET development_name = 'Grosvenor Waterside'
WHERE development_name IS NULL
  AND UPPER(REPLACE(postcode, ' ', '')) IN ('SW1W8QN', 'SW1W8DP', 'SW1W8DU', 'SW1W8DE');

-- Moda, Embassy Boulevard
UPDATE buildings SET development_name = 'Moda, Embassy Boulevard'
WHERE development_name IS NULL
  AND UPPER(REPLACE(postcode, ' ', '')) IN ('SW117FD');

-- The Dumont
UPDATE buildings SET development_name = 'The Dumont'
WHERE development_name IS NULL
  AND UPPER(REPLACE(postcode, ' ', '')) IN ('SE17TJ', 'SE17AQ');

UPDATE buildings SET development_name = 'The Dumont'
WHERE development_name IS NULL
  AND LOWER(name) LIKE '%dumont%';

-- Keybridge
UPDATE buildings SET development_name = 'Keybridge'
WHERE development_name IS NULL
  AND UPPER(REPLACE(postcode, ' ', '')) IN ('SW81RG', 'SW81DF', 'SW81BQ', 'SW81BP');

UPDATE buildings SET development_name = 'Keybridge'
WHERE development_name IS NULL
  AND LOWER(name) LIKE '%keybridge%';

-- One Thames City
UPDATE buildings SET development_name = 'One Thames City'
WHERE development_name IS NULL
  AND UPPER(REPLACE(postcode, ' ', '')) IN ('SW85FS', 'SW85FT');
