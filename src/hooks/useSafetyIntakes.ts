import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeInvalidate } from '@/hooks/useRealtimeInvalidate';
import { computeHealthFlags } from '@/lib/healthFlags';

/**
 * Pre-treatment safety & consent intake.
 *
 * Saving a row with `treatment_consent = true` triggers a DB-side
 * promotion of the client from `lead` -> `active` (see migration).
 */
export interface SafetyIntake {
  id: string;
  client_id: string;
  collected_by_staff_id: string | null;
  collected_at: string;
  is_pregnant: string | null;
  is_breastfeeding: boolean | null;
  allergies: string | null;
  current_medications: string | null;
  active_skin_conditions: string | null;
  recent_procedures: string | null;
  treatment_consent: boolean;
  photo_consent_internal: boolean;
  marketing_image_consent: boolean;
  acknowledged_signature: string | null;
  notes: string | null;
  created_at: string;
  // v2 — hospital-style health intake
  chronic_conditions?: string[] | null;
  chronic_conditions_notes?: string | null;
  prior_surgeries?: string | null;
  family_history?: string | null;
  allergy_severity?: string | null;
  anaesthetic_reaction?: boolean | null;
  on_blood_thinners?: boolean | null;
  on_retinoids?: boolean | null;
  on_hormonal_therapy?: boolean | null;
  supplements?: string | null;
  menstrual_status?: string | null;
  last_period_date?: string | null;
  keloid_tendency?: boolean | null;
  cold_sore_history?: boolean | null;
  recent_sun_exposure?: boolean | null;
  skin_type_fitzpatrick?: string | null;
  smoking_status?: string | null;
  alcohol_use?: string | null;
  sun_habits?: string | null;
  current_skincare_routine?: string | null;
  acknowledged_at?: string | null;
  form_version?: number | null;
  // v3 — consultation form additions
  skin_concerns?: string[] | null;
  skin_self_type?: string | null;
  past_treatments?: string[] | null;
  water_intake?: string | null;
  clinical_photo_consent?: boolean | null;
  clinical_photo_signature?: string | null;
  marketing_signature?: string | null;
  information_accurate_ack?: boolean | null;
}

export type SafetyIntakeInsert = Omit<
  SafetyIntake,
  'id' | 'collected_at' | 'created_at'
> & { collected_at?: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = () => (supabase as any).from('client_safety_intakes');
const KEY = ['safety-intakes'] as const;

export const useClientSafetyIntakes = (clientId?: string) => {
  useRealtimeInvalidate('client_safety_intakes', [KEY], 'rt-safety-intakes');
  return useQuery({
    queryKey: clientId ? [...KEY, 'client', clientId] : [...KEY, 'all'],
    queryFn: async (): Promise<SafetyIntake[]> => {
      let q = tbl().select('*').order('collected_at', { ascending: false });
      if (clientId) q = q.eq('client_id', clientId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SafetyIntake[];
    },
  });
};

export const useCreateSafetyIntake = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SafetyIntakeInsert): Promise<SafetyIntake> => {
      const { data, error } = await tbl().insert(input).select().single();
      if (error) throw error;
      // Append a timeline event so the intake appears alongside bookings
      // and visits on the client journey.
      try {
        const flags = computeHealthFlags(data as SafetyIntake);
        const flagSummary = flags.length
          ? ` · flags: ${flags.map((f) => f.label.toLowerCase()).join(', ')}`
          : ' · no major flags';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('lead_journey_events').insert({
          client_id: input.client_id,
          by_staff_id: input.collected_by_staff_id ?? null,
          status: 'health_intake_recorded',
          note: `Health intake recorded${flagSummary}`,
        });
      } catch (e) {
        // Non-fatal: intake save succeeded.
        console.warn('[safety-intake] failed to write timeline event', e);
      }
      return data as SafetyIntake;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['real-clients'] });
      qc.invalidateQueries({ queryKey: ['real-client', vars.client_id] });
      qc.invalidateQueries({ queryKey: ['lead-journey'] });
    },
  });
};