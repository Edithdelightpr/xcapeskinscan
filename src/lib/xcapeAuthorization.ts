/**
 * XCAPE scanner authorization — presentation helpers.
 *
 * The AUTHORITATIVE decision is made server-side by the
 * `xcape_authorization_state` SECURITY DEFINER function, which reads role,
 * account status, partner approval and the recorded partner fee. Nothing here
 * decides access: these helpers only turn the server's verdict into copy.
 * A frontend boolean is never trusted for enforcement — the database also
 * blocks scan creation for unauthorized partner accounts.
 */

export type XcapeAuthorizationReason =
  | 'unauthenticated'
  | 'no_role'
  | 'admin'
  | 'affiliate_self_serve'
  | 'account_inactive'
  | 'cdp_no_organization'
  | 'cdp_pending_approval'
  | 'cdp_fee_required'
  | 'cdp_active'
  | 'staff_active';

export interface XcapeAuthorizationState {
  authorized: boolean;
  reason: XcapeAuthorizationReason;
  role?: string | null;
  org_id?: string | null;
  org_name?: string | null;
  org_status?: string | null;
  fee_status?: 'unpaid' | 'pending' | 'paid' | 'waived' | null;
  required_fee?: number | null;
  currency?: string | null;
}

/** Conservative default used before the server verdict has arrived. */
export const UNKNOWN_AUTHORIZATION: XcapeAuthorizationState = {
  authorized: false,
  reason: 'unauthenticated',
};

export const formatFee = (amount: number | null | undefined, currency = 'NGN'): string => {
  if (amount == null || !Number.isFinite(Number(amount))) return '—';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency || 'NGN',
    maximumFractionDigits: 0,
  }).format(Number(amount));
};

export interface AuthorizationCopy {
  title: string;
  body: string;
  /** True when the partner needs to settle the activation fee. */
  showFee: boolean;
}

/**
 * Plain-language explanation of why the scanner is unavailable. Never invents
 * an amount: the fee shown always comes from the server-provided setting.
 */
export const describeAuthorization = (state: XcapeAuthorizationState): AuthorizationCopy => {
  switch (state.reason) {
    case 'cdp_pending_approval':
      return {
        title: 'Partner location under review',
        body: 'XCAPE is reviewing your partner location. The scanner unlocks as soon as your location is approved.',
        showFee: false,
      };
    case 'cdp_fee_required':
      return {
        title: 'Activation payment required',
        body: `Your partner location is approved. Scanner access opens once your XCAPE activation fee of ${formatFee(
          state.required_fee,
          state.currency ?? 'NGN',
        )} is recorded as paid.`,
        showFee: true,
      };
    case 'cdp_no_organization':
      return {
        title: 'Partner location missing',
        body: 'We could not find a partner location on your account. Contact XCAPE so your location can be registered.',
        showFee: false,
      };
    case 'account_inactive':
      return {
        title: 'Account inactive',
        body: 'Your account is currently inactive. An administrator must reactivate it before you can run analyses.',
        showFee: false,
      };
    case 'no_role':
      return {
        title: 'Choose your account type',
        body: 'Pick how you will be using XCAPE to unlock the scanner.',
        showFee: false,
      };
    case 'unauthenticated':
      return {
        title: 'Sign in required',
        body: 'Sign in to your XCAPE account to run a skin analysis.',
        showFee: false,
      };
    default:
      return {
        title: 'Scanner unavailable',
        body: 'Your account is not authorized to run analyses yet.',
        showFee: false,
      };
  }
};

/**
 * Affiliate payout snapshot maths, mirrored from the database trigger so the
 * workspace can display the same figure it stored.
 */
export const affiliatePayout = (
  base: number,
  splitPercentage: number,
): number => Math.round(Math.max(0, base) * Math.max(0, Math.min(100, splitPercentage))) / 100;
