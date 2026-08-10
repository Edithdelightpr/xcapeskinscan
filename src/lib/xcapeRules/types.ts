/**
 * XCAPE recommendation criteria — shared types for the versioned rule layer.
 *
 * These mirror the Phase 3 tables (xcape_recommendation_rules,
 * xcape_rule_versions, xcape_protocols, xcape_contraindications,
 * xcape_recommendation_proposals). The generated Supabase types do not
 * include the new tables yet, so hooks cast at the boundary and expose
 * these strict types instead.
 */

export type RuleStatus = 'draft' | 'published' | 'inactive' | 'archived';
export type VersionStatus = 'published' | 'inactive' | 'archived';
export type ProtocolStatus = 'draft' | 'active' | 'archived';
export type ContraindicationStatus = 'draft' | 'active' | 'archived';
export type ContraindicationSeverity = 'caution' | 'warning' | 'block';
export type ProposalStatus = 'proposed' | 'accepted' | 'edited' | 'rejected';

export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'gte'
  | 'lte'
  | 'between'
  | 'is_true'
  | 'is_false'
  | 'present'
  | 'absent';

export interface RuleCondition {
  field: string;
  operator: ConditionOperator;
  /** Raw admin-entered value. Numbers/ranges/lists are parsed at evaluation. */
  value?: string;
}

export interface RuleConditionGroup {
  /** all = every condition must pass (AND). any = at least one (OR). */
  combinator: 'all' | 'any';
  conditions: RuleCondition[];
}

/** Groups are always joined with AND — predictable for non-technical admins. */
export interface RuleConditions {
  groups: RuleConditionGroup[];
}

export interface RuleOutputService {
  service_id?: string | null;
  name: string;
  sessions?: number | null;
  note?: string | null;
}

export interface RuleOutputProduct {
  product_id?: string | null;
  name: string;
  note?: string | null;
}

/** One provisional dose tier: a score range mapped to an active dose in ml. */
export interface DoseTier {
  score_min: number;
  score_max: number;
  dose_ml: number;
}

/**
 * Formula customization output — when a rule matches, this tells the
 * evaluator to resolve a concrete XCAPE customization formula for one of
 * the four analysis categories. The kit, base product, active solution and
 * companion come from the admin-maintained category mapping (never from
 * free text); the dose comes from these versioned tiers. Tiers remain
 * draft/inactive with the rule until clinically confirmed.
 */
export interface RuleCustomization {
  /** One of the four XCAPE score keys (ENGINE_SCORE_KEYS). */
  category: string;
  dose_tiers: DoseTier[];
  instructions?: string | null;
  warnings?: string[];
}

export interface RuleOutputs {
  protocol_ids?: string[];
  protocols_text?: { name: string; note?: string | null }[];
  services?: RuleOutputService[];
  products?: RuleOutputProduct[];
  frequency?: string | null;
  duration?: string | null;
  sessions?: number | null;
  home_care?: string | null;
  follow_up_weeks?: number | null;
  warnings?: string[];
  alternatives?: string[];
  requires_human_review?: boolean;
  rationale?: string | null;
  customization?: RuleCustomization | null;
}

