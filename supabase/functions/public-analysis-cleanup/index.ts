// Retention worker for the anonymous public skin-analysis demo.
//
// Order matters (failure-safe): storage objects are deleted FIRST, the
// recorded paths are cleared SECOND, and only then does the SQL routine
// delete session rows — a row that still lists image paths is never deleted,
// so stored images can never be orphaned.
//
// It also reconciles the bucket restrictions (private, 8 MB, jpeg/png) on
// every run, because SQL writes to storage.buckets are not permitted.
//
// Auth: shared cleanup key (x-cleanup-key) or the project cron secret
// (x-cron-secret) used by the scheduled hourly invocation.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { BUCKET, BUCKET_CONFIG, corsHeaders, json } from '../_shared/publicAnalysis.ts';

const PAGE = 100;
const MAX_ORPHAN_FOLDERS = 5000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Shared cleanup key (manual runs) OR the vault-stored project cron secret
  // (scheduled hourly run). No secret is ever committed to the repo.
  const cleanupKey = Deno.env.get('PUBLIC_ANALYSIS_CLEANUP_KEY');
  const providedCleanup = req.headers.get('x-cleanup-key') ?? '';
  const providedCron = req.headers.get('x-cron-secret') ?? '';
  let authorized = !!cleanupKey && providedCleanup === cleanupKey;
  if (!authorized && providedCron) {
    const { data: cronOk } = await admin.rpc('verify_cron_secret', { candidate: providedCron });
    authorized = cronOk === true;
  }
  if (!authorized) return json({ error: 'Forbidden' }, 403);

  try {

    // ── 0. Reconcile bucket restrictions (idempotent) ────────────────────
    const { error: bucketErr } = await admin.storage.updateBucket(BUCKET, {
      public: BUCKET_CONFIG.public,
      fileSizeLimit: BUCKET_CONFIG.fileSizeLimit,
      allowedMimeTypes: [...BUCKET_CONFIG.allowedMimeTypes],
    });
    if (bucketErr) {
      // Fail closed: never report success while the bucket restrictions
      // (private, size cap, MIME allow-list) are unconfirmed.
      console.error('[public-analysis-cleanup] bucket reconcile failed');
      return json({ ok: false, error: 'Bucket reconciliation failed' }, 500);
    }

    // ── 1. Images past their deadline (or whose session is due for purge) ─
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
    // Deleting a folder shifts every later entry, so the cursor only ever
    // advances past folders that were deliberately KEPT. Deleted folders
    // disappear from the listing, which keeps the walk complete and the
    // whole pass idempotent.
    let orphansDeleted = 0;
    let scanned = 0;
    let offset = 0;
    while (scanned < MAX_ORPHAN_FOLDERS) {
      const { data: page } = await admin.storage.from(BUCKET).list('', { limit: PAGE, offset });
      const entries = page ?? [];
      if (entries.length === 0) break;
      const folders = entries.filter((p) => p.id === null).map((p) => p.name);
      scanned += entries.length;
      let kept = entries.length - folders.length; // non-folder entries stay put
      if (folders.length > 0) {
        const { data: live } = await admin
          .from('public_analysis_sessions')
          .select('id')
          .in('id', folders);
        const liveIds = new Set((live ?? []).map((r: { id: string }) => r.id));
        for (const folder of folders) {
          if (liveIds.has(folder)) {
            kept++;
            continue;
          }
          const { data: objs } = await admin.storage.from(BUCKET).list(folder, { limit: 100 });
          const objPaths = (objs ?? []).filter((o) => o.id !== null).map((o) => `${folder}/${o.name}`);
          if (objPaths.length > 0) {
            const { error: rmErr } = await admin.storage.from(BUCKET).remove(objPaths);
            if (rmErr) {
              kept++; // retry next run; do not skip past it
              continue;
            }
            orphansDeleted += objPaths.length;
          }
        }
      }
      offset += kept;
      if (entries.length < PAGE) break;
    }

    // ── 3. Row retention (skips rows that still own objects) ─────────────
    const { data: purge, error: purgeErr } = await admin.rpc('purge_public_analysis_expired');
    if (purgeErr) throw purgeErr;

    return json({
      ok: true,
      bucket_reconciled: !bucketErr,
      images_deleted: imagesDeleted,
      folders_scanned: scanned,
      orphans_deleted: orphansDeleted,
      rows: purge,
    });
  } catch (e) {
    console.error('[public-analysis-cleanup] failed', e instanceof Error ? e.message : e);
    return json({ error: 'Cleanup failed' }, 500);
  }
});
