import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toPublicReportUrl } from '@/lib/publicAppUrl';

export interface ReportLink {
  id: string;
  client_id: string;
  assessment_id: string;
  token_prefix: string;
  /** Null means "persistent link — no automatic expiry". */
  expires_at: string | null;
  revoked_at: string | null;
  created_by: string | null;
  created_at: string;
  /** Server-side engagement counters, incremented on each public fetch. */
  open_count?: number | null;
  first_opened_at?: string | null;
  last_opened_at?: string | null;
  origin_org_id?: string | null;
}

export interface ReportEvent {
  id: string;
  link_id: string;
  event_type:
    | 'link_viewed'
    | 'book_clicked'
    | 'product_interest'
    | 'question_clicked'
    | 'pdf_downloaded'
    | 'explore_treatments'
    | 'appointment_booked';
  payload: Record<string, unknown>;
  created_at: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const links = () => (supabase as any).from('client_report_links');
const events = () => (supabase as any).from('client_report_events');

/** All links for an assessment (newest first). */
export const useAssessmentReportLinks = (assessmentId: string | null | undefined) =>
  useQuery({
    queryKey: ['report-links', 'assessment', assessmentId],
    enabled: !!assessmentId,
    queryFn: async (): Promise<ReportLink[]> => {
      const { data, error } = await links()
        .select('*')
        .eq('assessment_id', assessmentId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReportLink[];
    },
  });

/** All links for a client (newest first). */
export const useClientReportLinks = (clientId: string | null | undefined) =>
  useQuery({
    queryKey: ['report-links', 'client', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<ReportLink[]> => {
      const { data, error } = await links()
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReportLink[];
    },
  });

/** Events for a set of link ids (single query). */
export const useReportEventsForLinks = (linkIds: string[]) =>
  useQuery({
    queryKey: ['report-events', linkIds.slice().sort().join(',')],
    enabled: linkIds.length > 0,
    queryFn: async (): Promise<ReportEvent[]> => {
      const { data, error } = await events()
        .select('*')
        .in('link_id', linkIds)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ReportEvent[];
    },
  });

export interface CreatedReportLink {
  ok: true;
  url: string;
  token: string;
  link_id: string;
  token_prefix: string;
  expires_at: string | null;
  /** True when we returned the recovered token for an existing active link. */
  recovered?: boolean;
}

/**
 * Creates a new persistent report link, OR recovers the URL for an existing
 * active one. Pass `revoke_previous: true` to force regeneration.
 *
 * When the current active link is a legacy random-token row that cannot be
 * recovered by HMAC, the edge function returns HTTP 409 with
 * `{ ok: false, recoverable: false, legacy: true }`. In that case this mutation
 * throws with `error.legacy === true` so the caller can surface a
 * "Regenerate to heal" affordance without silently invalidating the old link.
 */
export const useCreateReportLink = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      client_id: string;
      assessment_id: string;
      revoke_previous?: boolean;
    }): Promise<CreatedReportLink> => {
      const { data, error } = await supabase.functions.invoke('admin-create-report-link', {
        body: input,
      });
      if (error) throw error;
      if (!data?.ok) {
        const err = new Error(data?.error ?? 'Failed to create link') as Error & {
          legacy?: boolean;
          recoverable?: boolean;
          link_id?: string;
        };
        err.legacy = !!data?.legacy;
        err.recoverable = data?.recoverable;
        err.link_id = data?.link_id;
        throw err;
      }
      // Defensive: links are recipient-facing, so force the canonical public
      // domain even if the backend was configured with a preview origin.
      const created = data as CreatedReportLink;
      return { ...created, url: toPublicReportUrl(created.url) };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['report-links', 'assessment', vars.assessment_id] });
      qc.invalidateQueries({ queryKey: ['report-links', 'client', vars.client_id] });
    },
  });
};

/**
 * Recovers the shareable URL for the current active link WITHOUT minting a new
 * one. Returns `{ ok: false, recoverable: false, legacy: true }` for legacy
 * rows whose raw token can no longer be reconstructed.
 */
export interface RecoveredReportLink {
  ok: true;
  url: string;
  link_id: string;
  token_prefix: string;
  expires_at: string | null;
  revoked_at: string | null;
}

export interface UnrecoverableReportLink {
  ok: false;
  recoverable: false;
  legacy: true;
  link_id: string;
  token_prefix: string;
  expires_at: string | null;
  created_at: string;
}

export type ReportLinkUrlResult = RecoveredReportLink | UnrecoverableReportLink | null;

export const useRecoverReportLinkUrl = () =>
  useMutation({
    mutationFn: async (input: {
      client_id: string;
      assessment_id: string;
      link_id?: string;
    }): Promise<ReportLinkUrlResult> => {
      const { data, error } = await supabase.functions.invoke('admin-get-report-link-url', {
        body: input,
      });
      if (error) {
        // 404 = no active link at all — return null so callers can distinguish.
        // deno-lint-ignore no-explicit-any
        const status = (error as any).context?.status;
        if (status === 404) return null;
        throw error;
      }
      const res = data as ReportLinkUrlResult;
      if (res && res.ok) return { ...res, url: toPublicReportUrl(res.url) };
      return res;
    },
  });

/** Revokes an active link. */
export const useRevokeReportLink = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      link_id: string;
      client_id?: string;
      assessment_id?: string;
    }): Promise<void> => {
      const { data, error } = await supabase.functions.invoke('admin-revoke-report-link', {
        body: input,
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? 'Failed to revoke link');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-links'] });
    },
  });
};

/**
 * Convenience: pick the current active link from a list. A row is "active"
 * when it has no `revoked_at` AND either has no expiry (persistent link) or
 * has an expiry in the future (legacy 30-day rows still work until they lapse).
 */
export const activeLinkOf = (list: ReportLink[] | undefined): ReportLink | null => {
  if (!list) return null;
  const now = Date.now();
  return (
    list.find(
      (l) =>
        !l.revoked_at &&
        (l.expires_at === null || new Date(l.expires_at).getTime() > now),
    ) ?? null
  );
};