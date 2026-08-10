import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';

type MembershipType = Database['public']['Enums']['membership_type'];

export type MembershipEventType =
  | 'auto_promoted'
  | 'manual_promoted'
  | 'manual_demoted'
  | 'auto_demoted'
  | 'churn_flagged'
  | 'win_back_sent'
  | 'benefit_reset'
  | 'renewal_reminder_sent'
  | 'anniversary'
  | 'reactivated';

export interface LifecycleStatusRow {
  client_id: string;
  full_name: string;
  client_code: string;
  phone: string | null;
  email: string | null;
  current_tier: MembershipType;
  suggested_tier: MembershipType;
  tier_since: string | null;
  attributed_staff_id: string | null;
  spend_60d: number;
  spend_30d: number;
  last_activity_date: string | null;
  churn_risk: 'low' | 'medium' | 'high';
}

export interface MembershipEventRow {
  id: string;
  client_id: string;
  event_type: MembershipEventType;
  from_tier: MembershipType | null;
  to_tier: MembershipType | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  triggered_by: string | null;
  created_at: string;
  client_name?: string;
}

export interface BenefitAllowanceRow {
  id: string;
  tier: MembershipType;
  benefit_type: string;
  benefit_label: string;
  monthly_limit: number;
  active: boolean;
}

const LIFECYCLE_KEY = ['membership-lifecycle'] as const;
const EVENTS_KEY = ['membership-events'] as const;
const ALLOWANCES_KEY = ['membership-allowances'] as const;

const TIER_RANK: Record<MembershipType, number> = {
  none: 0,
  one_time: 1,
  member: 2,
  elite: 3,
};

export const useLifecycleStatus = () =>
  useQuery({
    queryKey: LIFECYCLE_KEY,
    queryFn: async (): Promise<LifecycleStatusRow[]> => {
      const { data, error } = await supabase
        .from('membership_lifecycle_status')
        .select('*');
      if (error) throw error;
      return (data ?? []) as unknown as LifecycleStatusRow[];
    },
  });

export const useMembershipEvents = (limit = 100) =>
  useQuery({
    queryKey: [...EVENTS_KEY, limit],
    queryFn: async (): Promise<MembershipEventRow[]> => {
      const { data, error } = await supabase
        .from('membership_events')
        .select('*, clients(full_name)')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((r) => {
        const row = r as unknown as MembershipEventRow & { clients?: { full_name?: string } };
        return { ...row, client_name: row.clients?.full_name };
      });
    },
  });

export const useBenefitAllowances = () =>
  useQuery({
    queryKey: ALLOWANCES_KEY,
    queryFn: async (): Promise<BenefitAllowanceRow[]> => {
      const { data, error } = await supabase
        .from('membership_benefit_allowances')
        .select('*')
        .order('tier', { ascending: false })
        .order('benefit_label');
      if (error) throw error;
      return (data ?? []) as BenefitAllowanceRow[];
    },
  });

/** Manually demote a client (admin only). Logs an event. */
export const useManualDemote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      client_id: string;
      from_tier: MembershipType;
      to_tier: MembershipType;
      reason: string;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error: updateErr } = await supabase
        .from('clients')
        .update({ membership_type: input.to_tier, tier_since: new Date().toISOString() })
        .eq('id', input.client_id);
      if (updateErr) throw updateErr;
      const { error: eventErr } = await supabase.from('membership_events').insert({
        client_id: input.client_id,
        event_type: 'manual_demoted',
        from_tier: input.from_tier,
        to_tier: input.to_tier,
        reason: input.reason,
        triggered_by: auth.user?.id ?? null,
      });
      if (eventErr) throw eventErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIFECYCLE_KEY });
      qc.invalidateQueries({ queryKey: EVENTS_KEY });
      qc.invalidateQueries({ queryKey: ['real-clients'] });
    },
  });
};

/** Manually log a lifecycle event (reminder sent, win-back, etc) without changing tier */
export const useLogLifecycleEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      client_id: string;
      event_type: MembershipEventType;
      reason?: string;
      metadata?: Record<string, unknown>;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const row: {
        client_id: string;
        event_type: string;
        reason?: string;
        metadata?: Json;
        triggered_by?: string;
      } = {
        client_id: input.client_id,
        event_type: input.event_type,
      };
      if (input.reason) row.reason = input.reason;
      if (input.metadata) row.metadata = input.metadata as Json;
      if (auth.user?.id) row.triggered_by = auth.user.id;
      const { error } = await supabase.from('membership_events').insert([row]);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EVENTS_KEY });
    },
  });
};

export const tierRank = (tier: MembershipType) => TIER_RANK[tier] ?? 0;
