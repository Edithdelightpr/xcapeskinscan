import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { INTAKE_VALIDITY_DAYS } from '@/hooks/useClientVisits';

export type IntakeStatus = 'valid' | 'expired' | 'missing';
export type FollowUpState = 'overdue' | 'due_soon' | 'open' | 'none';

export interface ConvertedClientCrmRow {
  client: Database['public']['Tables']['clients']['Row'];
  total_spend: number;
  treatment_revenue: number;
  product_revenue: number;
  pending_balance: number;
  visit_count: number;
  last_visit_at: string | null;
  next_appointment_at: string | null;
  next_appointment_treatment: string | null;
  intake_status: IntakeStatus;
  intake_collected_at: string | null;
  assigned_practitioner_id: string | null;
  /** Conversion owner — distinct from clinical practitioner. */
  attributed_staff_id: string | null;
  follow_up_state: FollowUpState;
  next_follow_up_date: string | null;
  open_follow_up_count: number;
  is_new: boolean;
  is_returning: boolean;
  is_high_value: boolean;
  is_active: boolean;
  has_unlinked_visits: boolean;
}

const HIGH_VALUE_THRESHOLD = 200_000;
const ACTIVE_DAYS = 90;
const NEW_DAYS = 30;

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};
const todayIso = () => new Date().toISOString().slice(0, 10);

