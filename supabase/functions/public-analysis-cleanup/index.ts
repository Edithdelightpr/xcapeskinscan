// Retention worker for the anonymous public skin-analysis demo.
//
// 1. Deletes original images once past their 24h deadline (storage first,
//    then clears the recorded paths).
// 2. Deletes orphan objects that have no matching session row.
// 3. Runs the SQL retention routine: expire stale sessions, drop short-TTL
//    ai_raw debug payloads, delete anonymous sessions after 30 days.
//
// Protected by a shared secret header so it cannot be triggered at will.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { BUCKET, corsHeaders, json } from '../_shared/publicAnalysis.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const expected = Deno.env.get('PUBLIC_ANALYSIS_CLEANUP_KEY');
  const provided = req.headers.get('x-cleanup-key');
  if (!expected || !provided || provided !== expected) {
    return json({ error: 'Forbidden' }, 403);
  }

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // ── 1. Images past their 24h deadline ────────────────────────────────
    let imagesDeleted = 0;
    const { data: due, error: dueErr } = await admin.rpc('list_public_analysis_image_purge', {
      _limit: 200,
    });
    if (dueErr) throw dueErr;

    for (const row of (due ?? []) as { id: string; image_paths: string[] }[]) {
      const paths = Array.isArray(row.image_paths) ? row.image_paths : [];
      if (paths.length > 0) {
        const { error: rmErr } = await admin.storage.from(BUCKET).remove(paths);
        if (rmErr) continue; // retry on the next run rather than losing the paths
        imagesDeleted += paths.length;
      }
      await admin
        .from('public_analysis_sessions')
        .update({ image_paths: [], images_purge_at: null })
        .eq('id', row.id);
    }

    // ── 2. Orphan prefixes (session row already deleted) ─────────────────
    let orphansDeleted = 0;
    const { data: prefixes } = await admin.storage.from(BUCKET).list('', { limit: 500 });
    const folders = (prefixes ?? []).filter((p) => p.id === null).map((p) => p.name);
    if (folders.length > 0) {
      const { data: live } = await admin
        .from('public_analysis_sessions')
        .select('id')
        .in('id', folders);
      const liveIds = new Set((live ?? []).map((r: { id: string }) => r.id));
      for (const folder of folders) {
        if (liveIds.has(folder)) continue;
        const { data: objs } = await admin.storage.from(BUCKET).list(folder, { limit: 100 });
        const paths = (objs ?? []).filter((o) => o.id !== null).map((o) => `${folder}/${o.name}`);
        if (paths.length === 0) continue;
        const { error: rmErr } = await admin.storage.from(BUCKET).remove(paths);
        if (!rmErr) orphansDeleted += paths.length;
      }
    }

    // ── 3. Row retention ─────────────────────────────────────────────────
    const { data: purge, error: purgeErr } = await admin.rpc('purge_public_analysis_expired');
    if (purgeErr) throw purgeErr;

    return json({ ok: true, images_deleted: imagesDeleted, orphans_deleted: orphansDeleted, rows: purge });
  } catch (e) {
    console.error('[public-analysis-cleanup] failed', e instanceof Error ? e.message : e);
    return json({ error: 'Cleanup failed' }, 500);
  }
});
