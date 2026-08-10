import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ProposalStatus, RuleOutputs, XcapeProposal } from '@/lib/xcapeRules/types';
import type { RuleMatch } from '@/lib/xcapeRules/evaluate';

/**
 * XCAPE recommendation proposals — the audit trail of rule evaluations and
 * practitioner decisions. Proposals are created per (assessment, rule
 * version) and keep the original proposal plus the final approved/edited
 * result, decision reason, practitioner identity and timestamps.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const key = (assessmentId?: string) => ['xcape-proposals', assessmentId ?? 'none'] as const;

export const useAssessmentProposals = (assessmentId?: string | null) =>
  useQuery({
    queryKey: key(assessmentId ?? undefined),
    enabled: !!assessmentId,
    queryFn: async (): Promise<XcapeProposal[]> => {
      const { data, error } = await (supabase as any)
        .from('xcape_recommendation_proposals')
        .select('*')
        .eq('assessment_id', assessmentId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as XcapeProposal[];
    },
  });

export interface CreateProposalsInput {
  assessmentId: string;
  clientId: string;
  matches: RuleMatch[];
  engineVersion?: string | null;
}

/** Insert proposal rows for fresh rule matches. Idempotent per rule version:
 *  matches whose version already has a proposal are skipped by the caller. */
export const useCreateProposals = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ assessmentId, clientId, matches, engineVersion }: CreateProposalsInput) => {
      if (matches.length === 0) return [];
      const rows = matches.map((m) => ({
        assessment_id: assessmentId,
        client_id: clientId,
        rule_id: m.rule.id,
        rule_version_id: m.version.id,
        rule_version: m.version.version,
        rule_name: m.rule.name,
        engine_version: engineVersion ?? null,
        matched_reasons: m.reasons,
        proposal: m.outputs,
        status: 'proposed',
      }));
      const { data, error } = await (supabase as any)
        .from('xcape_recommendation_proposals')
        .insert(rows)
        .select('*');
      if (error) throw error;
      return (data ?? []) as XcapeProposal[];
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: key(vars.assessmentId) }),
  });
};

export interface DecideProposalInput {
  id: string;
  assessmentId: string;
  status: Extract<ProposalStatus, 'accepted' | 'edited' | 'rejected'>;
  /** Required for reject; required for edited (material change). */
  reason?: string;
  /** Final approved/edited result — defaults to the original proposal. */
  finalResult?: RuleOutputs | null;
}

export const useDecideProposal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, reason, finalResult }: DecideProposalInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any)
        .from('xcape_recommendation_proposals')
        .update({
          status,
          decision_reason: reason ?? null,
          final_result: finalResult ?? null,
          decided_by: userData.user?.id ?? null,
          decided_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data as XcapeProposal;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: key(vars.assessmentId) }),
  });
};
