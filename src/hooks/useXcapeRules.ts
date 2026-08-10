import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  RuleConditions,
  RuleOutputs,
  RuleStatus,
  VersionStatus,
  XcapeRule,
  XcapeRuleVersion,
} from '@/lib/xcapeRules/types';

/**
 * XCAPE recommendation criteria — admin CRUD for versioned rules.
 * Practitioners get read-only access to published rules/versions through
 * the same queries (RLS scopes writes to admins).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const RULES_KEY = ['xcape-rules'] as const;
const VERSIONS_KEY = ['xcape-rule-versions'] as const;

export const useXcapeRules = () =>
  useQuery({
    queryKey: RULES_KEY,
    queryFn: async (): Promise<XcapeRule[]> => {
      const { data, error } = await (supabase as any)
        .from('xcape_recommendation_rules')
        .select('*')
        .order('priority', { ascending: true })
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as XcapeRule[];
    },
  });

export const useXcapeRuleVersions = () =>
  useQuery({
    queryKey: VERSIONS_KEY,
    queryFn: async (): Promise<XcapeRuleVersion[]> => {
      const { data, error } = await (supabase as any)
        .from('xcape_rule_versions')
        .select('*')
        .order('published_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as XcapeRuleVersion[];
    },
  });

export interface RuleDraftInput {
  id?: string;
  name: string;
  description?: string | null;
  priority?: number;
  draft_conditions: RuleConditions;
  draft_outputs: RuleOutputs;
  is_demo?: boolean;
}

export const useSaveRuleDraft = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RuleDraftInput): Promise<XcapeRule> => {
      const payload = {
        name: input.name,
        description: input.description ?? null,
        priority: input.priority ?? 100,
        draft_conditions: input.draft_conditions,
        draft_outputs: input.draft_outputs,
        is_demo: input.is_demo ?? false,
      };
      const query = input.id
        ? (supabase as any).from('xcape_recommendation_rules').update(payload).eq('id', input.id)
        : (supabase as any).from('xcape_recommendation_rules').insert(payload);
      const { data, error } = await query.select('*').single();
      if (error) throw error;
      return data as XcapeRule;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: RULES_KEY }),
  });
};

export const useDuplicateRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: XcapeRule): Promise<XcapeRule> => {
      const { data, error } = await (supabase as any)
        .from('xcape_recommendation_rules')
        .insert({
          name: `${rule.name} (copy)`,
          description: rule.description,
          status: 'draft',
          priority: rule.priority,
          draft_conditions: rule.draft_conditions,
          draft_outputs: rule.draft_outputs,
          is_demo: rule.is_demo,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as XcapeRule;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: RULES_KEY }),
  });
};

/**
 * Publish a rule: snapshot the current draft as a new immutable version,
 * then mark the rule published at that version. Prior versions of the same
 * rule are retired so exactly one snapshot is executable.
 */
export const usePublishRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ rule, changeNote }: { rule: XcapeRule; changeNote?: string }) => {
      const nextVersion = rule.current_version + 1;

      const { data: versionRow, error: vErr } = await (supabase as any)
        .from('xcape_rule_versions')
        .insert({
          rule_id: rule.id,
          version: nextVersion,
          status: 'published',
          conditions: rule.draft_conditions,
          outputs: rule.draft_outputs,
          change_note: changeNote ?? null,
        })
        .select('*')
        .single();
      if (vErr) throw vErr;

      const { error: rErr } = await (supabase as any)
        .from('xcape_recommendation_rules')
        .update({ status: 'published', current_version: nextVersion })
        .eq('id', rule.id);
      if (rErr) throw rErr;

      const { error: retireErr } = await (supabase as any)
        .from('xcape_rule_versions')
        .update({ status: 'inactive' })
        .eq('rule_id', rule.id)
        .neq('id', (versionRow as XcapeRuleVersion).id)
        .eq('status', 'published');
      if (retireErr) throw retireErr;

      return versionRow as XcapeRuleVersion;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RULES_KEY });
      qc.invalidateQueries({ queryKey: VERSIONS_KEY });
    },
  });
};

export const useSetRuleStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RuleStatus }) => {
      const { error } = await (supabase as any)
        .from('xcape_recommendation_rules')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: RULES_KEY }),
  });
};

export const useSetVersionStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: VersionStatus }) => {
      const { error } = await (supabase as any)
        .from('xcape_rule_versions')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: VERSIONS_KEY }),
  });
};

export const useXcapeRuleAudit = (ruleId?: string) =>
  useQuery({
    queryKey: ['xcape-rule-audit', ruleId ?? 'all'],
    enabled: !!ruleId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('xcape_rule_audit')
        .select('*')
        .eq('rule_id', ruleId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
