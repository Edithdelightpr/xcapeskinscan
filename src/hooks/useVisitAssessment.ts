import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VisitAssessmentSummary {
  id: string;
  visit_id: string | null;
  client_id: string;
  main_concern: string | null;
  client_goal: string | null;
  practitioner_observation: string | null;
  home_care: string | null;
  follow_up_recommendation: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recommended_services?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recommended_products?: any[];
  created_at: string;
}

/**
 * Fetch the most relevant assessment for a visit, in priority order:
 *   1. Assessment linked directly to the visit_id.
 *   2. Assessment for the same client between the visit's sign-in and
 *      sign-out timestamps.
 *   3. Latest same-day assessment for the client.
 */
export const useVisitAssessment = (visit?: {
  id: string;
  client_id: string;
  sign_in_time: string;
  sign_out_time?: string | null;
  visit_date: string;
} | null) =>
  useQuery({
    queryKey: ['visit-assessment', visit?.id ?? null],
    enabled: !!visit,
    queryFn: async (): Promise<VisitAssessmentSummary | null> => {
      if (!visit) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const cols = 'id, visit_id, client_id, main_concern, client_goal, practitioner_observation, home_care, follow_up_recommendation, recommended_services, recommended_products, created_at';

      const byVisit = await sb
        .from('client_visit_assessments')
        .select(cols)
        .eq('visit_id', visit.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byVisit.data) return byVisit.data as VisitAssessmentSummary;

      const winEnd = visit.sign_out_time ?? new Date().toISOString();
      const inWindow = await sb
        .from('client_visit_assessments')
        .select(cols)
        .eq('client_id', visit.client_id)
        .gte('created_at', visit.sign_in_time)
        .lte('created_at', winEnd)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (inWindow.data) return inWindow.data as VisitAssessmentSummary;

      const dayStart = `${visit.visit_date}T00:00:00Z`;
      const dayEnd = `${visit.visit_date}T23:59:59Z`;
      const sameDay = await sb
        .from('client_visit_assessments')
        .select(cols)
        .eq('client_id', visit.client_id)
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return (sameDay.data as VisitAssessmentSummary | null) ?? null;
    },
  });