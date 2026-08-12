// Server-side single-face + head-pose verification.
//
// Reuses the vision capability already used by the authenticated flow
// (`analyze-skin-image`): the Lovable AI Gateway, called with a pinned
// model. Only a tiny structured judgement is requested — face count and
// coarse head pose. No landmarks, embeddings or other biometric data are
// requested, returned or stored.
import { MAX_FACE_FRACTION, MIN_FACE_FRACTION, type ViewId } from './publicAnalysis.ts';

export const FACE_CHECK_MODEL = 'google/gemini-3-flash-preview';
export const FACE_CHECK_PROMPT_VERSION = 'face-check-v1';

const SYSTEM = `You are an image QA checker for a cosmetic skin-analysis capture step.
You never diagnose, never describe the person and never identify anyone.
Return ONLY JSON: {"face_count": <integer 0-5>, "pose": "front"|"left"|"right"|"unclear", "face_fraction": <0-1>}
- face_count: number of distinct human faces clearly visible.
- pose: head orientation from the CAMERA's point of view.
  "front" = looking straight at the camera (both ears/cheeks roughly symmetric).
  "left"  = the person has turned their head to THEIR OWN left (camera sees more of their right cheek).
  "right" = the person has turned their head to THEIR OWN right.
  "unclear" = cannot tell, face obscured, or not a real photographed human face.
- face_fraction: approximate fraction of the image height covered by the face.`;

export interface FaceCheck {
  ok: boolean;
  faceCount: number;
  pose: 'front' | 'left' | 'right' | 'unclear';
  faceFraction: number;
}

/** Returns null when the vision service is unavailable (fail-closed caller). */
export async function checkFace(
  jpegBase64: string,
  _view: ViewId,
): Promise<FaceCheck | null> {
  const key = Deno.env.get('LOVABLE_API_KEY');
  if (!key) return null;

  let resp: Response;
  try {
    resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: FACE_CHECK_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Check this capture and return the JSON only.' },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${jpegBase64}` },
              },
            ],
          },
        ],
      }),
    });
  } catch {
    return null;
  }
  if (!resp.ok) return null;

  try {
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    const faceCount = Number(parsed?.face_count);
    const pose = parsed?.pose;
    return {
      ok: true,
      faceCount: Number.isFinite(faceCount) ? faceCount : 0,
      pose: pose === 'front' || pose === 'left' || pose === 'right' ? pose : 'unclear',
      faceFraction: Number(parsed?.face_fraction) || 0,
    };
  } catch {
    return null;
  }
}

/**
 * Enforces the documented face-size window. `face_fraction` is the fraction
 * of image height covered by the face. A missing/zero value is treated as
 * "not reported" and never rejects on its own.
 */
export function faceSizeCode(fraction: number): 'ok' | 'face_too_small' | 'face_too_close' {
  if (!Number.isFinite(fraction) || fraction <= 0) return 'ok';
  if (fraction < MIN_FACE_FRACTION) return 'face_too_small';
  if (fraction > MAX_FACE_FRACTION) return 'face_too_close';
  return 'ok';
}
