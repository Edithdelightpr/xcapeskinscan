// Retains ONE capture from an anonymous public skin-analysis session on the
// permanent client record, at the moment the visitor turns that session into a
// lead (name + phone + consent).
//
// Product rule: only the FRONT view is kept. Left/right views stay in the
// ephemeral demo bucket and are deleted by the retention worker within 24
// hours, exactly as promised on the public page.
//
// The copy is written to the canonical partner-readable key
//   clients/<client-id>/assessments/<assessment-id>/before/<file>
// which is what the `client-media` storage policies and the CRM read path
// (client_media rows scoped by assessment) both expect. Anything written
// elsewhere would be invisible to the practitioner afterwards.
import { BUCKET } from './publicAnalysis.ts';

const TARGET_BUCKET = 'client-media';
const CAPTION = 'Public skin analysis: Front view';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

/**
 * Best-effort and idempotent: a failure here must never block the visitor's
 * report, and a repeated claim must never duplicate the photo.
 */
export async function retainFrontCapture(
  admin: Admin,
  input: {
    clientId: string;
    assessmentId: string;
    imagePaths: unknown;
  },
): Promise<'stored' | 'skipped' | 'failed'> {
  try {
    const paths = Array.isArray(input.imagePaths) ? input.imagePaths.filter((p) => typeof p === 'string') : [];
    const front = paths.find((p: string) => /\/front\.[a-z0-9]+$/i.test(p));
    if (!front) return 'skipped';

    const { data: existing, error: existErr } = await admin
      .from('client_media')
      .select('id')
      .eq('assessment_id', input.assessmentId)
      .limit(1);
    if (existErr) throw existErr;
    if ((existing ?? []).length > 0) return 'skipped';

    const { data: blob, error: dlErr } = await admin.storage.from(BUCKET).download(front);
    if (dlErr || !blob) return 'failed';

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const ext = front.split('.').pop()?.toLowerCase() === 'png' ? 'png' : 'jpg';
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
    const fileName = `front.${ext}`;
    const target = `clients/${input.clientId}/assessments/${input.assessmentId}/before/${Date.now()}-${fileName}`;

    const { error: upErr } = await admin.storage
      .from(TARGET_BUCKET)
      .upload(target, bytes, { contentType: mime, upsert: false });
    if (upErr) return 'failed';

    const { error: insErr } = await admin.from('client_media').insert({
      client_id: input.clientId,
      assessment_id: input.assessmentId,
      bucket_path: target,
      storage_path: target,
      mime_type: mime,
      size_bytes: bytes.byteLength,
      kind: 'before',
      category: 'before',
      file_type: 'image',
      file_name: fileName,
      caption: CAPTION,
    });
    if (insErr) {
      await admin.storage.from(TARGET_BUCKET).remove([target]);
      return 'failed';
    }
    return 'stored';
  } catch (_e) {
    return 'failed';
  }
}