export interface XcapeRule {
  id: string;
  name: string;
  description: string | null;
  status: RuleStatus;
  priority: number;
  current_version: number;
  draft_conditions: RuleConditions;
  draft_outputs: RuleOutputs;
  is_demo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface XcapeRuleVersion {
  id: string;
  rule_id: string;
  version: number;
  status: VersionStatus;
  conditions: RuleConditions;
  outputs: RuleOutputs;
  change_note: string | null;
  published_by: string | null;
  published_at: string;
  created_at: string;
}

export interface XcapeProtocol {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  status: ProtocolStatus;
  steps: string[];
  frequency: string | null;
  duration: string | null;
  sessions: number | null;
  home_care: string | null;
  follow_up_weeks: number | null;
  linked_service_ids: string[];
  linked_product_ids: string[];
  is_demo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface XcapeContraindication {
  id: string;
  name: string;
  target_kind: 'protocol' | 'product' | 'ingredient' | 'service';
  target_name: string | null;
  target_id: string | null;
  severity: ContraindicationSeverity;
  message: string;
  status: ContraindicationStatus;
  is_demo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface XcapeProposal {
  id: string;
  assessment_id: string;
  client_id: string;
  rule_id: string | null;
  rule_version_id: string | null;
  rule_version: number | null;
  rule_name: string | null;
  engine_version: string | null;
  matched_reasons: string[];
  proposal: RuleOutputs;
  status: ProposalStatus;
  final_result: RuleOutputs | null;
  decision_reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface XcapeRuleAuditEntry {
  id: string;
  rule_id: string;
  action: string;
  actor: string | null;
  snapshot: unknown;
  created_at: string;
}

/* ---------- Condition builder field registry ---------- */

export interface ConditionFieldDef {
  key: string;
  label: string;
  group: string;
  kind: 'number' | 'text' | 'select' | 'boolean' | 'list';
  operators: ConditionOperator[];
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export const ENGINE_SCORE_KEYS = [
  'pigmentation_stability',
  'barrier_surface_hydration',
  'firmness_skin_support',
  'oil_congestion_balance',
] as const;

export const ENGINE_SCORE_LABELS: Record<string, string> = {
  pigmentation_stability: 'Pigmentation',
  barrier_surface_hydration: 'Barrier / hydration',
  firmness_skin_support: 'Firmness / support',
  oil_congestion_balance: 'Oil / congestion',
};

const NUM_OPS: ConditionOperator[] = ['gte', 'lte', 'between', 'eq', 'neq', 'present', 'absent'];
const TEXT_OPS: ConditionOperator[] = ['contains', 'not_contains', 'eq', 'neq', 'in', 'present', 'absent'];
const BOOL_OPS: ConditionOperator[] = ['is_true', 'is_false'];
const LIST_OPS: ConditionOperator[] = ['contains', 'not_contains', 'in', 'present', 'absent'];
const BAND_OPS: ConditionOperator[] = ['eq', 'neq', 'in'];

const SEVERITY_BAND_OPTIONS = [
  { value: 'minimal', label: 'Minimal (0–20)' },
  { value: 'mild', label: 'Mild (21–40)' },
  { value: 'moderate', label: 'Moderate (41–60)' },
  { value: 'significant', label: 'Significant (61–80)' },
  { value: 'high_priority', label: 'High priority (81–100)' },
];

const FITZPATRICK_OPTIONS = ['I', 'II', 'III', 'IV', 'V', 'VI'].map((v) => ({
  value: v,
  label: `Type ${v}`,
}));

const OBSERVED_FINDING_OPTIONS = [
  'Sun exposure',
  'Post-inflammatory marks',
  'Acne history',
  'Product irritation',
  'Barrier damage',
  'Dehydration',
  'Hormonal changes',
  'Excess oil activity',
  'Aging / reduced firmness',
  'Poor home-care routine',
  'Unknown / needs monitoring',
].map((v) => ({ value: v, label: v }));

export const CONDITION_FIELDS: ConditionFieldDef[] = [
  // XCAPE scores (0–100 practitioner-adjusted)
  ...ENGINE_SCORE_KEYS.map((k): ConditionFieldDef => ({
    key: `score.${k}`,
    label: `${ENGINE_SCORE_LABELS[k]} score`,
    group: 'XCAPE scores',
    kind: 'number',
    operators: NUM_OPS,
    placeholder: 'e.g. 60',
  })),
  // Severity bands derived from the same scores
  ...ENGINE_SCORE_KEYS.map((k): ConditionFieldDef => ({
    key: `band.${k}`,
    label: `${ENGINE_SCORE_LABELS[k]} band`,
    group: 'Score severity bands',
    kind: 'select',
    operators: BAND_OPS,
    options: SEVERITY_BAND_OPTIONS,
  })),
  {
    key: 'analysis.priority_concern',
    label: 'Priority concern',
    group: 'Analysis findings',
    kind: 'select',
    operators: ['eq', 'neq', 'in', 'present'],
    options: ENGINE_SCORE_KEYS.map((k) => ({ value: k, label: ENGINE_SCORE_LABELS[k] })),
  },
  {
    key: 'analysis.main_visible_concern',
    label: 'Main visible concern',
    group: 'Analysis findings',
    kind: 'text',
    operators: TEXT_OPS,
    placeholder: 'e.g. hyperpigmentation',
  },
  {
    key: 'analysis.skin_type',
    label: 'Skin type',
    group: 'Analysis findings',
    kind: 'text',
    operators: TEXT_OPS,
    placeholder: 'e.g. oily',
  },
  {
    key: 'analysis.observed_findings',
    label: 'Observed findings / causes',
    group: 'Analysis findings',
    kind: 'list',
    operators: LIST_OPS,
    options: OBSERVED_FINDING_OPTIONS,
    placeholder: 'e.g. Sun exposure',
  },
  {
    key: 'analysis.image_quality_usable',
    label: 'AI image quality usable',
    group: 'Analysis findings',
    kind: 'boolean',
    operators: BOOL_OPS,
  },
  ...ENGINE_SCORE_KEYS.map((k): ConditionFieldDef => ({
    key: `ai_score.${k}`,
    label: `AI-suggested ${ENGINE_SCORE_LABELS[k].toLowerCase()} score`,
    group: 'AI confidence',
    kind: 'number',
    operators: NUM_OPS,
    placeholder: 'e.g. 55',
  })),
  // Practitioner flags
  {
    key: 'practitioner.red_flags',
    label: 'Practitioner red flags',
    group: 'Practitioner notes & flags',
    kind: 'text',
    operators: TEXT_OPS,
    placeholder: 'e.g. irritation',
  },
  {
    key: 'practitioner.observation',
    label: 'Practitioner observation',
    group: 'Practitioner notes & flags',
    kind: 'text',
    operators: TEXT_OPS,
  },
  // Intake / safety
  {
    key: 'intake.fitzpatrick',
    label: 'Fitzpatrick type',
    group: 'Client intake',
    kind: 'select',
    operators: ['eq', 'neq', 'in', 'present'],
    options: FITZPATRICK_OPTIONS,
  },
  {
    key: 'intake.skin_self_type',
    label: 'Client-described skin type',
    group: 'Client intake',
    kind: 'text',
    operators: TEXT_OPS,
  },
  {
    key: 'intake.allergies',
    label: 'Allergies',
    group: 'Client intake',
    kind: 'text',
    operators: TEXT_OPS,
    placeholder: 'e.g. retinol',
  },
  {
    key: 'intake.medications',
    label: 'Medications / supplements',
    group: 'Client intake',
    kind: 'text',
    operators: TEXT_OPS,
  },
  {
    key: 'intake.pregnancy',
    label: 'Pregnancy',
    group: 'Safety',
    kind: 'boolean',
    operators: BOOL_OPS,
  },
  {
    key: 'intake.breastfeeding',
    label: 'Breastfeeding',
    group: 'Safety',
    kind: 'boolean',
    operators: BOOL_OPS,
  },
  {
    key: 'intake.active_conditions',
    label: 'Active conditions',
    group: 'Safety',
    kind: 'text',
    operators: TEXT_OPS,
    placeholder: 'e.g. eczema',
  },
  {
    key: 'intake.on_retinoids',
    label: 'On retinoids',
    group: 'Safety',
    kind: 'boolean',
    operators: BOOL_OPS,
  },
  {
    key: 'intake.on_blood_thinners',
    label: 'On blood thinners',
    group: 'Safety',
    kind: 'boolean',
    operators: BOOL_OPS,
  },
  {
    key: 'intake.previous_procedures',
    label: 'Previous procedures / treatments',
    group: 'Client intake',
    kind: 'text',
    operators: TEXT_OPS,
    placeholder: 'e.g. chemical peel',
  },
  {
    key: 'intake.keloid_tendency',
    label: 'Keloid tendency',
    group: 'Safety',
    kind: 'boolean',
    operators: BOOL_OPS,
  },
  {
    key: 'intake.sun_exposure',
    label: 'Recent significant sun exposure',
    group: 'Client intake',
    kind: 'boolean',
    operators: BOOL_OPS,
  },
  {
    key: 'intake.sun_habits',
    label: 'Sun habits',
    group: 'Client intake',
    kind: 'text',
    operators: TEXT_OPS,
  },
  {
    key: 'intake.current_routine',
    label: 'Current skincare routine',
    group: 'Client intake',
    kind: 'text',
    operators: TEXT_OPS,
  },
];

export const fieldDef = (key: string) => CONDITION_FIELDS.find((f) => f.key === key);

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  eq: 'is',
  neq: 'is not',
  contains: 'contains',
  not_contains: 'does not contain',
  in: 'is one of',
  gte: 'is at least',
  lte: 'is at most',
  between: 'is between',
  is_true: 'is yes',
  is_false: 'is no',
  present: 'has a value',
  absent: 'has no value',
};
