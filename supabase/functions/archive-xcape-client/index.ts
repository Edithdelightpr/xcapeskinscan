// XCAPE "Remove client" — safe archive + storage purge.
//
// Accepts ONLY { client_id }. The caller is identified from the verified
// bearer token; roles, ownership, organization status, storage paths and
// cleanup state are all derived server-side. Storage paths are NEVER returned
// to the browser.
//
// The database work (archive client, revoke every active report link, archive
// every media row) happens in one transaction inside
// public.xcape_archive_client, which re-checks authorization and is callable
// by service_role only. Afterwards this function removes the returned objects
// from the private `client-media` bucket in bounded batches and records the
// outcome. The whole operation is idempotent: an authorized retry finishes a
// prior pending/error purge without duplicate side effects.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { decideArchiveAccess, orgConfersAccess } from '../_shared/archiveClientAccess.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BUCKET = 'client-media';
const BATCH = 50;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const isUuid = (s: unknown): s is string =>
  typeof s === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return json({ error: 'Missing Authorization header' }, 401);

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) return json({ error: 'Invalid session' }, 401);

    let body: { client_id?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }
    if (!isUuid(body?.client_id)) return json({ error: 'client_id (uuid) required' }, 400);
    const clientId = body.client_id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // ---- server-derived authorization -------------------------------------
    const { data: roleRows } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id);
    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);

    const { data: client } = await admin
      .from('clients')
      .select('id, origin_user_id, origin_org_id, archived, media_purge_status')
      .eq('id', clientId)
      .maybeSingle();
    // Do not leak existence: an unknown client answers exactly like a
    // client the caller may not touch.
    if (!client) return json({ error: 'Not authorized' }, 403);

    const { data: assessmentRows } = await admin
      .from('client_visit_assessments')
      .select('origin_user_id, origin_org_id')
      .eq('client_id', clientId)
      .limit(500);

    const directOwner =
      client.origin_user_id === caller.id ||
      (assessmentRows ?? []).some(
        (a: { origin_user_id: string | null }) => a.origin_user_id === caller.id,
      );

    const orgIds = Array.from(
      new Set(
        [
          client.origin_org_id,
          ...(assessmentRows ?? []).map((a: { origin_org_id: string | null }) => a.origin_org_id),
        ].filter(Boolean) as string[],
      ),
    );

    // A CDP-owned client is always gated on an ACTIVE org + ACTIVE membership,
    // even for the person who captured it — so org status is resolved whenever
    // an origin organization exists, not only when direct ownership is absent.
    let hasCdpOrigin = false;
    let activeOrgManager = false;
    if (orgIds.length > 0) {
      const { data: orgs } = await admin
        .from('organizations')
        .select('id, kind, status')
        .in('id', orgIds);
      const cdpOrgs = (orgs ?? []).filter((o: { kind: string }) => o.kind === 'cdp');
      hasCdpOrigin = cdpOrgs.length > 0;
      if (hasCdpOrigin) {
        const { data: memberships } = await admin
          .from('organization_members')
          .select('organization_id, status')
          .eq('user_id', caller.id)
          .in('organization_id', cdpOrgs.map((o: { id: string }) => o.id));
        activeOrgManager = cdpOrgs.some((o: { id: string; kind: string; status: string }) =>
          orgConfersAccess(
            o,
            (memberships ?? []).find(
              (m: { organization_id: string }) => m.organization_id === o.id,
            ) ?? null,
          ),
        );
      }
    }

    const decision = decideArchiveAccess(roles, { directOwner, hasCdpOrigin, activeOrgManager });
    if (!decision.allowed) return json({ error: 'Not authorized' }, 403);

    // ---- transactional archive --------------------------------------------
    const { data: result, error: rpcErr } = await admin.rpc('xcape_archive_client', {
      _client_id: clientId,
      _actor: caller.id,
    });
    if (rpcErr) {
      console.error('archive-xcape-client rpc error', rpcErr);
      const code = (rpcErr as { code?: string }).code;
      if (code === '42501') return json({ error: 'Not authorized' }, 403);
      return json({ error: 'Server error' }, 500);
    }

    const payload = (result ?? {}) as {
      links_revoked?: number;
      media_archived?: number;
      already_archived?: boolean;
      storage_paths?: string[];
    };
    const paths = (payload.storage_paths ?? []).filter(
      (p): p is string => typeof p === 'string' && p.length > 0,
    );

    // ---- bounded storage purge (service-role only) -------------------------
    let cleanupPending = false;
    for (let i = 0; i < paths.length; i += BATCH) {
      const batch = paths.slice(i, i + BATCH);
      const { error } = await admin.storage.from(BUCKET).remove(batch);
      if (error) {
        console.error('archive-xcape-client storage purge failed', error);
        cleanupPending = true;
        break;
      }
    }

    const { error: markErr } = await admin.rpc('xcape_mark_client_media_purged', {
      _client_id: clientId,
      _status: cleanupPending ? 'error' : 'complete',
      _error: cleanupPending ? 'storage cleanup incomplete' : null,
    });
    if (markErr) {
      // We could not record the outcome, so we cannot honestly claim the purge
      // completed — report it as pending so a retry finishes the job.
      console.error('archive-xcape-client purge status write failed', markErr);
      cleanupPending = true;
    }


    // Counts only — never storage paths, ids of other records, or internals.
    return json({
      ok: true,
      cleanup_pending: cleanupPending,
      links_revoked: payload.links_revoked ?? 0,
      media_archived: payload.media_archived ?? 0,
    });
  } catch (e) {
    console.error('archive-xcape-client error', e);
    return json({ error: 'Server error' }, 500);
  }
});
