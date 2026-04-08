// Database types matching the BlockVoice schema

export type ConfidenceLevel = 'confirmed' | 'high' | 'medium' | 'low';
export type DevelopmentStatus = 'complete' | 'partially_complete' | 'under_construction';
export type IssueCategory = 'facilities' | 'maintenance' | 'service_charge' | 'security' | 'safety' | 'communal_areas' | 'communication' | 'other';
export type IssueStatus = 'new' | 'acknowledged' | 'in_progress' | 'resolved' | 'escalated';
export type EvidenceFileType = 'image' | 'pdf' | 'document';
export type CorrectionStatus = 'pending' | 'accepted' | 'rejected';
export type UserRole = 'resident' | 'admin';

export interface Development {
  id: string;
  name: string;
  slug: string;
  postcodes: string[];
  address: string | null;
  lat: number | null;
  lng: number | null;
  total_units: number;
  developer: string | null;
  status: DevelopmentStatus;
  created_at: string;
  updated_at: string;
}

export interface Block {
  id: string;
  development_id: string;
  name: string;
  total_units: number;
  created_at: string;
}

export interface Unit {
  id: string;
  block_id: string;
  development_id: string;
  uprn: string | null;
  flat_number: string;
  floor: number | null;
  created_at: string;
}

export interface ManagingAgent {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  companies_house_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface Freeholder {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  companies_house_number: string | null;
  parent_company: string | null;
  created_at: string;
  updated_at: string;
}

export interface DevelopmentLink {
  id: string;
  development_id: string;
  managing_agent_id: string | null;
  freeholder_id: string | null;
  agent_confidence: ConfidenceLevel;
  freeholder_confidence: ConfidenceLevel;
  agent_source: string | null;
  freeholder_source: string | null;
  created_at: string;
  updated_at: string;
}

export interface Issue {
  id: string;
  development_id: string;
  block_id: string | null;
  raised_by: string;
  title: string;
  description: string | null;
  category: IssueCategory;
  status: IssueStatus;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface IssueEvidence {
  id: string;
  issue_id: string;
  uploaded_by: string;
  file_url: string;
  file_type: EvidenceFileType;
  caption: string | null;
  created_at: string;
}

export interface IssueSupporter {
  id: string;
  issue_id: string;
  user_id: string;
  created_at: string;
}

export interface Correction {
  id: string;
  development_id: string;
  submitted_by: string | null;
  field: string;
  current_value: string;
  suggested_value: string;
  status: CorrectionStatus;
  created_at: string;
}

// Service Charge types
export type PeriodType = 'half_yearly_advance' | 'deficit' | 'surplus' | 'insurance' | 'other';
export type PropertySizeSource = 'epc' | 'user_range' | 'user_exact';

export interface ServiceChargeLine {
  id: string;
  profile_id: string;
  building_id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  description: string;
  amount: number;
  period_type: PeriodType;
  year_end: string | null;
  document_url: string | null;
  created_at: string;
}

export interface ServiceChargeAnnual {
  id: string;
  profile_id: string;
  building_id: string;
  year: string;
  annual_total: number;
  h1_total: number | null;
  h2_total: number | null;
  adjustment_total: number;
  is_half_yearly: boolean;
  has_both_halves: boolean;
  quarter_count: number;
  created_at: string;
}

export interface PropertySize {
  id: string;
  profile_id: string;
  building_id: string;
  sqft: number;
  sqm: number | null;
  source: PropertySizeSource;
  confirmed: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceChargeBenchmark {
  id: string;
  region: string;
  year: string;
  avg_annual: number | null;
  avg_per_sqft: number | null;
  avg_monthly: number | null;
  contributing_buildings: number | null;
  contributing_residents: number | null;
  calculated_at: string;
}

// =========================================================================
// Community documents
// =========================================================================
export type CommunityDocType =
  | 'service_charge'
  | 'lease'
  | 'buildings_insurance'
  | 'fire_safety'
  | 'section_20'
  | 'agent_letter'
  | 'annual_accounts';

export type CommunityDocStatus = 'analysing' | 'ready' | 'failed';

export interface CommunityDocumentType {
  id: CommunityDocType;
  label: string;
  description: string | null;
  sort_order: number;
  icon: string | null;
}

export interface CommunityDocument {
  id: string;
  profile_id: string;
  building_id: string;
  development_name: string;
  doc_type: CommunityDocType;
  original_filename: string;
  storage_path: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  status: CommunityDocStatus;
  analysis_error: string | null;
  personal_analysis: Record<string, unknown> | null;
  community_summary: Record<string, unknown> | null;
  is_shared: boolean;
  shared_at: string | null;
  champion_handle: string | null;
  document_date: string | null;
  created_at: string;
  updated_at: string;
}

// Joined types for common queries
export interface DevelopmentWithLinks extends Development {
  development_links: (DevelopmentLink & {
    managing_agents: ManagingAgent | null;
    freeholders: Freeholder | null;
  })[];
  blocks: Block[];
}
