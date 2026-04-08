// =============================================================================
// Gemini prompts for community document analysis
//
// Each prompt instructs Gemini 2.5 Pro to return ONE JSON object with two
// top-level keys:
//
//   personal_analysis  — full detail (names, flat numbers, invoice refs, etc.)
//                        visible ONLY to the uploader in their dashboard
//   community_summary  — redacted structured summary with a stable schema per
//                        doc_type. Shared with the building community if the
//                        uploader opts in. NEVER contains PII.
//
// The server also whitelists community_summary keys against SUMMARY_FIELDS
// before persistence — belt-and-braces protection in case Gemini adds a rogue
// field like `resident_name`.
// =============================================================================

export const DOC_TYPES = [
  "service_charge",
  "lease",
  "buildings_insurance",
  "fire_safety",
  "section_20",
  "agent_letter",
  "annual_accounts",
] as const;

export type DocType = (typeof DOC_TYPES)[number];

// -----------------------------------------------------------------------------
// Per-type community_summary whitelist. The upload route drops unknown keys.
// Keep in sync with the schemas defined in each prompt below.
// -----------------------------------------------------------------------------
export const SUMMARY_FIELDS: Record<DocType, string[]> = {
  service_charge: [
    "year",
    "billing_frequency",
    "total_per_unit_band",
    "reserve_fund_portion_band",
    "insurance_portion_band",
    "biggest_cost_categories",
    "notable_increases",
  ],
  lease: [
    "term_years_remaining_band",
    "ground_rent_current_band",
    "ground_rent_review_clause",
    "break_clauses",
    "alterations_consent_required",
    "subletting_restrictions",
  ],
  buildings_insurance: [
    "insurer",
    "policy_year",
    "total_sum_insured_band",
    "excess_amounts_band",
    "key_exclusions",
    "renewal_month",
  ],
  fire_safety: [
    "report_type",
    "risk_rating",
    "critical_actions",
    "responsible_party_type",
    "next_review_month",
  ],
  section_20: [
    "project_description",
    "estimated_total_band",
    "per_unit_estimate_band",
    "stage",
    "consultation_deadline_month",
    "contractor_named",
  ],
  agent_letter: ["topic", "key_points", "action_required", "deadline_month"],
  annual_accounts: [
    "year_end",
    "total_expenditure_band",
    "surplus_or_deficit",
    "biggest_categories",
    "reserve_fund_balance_band",
    "auditor_name",
  ],
};

// -----------------------------------------------------------------------------
// Shared preamble — the hard redaction clause that every prompt reuses verbatim
// -----------------------------------------------------------------------------
const REDACTION_CLAUSE = `
CRITICAL — REDACTION RULES FOR community_summary:
- DO NOT include names, addresses, flat/apartment/unit numbers, email addresses,
  phone numbers, invoice or reference numbers, account numbers, or any
  personally identifying information.
- Replace any specific unit references in text with the literal string "[redacted]".
- Round monetary values to the nearest £100.
- For anything that could identify a specific unit (e.g. the uploader's own
  charge), use banded ranges: "under £5k", "£5k–£10k", "£10k–£15k",
  "£15k–£20k", "£20k–£30k", "£30k+".
- Dates use month + year only (e.g. "March 2025") — never a specific day.
- If a field cannot be determined from the document, use null (not an empty string).

The uploader's personal_analysis can contain everything — only community_summary
must be redacted and use banded values.

Return ONLY valid JSON. No markdown fences. No explanation.
`;

// -----------------------------------------------------------------------------
// Per-type prompts
// -----------------------------------------------------------------------------

const SERVICE_CHARGE_PROMPT = `You are analysing a UK residential service charge statement or demand document.

Extract the information and return ONE JSON object with this exact shape:

{
  "personal_analysis": {
    "property": "Apartment 33, Sophora House",
    "invoice_number": "686890",
    "invoice_date": "2025-12-08",
    "billing_period": "H2 2025/26",
    "billing_frequency": "half_yearly",
    "year": "2025/26",
    "total_charged": 5234.17,
    "line_items": [
      { "description": "Half Yearly Apt Service Charge", "amount": 2619.59, "category": "service_charge" }
    ],
    "biggest_categories": [
      { "category": "Insurance", "amount": 1200.00 }
    ],
    "managing_agent_named": "RMG",
    "notes": "Any relevant observations about the document"
  },
  "community_summary": {
    "year": "2025/26",
    "billing_frequency": "half_yearly",
    "total_per_unit_band": "£5k–£10k",
    "reserve_fund_portion_band": "£500–£1k",
    "insurance_portion_band": "£1k–£2k",
    "biggest_cost_categories": ["Insurance", "Estate services", "Apartment services"],
    "notable_increases": ["Insurance premium rose notably year-on-year"]
  }
}

billing_frequency must be one of: "annual", "half_yearly", "quarterly", "monthly".
${REDACTION_CLAUSE}`;

