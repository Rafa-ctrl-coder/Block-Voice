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

// Joined types for common queries
export interface DevelopmentWithLinks extends Development {
  development_links: (DevelopmentLink & {
    managing_agents: ManagingAgent | null;
    freeholders: Freeholder | null;
  })[];
  blocks: Block[];
}
