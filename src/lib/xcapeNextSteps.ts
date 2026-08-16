import type { XcapeAccountType } from '@/hooks/useAuth';

/**
 * Role- and lifecycle-aware "next steps" for signed-in XCAPE members.
 *
 * Signed-in members must never be shown guest onboarding CTAs ("Choose your
 * path", "Sign up as an Affiliate"). Every destination here is an existing
 * XCAPE route — where the dedicated backend surface does not exist yet the
 * item is marked `pendingBackend` and labelled honestly.
 */

export interface XcapeNextStep {
  id: string;
  title: string;
  description: string;
  to: string;
  cta: string;
  /** True when the destination is the closest honest existing screen. */
  pendingBackend?: boolean;
}

export interface XcapeNextStepsSurface {
  heading: string;
  subheading: string;
  steps: XcapeNextStep[];
}

const AFFILIATE: XcapeNextStepsSurface = {
  heading: 'Your next steps',
  subheading: 'Where to go next with your XCAPE Affiliate account.',
  steps: [
    {
      id: 'cdp-upgrade',
      title: 'Become a Certified Distribution Partner',
      description:
        'Operate XCAPE from a physical location. Upgrade requests are reviewed by XCAPE — start from your account details.',
      to: '/xcape/account',
      cta: 'Open your account',
      pendingBackend: true,
    },
    {
      id: 'events',
      title: 'Upcoming events',
      description: 'See XCAPE activations and client events you can attend or RSVP to.',
      to: '/xcape/events',
      cta: 'View events',
    },
    {
      id: 'whats-new',
      title: "What's new at XCAPE",
      description: 'Your latest analyses, reports and XCAPE activity in one place.',
      to: '/xcape/history',
      cta: 'View activity',
      pendingBackend: true,
    },
  ],
};

const CDP: XcapeNextStepsSurface = {
  heading: 'Your next steps',
  subheading: 'Run your XCAPE partner location.',
  steps: [
    {
      id: 'pricing',
      title: 'Set client prices',
      description: 'Control the prices your clients see for XCAPE products at your location.',
      to: '/xcape/pricing',
      cta: 'Set prices',
    },
    {
      id: 'orders',
      title: 'View orders',
      description: 'Confirm or cancel the orders routed to your location.',
      to: '/xcape/orders',
      cta: 'Open orders',
    },
    {
      id: 'events',
      title: 'Upcoming events',
      description: 'Plan client events and activations for your location.',
      to: '/xcape/events',
      cta: 'View events',
    },
  ],
};

const ADMIN: XcapeNextStepsSurface = {
  heading: 'Admin next steps',
  subheading: 'Restrained shortcuts into the XCAPE console.',
  steps: [
    {
      id: 'partners',
      title: 'Review partner applications',
      description: 'Approve or hold Certified Distribution Partner locations.',
      to: '/xcape/admin/organizations',
      cta: 'Open partners',
    },
    {
      id: 'crm',
      title: 'XCAPE CRM',
      description: 'Clients, analyses and reports across the whole network.',
      to: '/xcape/admin/crm',
      cta: 'Open CRM',
    },
    {
      id: 'pricing',
      title: 'System pricing',
      description: 'Maintain the controlled XCAPE selling prices.',
      to: '/xcape/admin/products',
      cta: 'Open pricing',
    },
  ],
};

const MEMBER: XcapeNextStepsSurface = {
  heading: 'Your next steps',
  subheading: 'Pick up where you left off.',
  steps: [
    {
      id: 'clients',
      title: 'Your clients',
      description: 'Every client you have analysed, with their skin journey.',
      to: '/xcape/clients',
      cta: 'View clients',
    },
    {
      id: 'reports',
      title: 'Your reports',
      description: 'Share, re-open and track the reports you have generated.',
      to: '/xcape/reports',
      cta: 'View reports',
    },
    {
      id: 'events',
      title: 'Upcoming events',
      description: 'XCAPE activations and client events.',
      to: '/xcape/events',
      cta: 'View events',
    },
  ],
};

export const nextStepsFor = (accountType: XcapeAccountType): XcapeNextStepsSurface => {
  if (accountType === 'affiliate') return AFFILIATE;
  if (accountType === 'cdp') return CDP;
  if (accountType === 'admin') return ADMIN;
  return MEMBER;
};

/** Guest signup copy must never appear for a signed-in member. */
export const GUEST_ONLY_PHRASES = [
  'Choose your path',
  'Sign up as an Affiliate',
  'Apply as a Partner Location',
];
