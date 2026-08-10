import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Source-of-truth counters for an outreach session — read straight from the
 * same operational tables that power the Leads Sheet, Analysis Queue and
 * Reports so every surface agrees.
 *
 *  - signedIn     = visits with source_type='outreach' & source_id=<id>
 *  - closed       = those visits with sign_out_time set
 *  - assessments  = client_visit_assessments joined to those visits
 *  - reports      = non-revoked client_report_links for those assessments
 *  - pending      = signedIn − closed (still on the floor / not signed out)
 */
export interface OutreachLiveCounters {
  signedIn: number;
  assessments: number;
  reports: number;
  closed: number;
  pending: number;
}

const EMPTY: OutreachLiveCounters = { signedIn: 0, assessments: 0, reports: 0, closed: 0, pending: 0 };

export const useOutreachLiveCounters = (outreachId: string | null | undefined) => {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['outreach-live-counters', outreachId],
    enabled: !!outreachId,
    queryFn: async (): Promise<OutreachLiveCounters> => {
      if (!outreachId) return EMPTY;

      // 1. Pull the visits attached to this outreach.
      const { data: visits, error: visitErr } = await supabase
        .from('client_visit_logs')
        .select('id, sign_out_time, status')
        .eq('source_type', 'outreach')
        .eq('source_id', outreachId);
      if (visitErr) throw visitErr;

      const activeVisits = (visits ?? []).filter((v) => (v as { status?: string }).status !== 'removed');
      const visitIds = activeVisits.map((v) => v.id);
      const signedIn = activeVisits.length;
      const closed = activeVisits.filter((v) => !!v.sign_out_time).length;

      if (visitIds.length === 0) {
        return { signedIn, assessments: 0, reports: 0, closed, pending: Math.max(0, signedIn - closed) };
      }

      // 2. Assessments recorded for those visits.
      const { data: assessRows, error: assessErr } = await supabase
        .from('client_visit_assessments')
        .select('id, visit_id')
        .in('visit_id', visitIds);
      if (assessErr) throw assessErr;
      const assessments = (assessRows ?? []).length;
      const assessmentIds = (assessRows ?? []).map((a) => a.id);

      // 3. Active (non-revoked) report links for those assessments.
      let reports = 0;
      if (assessmentIds.length > 0) {
        const { data: linkRows, error: linkErr } = await supabase
          .from('client_report_links')
          .select('id, revoked_at')
          .in('assessment_id', assessmentIds)
          .is('revoked_at', null);
        if (linkErr) throw linkErr;
        reports = (linkRows ?? []).length;
      }

      return {
        signedIn,
        assessments,
        reports,
        closed,
        pending: Math.max(0, signedIn - closed),
      };
    },
    staleTime: 15_000,
  });

  // Live-update: whenever a visit, assessment or report link changes anywhere
  // in the DB, invalidate this outreach's counter query. The queryFn re-filters
  // by source_id/outreach so unrelated churn is cheap.
  useEffect(() => {
    if (!outreachId) return;
    const invalidate = () => qc.invalidateQueries({ queryKey: ['outreach-live-counters', outreachId] });
    const channel = supabase
      .channel(`outreach-counters-${outreachId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_visit_logs' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_visit_assessments' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_report_links' }, invalidate)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [outreachId, qc]);

  return query;
};