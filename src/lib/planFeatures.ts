/**
 * SaaS plan feature catalog.
 *
 * V1 scaffolding only. Nothing in the app enforces these today — this exists
 * so a future phase can wrap gated UI with `hasFeature(tier, key)` without
 * hunting through the codebase for tier strings.
 */
export type PlanTier = 'starter' | 'growth' | 'partner' | 'enterprise';

export type FeatureKey =
  // Starter
  | 'dashboard'
  | 'client_records'
  | 'appointment_management'
  | 'front_desk'
  | 'staff_roles'
  | 'basic_visit_logs'
  | 'products_services_catalog'
  | 'whatsapp_booking_follow_up'
  | 'basic_reports'
  // Growth
  | 'practitioner_dashboard'
  | 'outreach_intake'
  | 'social_media_intake'
  | 'skin_analysis_engine'
  | 'ai_skin_analysis'
  | 'personalized_pdf_reports'
  | 'report_sharing'
  | 'staff_accountability_dashboard'
  | 'standard_analytics'
  | 'basic_customization'
  // Partner
  | 'advanced_analytics'
  | 'inventory_intelligence'
  | 'advanced_custom_branding'
  | 'priority_support'
  | 'monthly_optimization_review'
  | 'custom_workflows'
  | 'multi_location_ready'
  | 'early_ai_module_access'
  // Enterprise
  | 'custom_modules'
  | 'dedicated_onboarding'
  | 'strategic_support'
  | 'advanced_ai_customization';

const STARTER: FeatureKey[] = [
  'dashboard',
  'client_records',
  'appointment_management',
  'front_desk',
  'staff_roles',
  'basic_visit_logs',
  'products_services_catalog',
  'whatsapp_booking_follow_up',
  'basic_reports',
];

const GROWTH: FeatureKey[] = [
  ...STARTER,
  'practitioner_dashboard',
  'outreach_intake',
  'social_media_intake',
  'skin_analysis_engine',
  'ai_skin_analysis',
  'personalized_pdf_reports',
  'report_sharing',
  'staff_accountability_dashboard',
  'standard_analytics',
  'basic_customization',
];

const PARTNER: FeatureKey[] = [
  ...GROWTH,
  'advanced_analytics',
  'inventory_intelligence',
  'advanced_custom_branding',
  'priority_support',
  'monthly_optimization_review',
  'custom_workflows',
  'multi_location_ready',
  'early_ai_module_access',
];

const ENTERPRISE: FeatureKey[] = [
  ...PARTNER,
  'custom_modules',
  'dedicated_onboarding',
  'strategic_support',
  'advanced_ai_customization',
];

export const PLAN_FEATURES: Record<PlanTier, ReadonlySet<FeatureKey>> = {
  starter: new Set(STARTER),
  growth: new Set(GROWTH),
  partner: new Set(PARTNER),
  enterprise: new Set(ENTERPRISE),
};

export const PLAN_ORDER: PlanTier[] = ['starter', 'growth', 'partner', 'enterprise'];

export const PLAN_LABEL: Record<PlanTier, string> = {
  starter: 'Starter / Business Control',
  growth: 'Growth / Intelligence',
  partner: 'Partner / Scale',
  enterprise: 'Enterprise / Custom',
};

export const PLAN_PRICE_USD: Record<PlanTier, number> = {
  starter: 199,
  growth: 350,
  partner: 675,
  enterprise: 1000,
};

export const PLAN_BEST_FOR: Record<PlanTier, string> = {
  starter: 'For SMEs that need core structure, client records, appointments, and front desk control.',
  growth: 'For businesses ready to improve client journeys, reporting, outreach, and service intelligence.',
  partner: 'For serious operators using the platform as an operating system for client intelligence, reports, staff visibility, and growth.',
  enterprise: 'For multi-location, custom-heavy, or enterprise clients that need deeper implementation and strategic support.',
};

/** Enterprise pricing is shown as "from $X" — all other tiers are exact. */
export const PLAN_PRICE_IS_STARTING: Record<PlanTier, boolean> = {
  starter: false,
  growth: false,
  partner: false,
  enterprise: true,
};

/** Non-enforcing lookup — fail-open when tier is unknown. */
export const hasFeature = (tier: PlanTier | undefined, key: FeatureKey): boolean => {
  if (!tier) return true;
  return PLAN_FEATURES[tier].has(key);
};

/** USD formatter, drops fractional zeros for whole amounts. */
export const formatUsd = (n: number | null | undefined): string => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return `$${v}`;
  }
};

/** Formats an official plan price, prefixing "from " for tiers with starting-price pricing (Enterprise). */
export const formatPlanPrice = (tier: PlanTier | undefined, n: number | null | undefined): string => {
  const base = formatUsd(n);
  if (base === '—') return base;
  return tier && PLAN_PRICE_IS_STARTING[tier] ? `from ${base}` : base;
};