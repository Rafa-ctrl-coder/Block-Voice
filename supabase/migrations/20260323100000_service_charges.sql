-- =============================================================================
-- Service Charge Analysis Tables
-- =============================================================================

-- Individual service charge line items (extracted from documents)
CREATE TABLE service_charge_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) NOT NULL,
  building_id uuid REFERENCES buildings(id) NOT NULL,
  invoice_number text,
  invoice_date date,
  description text NOT NULL,
  amount decimal(10,2) NOT NULL,
  period_type text NOT NULL, -- half_yearly_advance, deficit, surplus, insurance, other
  year_end text, -- for deficit/surplus: which year-end (e.g. '2024')
  document_url text, -- Supabase Storage path
  created_at timestamptz DEFAULT now()
);

-- Calculated annual totals (derived from line items)
CREATE TABLE service_charge_annuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) NOT NULL,
  building_id uuid REFERENCES buildings(id) NOT NULL,
  year text NOT NULL, -- e.g. '2024/25'
  annual_total decimal(10,2) NOT NULL,
  h1_total decimal(10,2),
  h2_total decimal(10,2),
  adjustment_total decimal(10,2) DEFAULT 0, -- deficit/surplus for this year
  created_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, building_id, year)
);

-- Property sizes
CREATE TABLE property_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) NOT NULL,
  building_id uuid REFERENCES buildings(id) NOT NULL,
  sqft int NOT NULL,
  sqm int,
  source text DEFAULT 'user_range', -- epc, user_range, user_exact
  confirmed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, building_id)
);

-- Regional benchmark cache
CREATE TABLE service_charge_benchmark (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region text NOT NULL,
  year text NOT NULL,
  avg_annual decimal(10,2),
  avg_per_sqft decimal(6,2),
  avg_monthly decimal(8,2),
  contributing_buildings int,
  contributing_residents int,
  calculated_at timestamptz DEFAULT now(),
  UNIQUE(region, year)
);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE service_charge_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_charge_annuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_charge_benchmark ENABLE ROW LEVEL SECURITY;

-- Users see own line items only
CREATE POLICY "Own lines" ON service_charge_lines
  FOR ALL USING (profile_id = auth.uid());

-- Users see own annuals only
CREATE POLICY "Own annuals" ON service_charge_annuals
  FOR ALL USING (profile_id = auth.uid());

-- Users see own property size
CREATE POLICY "Own size" ON property_sizes
  FOR ALL USING (profile_id = auth.uid());

-- Benchmark is readable by all authenticated users
CREATE POLICY "Read benchmark" ON service_charge_benchmark
  FOR SELECT USING (auth.role() = 'authenticated');

-- Indexes
CREATE INDEX idx_sc_lines_profile ON service_charge_lines(profile_id);
CREATE INDEX idx_sc_annuals_profile ON service_charge_annuals(profile_id);
CREATE INDEX idx_property_sizes_profile ON property_sizes(profile_id);
CREATE INDEX idx_benchmark_region_year ON service_charge_benchmark(region, year);
