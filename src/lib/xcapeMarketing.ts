/**
 * XCAPE public marketing copy — single source of truth for landing claims.
 *
 * IMPORTANT: research figures and their phrasing are PENDING confirmation
 * from clinical leadership (formal research vs. professional observation vs.
 * analysed clients vs. collected profiles vs. published evidence). Until
 * confirmed, edit values and labels HERE ONLY — never hardcode them inside
 * components.
 */

export const XCAPE_RESEARCH_CLAIMS = {
  /** Years behind the standard — classification pending confirmation. */
  years: 17,
  yearsLabel: 'Years of professional skin practice',
  /** Skin profiles behind the standard — classification pending confirmation. */
  profiles: 10000,
  profilesDisplay: '10,000+',
  profilesLabel: 'Skin profiles collected across Africa',
} as const;

/** Neutral positioning line — no diagnostic or regulated-medical claims. */
export const XCAPE_DISCLAIMER =
  'XCAPE supports professional skin assessment. It does not provide medical diagnosis and does not replace consultation with a qualified medical professional.';

export type XcapeJoinRole = 'affiliate' | 'cdp' | 'ambassador' | 'team';

export interface XcapeRole {
  role: XcapeJoinRole;
  name: string;
  tagline: string;
  description: string;
  cta: string;
  /** Public join paths appear as landing-page cards; internal ones don't. */
  publicPath: boolean;
}

/** The public join paths. Distinction must stay unmistakable. */
export const XCAPE_ROLES: XcapeRole[] = [
  {
    role: 'affiliate',
    name: 'Affiliate',
    tagline: 'Free · instant scanner access',
    description:
      'Free to join. Your XCAPE Affiliate account is active the moment you sign up — run skin analyses, share reports and earn on what you refer.',
    cta: 'Sign up as an Affiliate',
    publicPath: true,
  },
  {
    role: 'cdp',
    name: 'Certified Distribution Partner',
    tagline: 'For approved locations · approval required',
    description:
      'Operate XCAPE analysis and product services from a physical location. Applications are reviewed by XCAPE before your location goes live.',
    cta: 'Apply as a Partner Location',
    publicPath: true,
  },
  {
    // Team / Ambassador keeps its dedicated join URL (/auth?role=ambassador)
    // and its admin-approval workflow, but it is deliberately NOT offered on
    // the standard Affiliate/CDP signup choice — field recruits arrive through
    // their own invite link.
    role: 'ambassador',
    name: 'Team / Ambassador',
    tagline: 'Represent XCAPE',
    description:
      'Introduce XCAPE to prospective partners and support field activations.',
    cta: 'Join the Team',
    publicPath: false,
  },
  {
    // Internal field-team invite path (/auth?role=team). Not a landing card —
    // it exists so a field recruit's join intent survives the auth round trip.
    role: 'team',
    name: 'Field Team',
    tagline: 'XCAPE field operations',
    description:
      'Run skin analyses, capture leads and manage client event RSVPs in the field.',
    cta: 'Join the Field Team',
    publicPath: false,
  },
];

/** Only the join paths that are advertised publicly on the landing page. */
export const XCAPE_PUBLIC_ROLES: XcapeRole[] = XCAPE_ROLES.filter((r) => r.publicPath);


/**
 * Role-aware auth link. The `role` query param preserves the visitor's chosen
 * path for the later onboarding phase — no backend change is required yet.
 */
export const roleAuthHref = (role: XcapeJoinRole): string => `/auth?role=${role}`;

/** sessionStorage key preserving the visitor's chosen join path through auth. */
export const JOIN_ROLE_SESSION_KEY = 'xcape:join_role';

/** Validate an arbitrary ?role= value against the known public join paths. */
export const parseJoinRole = (raw: string | null | undefined): XcapeJoinRole | null =>
  XCAPE_ROLES.some((r) => r.role === raw) ? (raw as XcapeJoinRole) : null;

export const joinRoleName = (role: XcapeJoinRole): string =>
  XCAPE_ROLES.find((r) => r.role === role)?.name ?? role;

export const persistJoinRole = (role: XcapeJoinRole): void => {
  try {
    sessionStorage.setItem(JOIN_ROLE_SESSION_KEY, role);
  } catch {
    /* storage unavailable — intent simply isn't preserved */
  }
};

/** The visitor's pending join intent, if any survived navigation. */
export const readJoinRole = (): XcapeJoinRole | null => {
  try {
    return parseJoinRole(sessionStorage.getItem(JOIN_ROLE_SESSION_KEY));
  } catch {
    return null;
  }
};

export const clearJoinRole = (): void => {
  try {
    sessionStorage.removeItem(JOIN_ROLE_SESSION_KEY);
  } catch {
    /* ignore */
  }
};

/** Public, no-signup skin-analysis demo entry point. */
export const XCAPE_DEMO_PATH = '/skin-analysis';
export const XCAPE_DEMO_CTA = 'Try Free Skin Analysis';
export const XCAPE_DEMO_CTA_SHORT = 'Try Free Analysis';
export const XCAPE_DEMO_MICROCOPY = 'No signup required · About 2 minutes.';
