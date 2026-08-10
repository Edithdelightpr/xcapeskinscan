import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type BenefitType = 'skin_analysis' | 'express_service' | 'event_invitation' | 'promo_access';

export interface MemberSpendRow {
  client_id: string;
  full_name: string;
  client_code: string;
  membership_type: 'member' | 'elite';
  attributed_staff_id: string | null;
  period: string;
  spend_this_month: number;
  threshold: number;
  remaining_to_threshold: number;
}

export interface BenefitUsageRow {
  id: string;
  client_id: string;
  benefit_type: BenefitType;
  benefit_label: string | null;
  used_on: string;
  period_year_month: string;
  notes: string | null;
  granted_by: string | null;
  created_at: string;
}

const SPEND_KEY = ['member-spend-monthly'] as const;
const BENEFITS_KEY = ['member-benefit-usage'] as const;

export const useMemberSpendMonthly = () =>
  useQuery({
    queryKey: SPEND_KEY,
    queryFn: async (): Promise<MemberSpendRow[]> => {
      // View not in generated types yet — typed cast is safe.
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => { select: (q: string) => Promise<{ data: MemberSpendRow[] | null; error: Error | null }> };
      })
        .from('member_spend_monthly')
        .select('*');
      if (error) throw error;
      return data ?? [];
    },
  });

export const useBenefitUsageThisMonth = (clientId?: string) => {
  const period = new Date().toISOString().slice(0, 7);
  return useQuery({
    queryKey: [...BENEFITS_KEY, clientId, period],
    enabled: !!clientId,
    queryFn: async (): Promise<BenefitUsageRow[]> => {
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (q: string) => {
            eq: (c: string, v: string) => {
              eq: (c: string, v: string) => Promise<{ data: BenefitUsageRow[] | null; error: Error | null }>;
            };
          };
        };
      })
        .from('member_benefit_usage')
        .select('*')
        .eq('client_id', clientId!)
        .eq('period_year_month', period);
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useGrantBenefit = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { client_id: string; benefit_type: BenefitType; benefit_label?: string; notes?: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const period = new Date().toISOString().slice(0, 7);
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          insert: (v: Record<string, unknown>) => {
            select: () => { single: () => Promise<{ data: BenefitUsageRow | null; error: Error | null }> };
          };
        };
      })
        .from('member_benefit_usage')
        .insert({
          client_id: input.client_id,
          benefit_type: input.benefit_type,
          benefit_label: input.benefit_label ?? null,
          notes: input.notes ?? null,
          period_year_month: period,
          granted_by: auth.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: BENEFITS_KEY });
      if (row?.client_id) {
        qc.invalidateQueries({ queryKey: [...BENEFITS_KEY, row.client_id] });
      }
    },
  });
};