import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type SubscriptionStatus = 'active' | 'grace' | 'past_due' | 'suspended' | 'cancelled';
/** Derived status only — never persisted. `active` within threshold days of the next due date. */
export type EffectiveSubscriptionStatus = SubscriptionStatus | 'due_soon';

export interface SubscriptionAccount {
  id: string;
  account_slug: string;
  account_name: string;
  domain_name: string | null;
  website_url: string | null;
  plan_name: string;
  amount: number;
  currency: string;
  billing_cycle: string;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  next_due_date: string | null;
  grace_period_end: string | null;
  last_payment_date: string | null;
  payment_reference: string | null;
  notes: string | null;
  owner_email: string;
  due_soon_threshold_days: number;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  // SaaS pricing tier fields
  plan_tier: 'starter' | 'growth' | 'partner' | 'enterprise';
  plan_price_usd: number;
  pilot_rate_usd: number | null;
  pilot_rate_note: string | null;
}

export type NotificationType =
  | 'payment_marked_paid'
  | 'grace_started'
  | 'past_due'
  | 'suspended'
  | 'reactivated'
  | 'cancelled'
  | 'manual_note_added'
  | 'payment_submitted'
  | 'due_soon'
  | 'plan_changed'
  | 'pilot_rate_changed';

export interface SubscriptionPlan {
  tier: 'starter' | 'growth' | 'partner' | 'enterprise';
  name: string;
  tagline: string;
  price_usd: number;
  sort_order: number;
  included_features: string[];
  excluded_features: string[];
  is_active: boolean;
}

/** Read the seeded plan catalog (Starter / Growth / Partner / Enterprise). */
export const useSubscriptionPlans = () =>
  useQuery({
    queryKey: ['subscription_plans'] as const,
    queryFn: async (): Promise<SubscriptionPlan[]> => {
      const { data, error } = await supabase
        .from('subscription_plans' as never)
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data as unknown as SubscriptionPlan[]) ?? [];
    },
    staleTime: 5 * 60_000,
  });

/** Current tenant's plan tier — safe fallback while loading. */
export const useCurrentPlanTier = (): 'starter' | 'growth' | 'partner' | 'enterprise' => {
  const { data: sub } = useSubscription();
  return (sub?.plan_tier as 'starter' | 'growth' | 'partner' | 'enterprise') ?? 'partner';
};

export interface SubscriptionPayment {
  id: string;
  subscription_account_id: string;
  amount: number;
  currency: string;
  payment_reference: string | null;
  payment_method: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_by: string | null;
  approved_by: string | null;
  submitted_at: string;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionActionLog {
  id: string;
  subscription_account_id: string;
  action: string;
  previous_status: string | null;
  new_status: string | null;
  performed_by: string | null;
  performed_from: string;
  notes: string | null;
  created_at: string;
}

const KEY = ['subscription_account', 'tropics'] as const;
const PAYMENTS_KEY = ['subscription_payments', 'tropics'] as const;
const LOGS_KEY = ['subscription_action_logs', 'tropics'] as const;

/** Loads the single Tropics subscription row. */
export const useSubscription = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<SubscriptionAccount | null> => {
      const { data, error } = await supabase
        .from('subscription_accounts' as never)
        .select('*')
        .eq('account_slug', 'tropics')
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as SubscriptionAccount) ?? null;
    },
    staleTime: 30_000,
  });

/** Notify the platform owner via edge function. Fire-and-forget from the UI side. */
export const notifyOwner = async (
  accountId: string,
  notificationType: NotificationType,
  opts: { performedBy?: string | null; notes?: string | null; message?: string; dedupe24h?: boolean } = {},
) => {
  try {
    await supabase.functions.invoke('notify-subscription-owner', {
      body: {
        accountId,
        notificationType,
        performedBy: opts.performedBy ?? null,
        performedFrom: 'app',
        notes: opts.notes ?? null,
        message: opts.message,
        dedupe24h: opts.dedupe24h ?? false,
      },
    });
  } catch (e) {
    // Non-blocking: log only.
    console.warn('notifyOwner failed', e);
  }
};

/** Insert an action log row (best-effort). */
export const logAction = async (
  accountId: string,
  action: string,
  previousStatus: string | null,
  newStatus: string | null,
  performedBy: string | null,
  notes?: string | null,
) => {
  try {
    await supabase.from('subscription_action_logs' as never).insert({
      subscription_account_id: accountId,
      action,
      previous_status: previousStatus,
      new_status: newStatus,
      performed_by: performedBy,
      performed_from: 'app',
      notes: notes ?? null,
    } as never);
  } catch (e) {
    console.warn('logAction failed', e);
  }
};

export const useUpdateSubscription = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<SubscriptionAccount> & { id: string }) => {
      const { id, ...rest } = patch;
      const { data, error } = await supabase
        .from('subscription_accounts' as never)
        .update(rest as never)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as SubscriptionAccount;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useSubscriptionPayments = (accountId: string | undefined) =>
  useQuery({
    queryKey: [...PAYMENTS_KEY, accountId ?? 'none'],
    enabled: !!accountId,
    queryFn: async (): Promise<SubscriptionPayment[]> => {
      const { data, error } = await supabase
        .from('subscription_payments' as never)
        .select('*')
        .eq('subscription_account_id', accountId!)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as SubscriptionPayment[]) ?? [];
    },
  });

export const useSubmitPayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      subscription_account_id: string;
      amount: number;
      currency: string;
      payment_reference: string;
      notes?: string | null;
      submitted_by?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('subscription_payments' as never)
        .insert({
          subscription_account_id: payload.subscription_account_id,
          amount: payload.amount,
          currency: payload.currency,
          payment_reference: payload.payment_reference,
          notes: payload.notes ?? null,
          submitted_by: payload.submitted_by ?? null,
          status: 'pending',
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as SubscriptionPayment;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PAYMENTS_KEY }),
  });
};

export const useApprovePayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; approver: string | null; status: 'approved' | 'rejected' }) => {
      const { data, error } = await supabase
        .from('subscription_payments' as never)
        .update({
          status: payload.status,
          approved_by: payload.approver,
          approved_at: new Date().toISOString(),
        } as never)
        .eq('id', payload.id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as SubscriptionPayment;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PAYMENTS_KEY }),
  });
};

/** True when operational admin/staff access should be blocked. */
export const isSubscriptionBlocked = (s: SubscriptionStatus | undefined): boolean =>
  s === 'suspended' || s === 'cancelled';

/** True when a warning banner should be shown above operational pages. */
export const isSubscriptionWarning = (s: EffectiveSubscriptionStatus | undefined): boolean =>
  s === 'due_soon' || s === 'grace' || s === 'past_due';

/** Whole days between now and the given date. Negative when overdue. */
export const daysUntil = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const nowMidnight = new Date();
  nowMidnight.setHours(0, 0, 0, 0);
  return Math.ceil((then - nowMidnight.getTime()) / (24 * 60 * 60 * 1000));
};

/**
 * Derive the effective status from the canonical DB status.
 * Returns `due_soon` when `active` and the next due date is within threshold.
 */
export const effectiveStatus = (sub: SubscriptionAccount | null | undefined): EffectiveSubscriptionStatus | undefined => {
  if (!sub) return undefined;
  if (sub.status !== 'active') return sub.status;
  const target = sub.next_due_date ?? sub.current_period_end;
  const d = daysUntil(target);
  if (d !== null && d <= (sub.due_soon_threshold_days ?? 7) && d >= 0) return 'due_soon';
  return 'active';
};