export const useConvertedClientCrm = () =>
  useQuery({
    queryKey: ['converted-client-crm'],
    queryFn: async (): Promise<ConvertedClientCrmRow[]> => {
      const [
        { data: clients, error: cErr },
        { data: visits, error: vErr },
        { data: finance, error: fErr },
        { data: intakes, error: iErr },
        { data: appts, error: aErr },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { data: followUps, error: fuErr },
      ] = await Promise.all([
        supabase.from('clients').select('*').eq('archived', false),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from('client_visit_logs')
          .select('id, client_id, sign_in_time, sign_out_time, assigned_medical_expert_id, payment_state'),
        supabase
          .from('finance_entries')
          .select('source_client_id, kind, category, amount, payment_status, transaction_intent')
          .eq('status', 'active'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from('client_safety_intakes')
          .select('client_id, collected_at')
          .order('collected_at', { ascending: false }),
        supabase
          .from('appointments')
          .select('client_id, date, time, treatment, status')
          .gte('date', todayIso())
          .order('date', { ascending: true }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('client_follow_ups').select('*').eq('status', 'open'),
      ]);
      if (cErr) throw cErr;
      if (vErr) throw vErr;
      if (fErr) throw fErr;
      if (iErr) throw iErr;
      if (aErr) throw aErr;
      if (fuErr) throw fuErr;

      const visitsByClient = new Map<string, typeof visits>();
      (visits ?? []).forEach((v: { client_id: string }) => {
        const arr = visitsByClient.get(v.client_id) ?? [];
        arr.push(v as never);
        visitsByClient.set(v.client_id, arr);
      });

      const financeByClient = new Map<string, typeof finance>();
      (finance ?? []).forEach((f) => {
        if (!f.source_client_id) return;
        const arr = financeByClient.get(f.source_client_id) ?? [];
        arr.push(f as never);
        financeByClient.set(f.source_client_id, arr);
      });

      const intakeByClient = new Map<string, string>();
      (intakes ?? []).forEach((i: { client_id: string; collected_at: string }) => {
        if (!intakeByClient.has(i.client_id)) intakeByClient.set(i.client_id, i.collected_at);
      });

      const apptByClient = new Map<string, { at: string; treatment: string | null }>();
      (appts ?? []).forEach((a) => {
        if (!a.client_id) return;
        if (apptByClient.has(a.client_id)) return;
        apptByClient.set(a.client_id, {
          at: `${a.date}T${a.time ?? '00:00'}`,
          treatment: a.treatment ?? null,
        });
      });

      const followUpsByClient = new Map<string, Array<{ due_date: string }>>();
      (followUps ?? []).forEach((fu: { client_id: string; due_date: string }) => {
        const arr = followUpsByClient.get(fu.client_id) ?? [];
        arr.push(fu);
        followUpsByClient.set(fu.client_id, arr);
      });

      const activeCutoff = daysAgo(ACTIVE_DAYS);
      const newCutoff = daysAgo(NEW_DAYS);
      const intakeCutoff = daysAgo(INTAKE_VALIDITY_DAYS);
      const todayD = new Date(); todayD.setHours(0, 0, 0, 0);
      const dueSoonD = new Date(); dueSoonD.setDate(dueSoonD.getDate() + 7);

      return (clients ?? [])
        .filter((c) => visitsByClient.has(c.id) || financeByClient.has(c.id) || apptByClient.has(c.id))
        .map((c): ConvertedClientCrmRow => {
          const cv = visitsByClient.get(c.id) ?? [];
          const cf = financeByClient.get(c.id) ?? [];
          let treatmentRev = 0, productRev = 0, pending = 0;
          cf.forEach((f: { kind: string; category: string | null; amount: number; payment_status: string | null; transaction_intent: string | null }) => {
            const amt = Number(f.amount) || 0;
            if (f.kind !== 'revenue') return;
            const isPending = f.payment_status === 'pending' || f.payment_status === 'awaiting';
            if (isPending) { pending += amt; return; }
            const cat = (f.category ?? '').toLowerCase();
            const intent = (f.transaction_intent ?? '').toLowerCase();
            const isProduct =
              cat === 'product-sales' || cat === 'product_sale' || cat === 'legacy_unstructured_product_revenue' ||
              intent.includes('product');
            if (isProduct) productRev += amt;
            else treatmentRev += amt;
          });
          const totalSpend = treatmentRev + productRev;

          const sortedVisits = [...cv].sort((a, b) =>
            (b.sign_in_time ?? '').localeCompare(a.sign_in_time ?? '')
          );
          const lastVisitAt = sortedVisits[0]?.sign_in_time ?? null;
          const lastPractitioner = sortedVisits.find((v) => v.assigned_medical_expert_id)?.assigned_medical_expert_id ?? null;

          const intakeAt = intakeByClient.get(c.id) ?? null;
          const intakeStatus: IntakeStatus = !intakeAt
            ? 'missing'
            : intakeAt > intakeCutoff
              ? 'valid'
              : 'expired';

          const appt = apptByClient.get(c.id) ?? null;

          const fus = followUpsByClient.get(c.id) ?? [];
          const sortedFus = [...fus].sort((a, b) => a.due_date.localeCompare(b.due_date));
          const nextFu = sortedFus[0]?.due_date ?? null;
          let fuState: FollowUpState = 'none';
          if (nextFu) {
            const fuD = new Date(nextFu);
            if (fuD < todayD) fuState = 'overdue';
            else if (fuD <= dueSoonD) fuState = 'due_soon';
            else fuState = 'open';
          }

          const isActive = !!lastVisitAt && lastVisitAt > activeCutoff;
          const isNew = (cv.length <= 1) && !!c.first_seen_at && c.first_seen_at > newCutoff;
          const isReturning = cv.length >= 2;

          return {
            client: c,
            total_spend: totalSpend,
            treatment_revenue: treatmentRev,
            product_revenue: productRev,
            pending_balance: pending,
            visit_count: cv.length,
            last_visit_at: lastVisitAt,
            next_appointment_at: appt?.at ?? null,
            next_appointment_treatment: appt?.treatment ?? null,
            intake_status: intakeStatus,
            intake_collected_at: intakeAt,
            // Practitioner = last person who actually treated the client.
            // Do NOT fall back to attribution — those are separate concepts.
            assigned_practitioner_id: lastPractitioner ?? null,
            attributed_staff_id: c.attributed_staff_id ?? null,
            follow_up_state: fuState,
            next_follow_up_date: nextFu,
            open_follow_up_count: fus.length,
            is_new: isNew,
            is_returning: isReturning,
            is_high_value: totalSpend >= HIGH_VALUE_THRESHOLD,
            is_active: isActive,
            has_unlinked_visits: cv.length > 0 && totalSpend === 0,
          };
        })
        .sort((a, b) => (b.last_visit_at ?? '').localeCompare(a.last_visit_at ?? ''));
    },
  });