const LEASE_PROMPT = `You are analysing a UK residential flat lease (or lease extract).

Extract the information and return ONE JSON object with this exact shape:

{
  "personal_analysis": {
    "property": "Apartment 33, Sophora House",
    "lessor": "Harland (PC) Ltd",
    "lessee": "[name of lessee]",
    "lease_start_date": "2015-06-01",
    "term_years_total": 999,
    "term_years_remaining": 989,
    "ground_rent_current": 350,
    "ground_rent_review_clause": "Fixed at £350 per annum for the term",
    "break_clauses": ["None"],
    "alterations_consent_required": true,
    "subletting_restrictions": "Consent required for tenancies over 6 months",
    "service_charge_apportionment": "0.0918%",
    "key_covenants": ["No pets without consent", "No business use"],
    "notes": "Any relevant observations"
  },
  "community_summary": {
    "term_years_remaining_band": "900+ years",
    "ground_rent_current_band": "£250–£500",
    "ground_rent_review_clause": "Fixed — no review",
    "break_clauses": ["None"],
    "alterations_consent_required": true,
    "subletting_restrictions": "Consent required for tenancies over 6 months"
  }
}

term_years_remaining_band: "under 80", "80–99", "100–124", "125+", "900+ years".
ground_rent_current_band: "Peppercorn", "under £100", "£100–£250", "£250–£500", "£500–£1k", "£1k+".
${REDACTION_CLAUSE}`;

const BUILDINGS_INSURANCE_PROMPT = `You are analysing a UK residential buildings insurance policy schedule or certificate.

Extract the information and return ONE JSON object with this exact shape:

{
  "personal_analysis": {
    "property": "[name of the development/building]",
    "insurer": "Aviva",
    "policy_number": "ABC123456",
    "policy_year": "2025",
    "period_from": "2025-04-01",
    "period_to": "2026-03-31",
    "total_sum_insured": 45000000,
    "premium_total": 280000,
    "excess_amounts": { "standard": 500, "subsidence": 2500 },
    "key_exclusions": ["Wear and tear", "Terrorism (separate policy)"],
    "broker": "Gallagher",
    "notes": "Any relevant observations"
  },
  "community_summary": {
    "insurer": "Aviva",
    "policy_year": "2025",
    "total_sum_insured_band": "£40m–£60m",
    "excess_amounts_band": "£500 standard",
    "key_exclusions": ["Wear and tear", "Terrorism (separate policy)"],
    "renewal_month": "April 2026"
  }
}

total_sum_insured_band: "under £5m", "£5m–£10m", "£10m–£20m", "£20m–£40m", "£40m–£60m", "£60m+".
${REDACTION_CLAUSE}`;

const FIRE_SAFETY_PROMPT = `You are analysing a UK residential fire safety document — a Fire Risk Assessment (FRA),
EWS1 (external wall system) form, or similar fire safety report.

Extract the information and return ONE JSON object with this exact shape:

{
  "personal_analysis": {
    "property": "[building name]",
    "report_type": "Fire Risk Assessment",
    "report_date": "2025-06-15",
    "assessor": "[assessor name/company]",
    "risk_rating": "Moderate",
    "critical_actions": [
      { "action": "Replace compartment line sealant on 8th floor", "priority": "high", "deadline": "2025-09-30" }
    ],
    "responsible_party": "Building owner / managing agent",
    "next_review_date": "2026-06-15",
    "ews1_rating": null,
    "notes": "Any relevant observations"
  },
  "community_summary": {
    "report_type": "Fire Risk Assessment",
    "risk_rating": "Moderate",
    "critical_actions": [
      "High priority: replace compartment line sealant on common areas"
    ],
    "responsible_party_type": "Managing agent",
    "next_review_month": "June 2026"
  }
}

report_type: one of "Fire Risk Assessment", "EWS1", "External Wall Survey", "Combustibility Report", "Other".
risk_rating: "Low", "Moderate", "Substantial", "High", "Unknown".
${REDACTION_CLAUSE}`;

const SECTION_20_PROMPT = `You are analysing a UK Section 20 notice — a consultation document about
major works a managing agent or freeholder is proposing.

Extract the information and return ONE JSON object with this exact shape:

{
  "personal_analysis": {
    "property": "[building name]",
    "notice_stage": "Notice of Intention",
    "project_description": "Replacement of lift in Sophora House",
    "estimated_total": 125000,
    "estimated_per_unit": 850,
    "consultation_deadline": "2025-08-30",
    "contractors": [
      { "name": "LiftCo Ltd", "estimate": 125000 }
    ],
    "start_date": "2025-11-01",
    "expected_duration": "6 weeks",
    "notes": "Any relevant observations"
  },
  "community_summary": {
    "project_description": "Replacement of lift in a block",
    "estimated_total_band": "£100k–£200k",
    "per_unit_estimate_band": "£500–£1k",
    "stage": "Notice of Intention",
    "consultation_deadline_month": "August 2025",
    "contractor_named": true
  }
}

stage must be one of: "Notice of Intention", "Notification of Estimates", "Notification of Award", "Final Notice".
estimated_total_band: "under £50k", "£50k–£100k", "£100k–£200k", "£200k–£500k", "£500k+".
per_unit_estimate_band: "under £500", "£500–£1k", "£1k–£2k", "£2k–£5k", "£5k+".
${REDACTION_CLAUSE}`;

const AGENT_LETTER_PROMPT = `You are analysing a letter or circular from a UK managing agent or freeholder
to residents of a development.

Extract the information and return ONE JSON object with this exact shape:

{
  "personal_analysis": {
    "from": "RMG",
    "date": "2025-03-15",
    "addressee": "The Leaseholder, Apartment 33",
    "topic": "Planned maintenance of the communal hot water system",
    "full_summary": "2-3 sentence plain-English summary of what the letter says",
    "key_points": ["Hot water will be off between 9am and 4pm on 22nd March", "No action needed from residents"],
    "action_required": "None",
    "deadline": null,
    "contact": "[contact phone/email if given]",
    "notes": "Any relevant observations"
  },
  "community_summary": {
    "topic": "Planned maintenance of the communal hot water system",
    "key_points": ["Hot water will be off for approximately 7 hours on one day in March 2025", "No action needed from residents"],
    "action_required": "None",
    "deadline_month": null
  }
}
${REDACTION_CLAUSE}`;

const ANNUAL_ACCOUNTS_PROMPT = `You are analysing UK residential year-end service charge accounts.

Extract the information and return ONE JSON object with this exact shape:

{
  "personal_analysis": {
    "property": "[building/development name]",
    "year_end": "2024-12-31",
    "accountant": "TC Group",
    "total_expenditure": 2359083,
    "total_income": 2286667,
    "surplus_or_deficit": -72416,
    "biggest_categories": [
      { "category": "Staff Wages", "amount": 473949 },
      { "category": "Buildings Insurance", "amount": 385380 }
    ],
    "reserve_fund_balance": 832783,
    "notes": "Any relevant observations"
  },
  "community_summary": {
    "year_end": "December 2024",
    "total_expenditure_band": "£2m–£3m",
    "surplus_or_deficit": "deficit",
    "biggest_categories": ["Staff Wages", "Buildings Insurance", "Gym & Pool", "Reserve Fund"],
    "reserve_fund_balance_band": "£500k–£1m",
    "auditor_name": "TC Group"
  }
}

total_expenditure_band: "under £500k", "£500k–£1m", "£1m–£2m", "£2m–£3m", "£3m–£5m", "£5m+".
reserve_fund_balance_band: "under £100k", "£100k–£500k", "£500k–£1m", "£1m–£3m", "£3m+".
surplus_or_deficit: "surplus", "deficit", or "balanced".
${REDACTION_CLAUSE}`;

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------
const PROMPTS: Record<DocType, string> = {
  service_charge: SERVICE_CHARGE_PROMPT,
  lease: LEASE_PROMPT,
  buildings_insurance: BUILDINGS_INSURANCE_PROMPT,
  fire_safety: FIRE_SAFETY_PROMPT,
  section_20: SECTION_20_PROMPT,
  agent_letter: AGENT_LETTER_PROMPT,
  annual_accounts: ANNUAL_ACCOUNTS_PROMPT,
};

export function getPrompt(docType: DocType): string {
  return PROMPTS[docType];
}

export function isValidDocType(value: unknown): value is DocType {
  return typeof value === "string" && (DOC_TYPES as readonly string[]).includes(value);
}

/**
 * Whitelists community_summary keys against the per-type schema.
 * Drops any unknown fields (PII guard).
 */
export function filterCommunitySummary(
  docType: DocType,
  raw: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const allowed = SUMMARY_FIELDS[docType];
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in raw) out[key] = raw[key];
  }
  return out;
}
