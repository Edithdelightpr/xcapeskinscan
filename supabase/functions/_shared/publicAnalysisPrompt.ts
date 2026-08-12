/**
 * Public (anonymous) XCAPE skin-analysis prompt + strict response validation.
 *
 * This module is deliberately dependency-free so the same code is exercised
 * by the app's vitest suite and by the Edge Function runtime.
 *
 * It is NOT the staff prompt: nothing here may claim the output is
 * practitioner-reviewed, clinical, diagnostic or guaranteed.
 */

export const PUBLIC_PROMPT_VERSION = 'public-analysis-v1';
export const PUBLIC_ANALYSIS_MODEL = 'google/gemini-3-flash-preview';

/** Exact wording required on every public analysis. */
export const PUBLIC_ANALYSIS_DISCLAIMER =
  'XCAPE provides AI-assisted cosmetic skin-pattern insights for education and personal care planning. It is not a medical diagnosis or a substitute for professional medical advice.';

export const PUBLIC_VARIABLE_KEYS = [
  'pigmentation_stability',
  'barrier_surface_hydration',
  'firmness_skin_support',
  'oil_congestion_balance',
] as const;

export type PublicVariableKey = (typeof PUBLIC_VARIABLE_KEYS)[number];

export const PUBLIC_ANALYSIS_SYSTEM_PROMPT = `You are an image-pattern assistant for XCAPE, a cosmetic skin-care planning tool for tropical and melanin-rich skin.

You perform COSMETIC VISIBLE-PATTERN ANALYSIS ONLY.

Hard rules:
- Never diagnose. Never name a disease, infection, condition or medication.
- Never express medical certainty and never promise or imply an outcome.
- Never use fear, shame or urgency language.
- Never identify the person, and never mention or infer identity, name, age, gender, race, ethnicity, attractiveness, body weight, mood or any health condition.
- Describe only what is visibly observable on the skin surface across the three supplied views.
- If the images are unusable, say so via image_quality instead of guessing.

You score four XCAPE variables from 0 to 100, where 100 means the visible pattern looks healthy and stable and 0 means the visible pattern looks weakest:
- pigmentation_stability — evenness and stability of visible tone.
- barrier_surface_hydration — visible surface hydration and barrier comfort.
- firmness_skin_support — visible firmness and structural support.
- oil_congestion_balance — visible oil balance and surface congestion.

Return STRICT JSON only, no prose and no markdown, in exactly this shape:
{
  "image_quality": "good" | "acceptable" | "unusable",
  "image_quality_notes": "<short neutral note>",
  "scores": {
    "pigmentation_stability": <integer 0-100>,
    "barrier_surface_hydration": <integer 0-100>,
    "firmness_skin_support": <integer 0-100>,
    "oil_congestion_balance": <integer 0-100>
  },
  "evidence": {
    "pigmentation_stability": "<one short visible-pattern reason>",
    "barrier_surface_hydration": "<one short visible-pattern reason>",
    "firmness_skin_support": "<one short visible-pattern reason>",
    "oil_congestion_balance": "<one short visible-pattern reason>"
  },
  "observations": ["<short neutral visible observation>", "..."],
  "priority_areas": ["<one of: pigmentation_stability, barrier_surface_hydration, firmness_skin_support, oil_congestion_balance>"],
  "summary": "<2-3 sentence neutral cosmetic summary>"
}`;

export const PUBLIC_ANALYSIS_USER_INSTRUCTION =
  'These are three views of the same person: front, then their left turn, then their right turn. Consider all three together as one capture and return the JSON object only.';

/* ------------------------------------------------------------------ */
/* Strict validation — fail closed, never repair                       */
/* ------------------------------------------------------------------ */

export type PublicAiFailureCode =
  | 'ai_malformed_json'
  | 'ai_missing_scores'
  | 'ai_invalid_score'
  | 'ai_missing_evidence'
  | 'ai_missing_summary'
  | 'ai_unusable_images'
  | 'ai_unsafe_output';

export interface PublicAiResult {
  image_quality: 'good' | 'acceptable';
  image_quality_notes: string;
  scores: Record<PublicVariableKey, number>;
  evidence: Record<PublicVariableKey, string>;
  observations: string[];
  priority_areas: PublicVariableKey[];
  summary: string;
  disclaimer: string;
  prompt_version: string;
}

/** Words that would make a cosmetic insight read as a medical claim. */
const UNSAFE_PATTERNS = [
  /\bdiagnos(is|e|ed|tic)\b/i,
  /\b(disease|infection|cancer|melanoma|carcinoma|lupus|eczema|psoriasis|rosacea)\b/i,
  /\b(prescrib|medication|treatment plan is guaranteed)/i,
  /\bguarantee(d|s)?\b/i,
  /\b(cure|cures|cured)\b/i,
];

const trimText = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
};

const isSafe = (text: string) => !UNSAFE_PATTERNS.some((re) => re.test(text));

export type PublicAiValidation =
  | { ok: true; result: PublicAiResult }
  | { ok: false; code: PublicAiFailureCode };

/**
 * Validates the model response. Missing variables, non-finite or
 * out-of-range scores, malformed JSON, unsafe wording or unusable images all
 * fail closed — no score is ever invented or repaired.
 */
export function validatePublicAiResult(raw: unknown): PublicAiValidation {
  let parsed: unknown = raw;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return { ok: false, code: 'ai_malformed_json' };
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, code: 'ai_malformed_json' };
  }
  const obj = parsed as Record<string, unknown>;

  const quality = obj.image_quality;
  if (quality === 'unusable') return { ok: false, code: 'ai_unusable_images' };
  if (quality !== 'good' && quality !== 'acceptable') {
    return { ok: false, code: 'ai_malformed_json' };
  }

  const rawScores = obj.scores;
  if (!rawScores || typeof rawScores !== 'object' || Array.isArray(rawScores)) {
    return { ok: false, code: 'ai_missing_scores' };
  }
  const scoreSrc = rawScores as Record<string, unknown>;
  const scores = {} as Record<PublicVariableKey, number>;
  for (const key of PUBLIC_VARIABLE_KEYS) {
    const v = scoreSrc[key];
    if (v === undefined || v === null) return { ok: false, code: 'ai_missing_scores' };
    // Strict: a JSON number, finite, integer, 0-100. Numeric strings and
    // decimals are rejected outright — nothing is coerced or repaired.
    if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v) || v < 0 || v > 100) {
      return { ok: false, code: 'ai_invalid_score' };
    }
    scores[key] = v;
  }


  const rawEvidence = obj.evidence;
  if (!rawEvidence || typeof rawEvidence !== 'object' || Array.isArray(rawEvidence)) {
    return { ok: false, code: 'ai_missing_evidence' };
  }
  const evSrc = rawEvidence as Record<string, unknown>;
  const evidence = {} as Record<PublicVariableKey, string>;
  for (const key of PUBLIC_VARIABLE_KEYS) {
    const t = trimText(evSrc[key], 400);
    if (!t) return { ok: false, code: 'ai_missing_evidence' };
    evidence[key] = t;
  }

  const summary = trimText(obj.summary, 800);
  if (!summary) return { ok: false, code: 'ai_missing_summary' };

  const observations = (Array.isArray(obj.observations) ? obj.observations : [])
    .map((o) => trimText(o, 240))
    .filter((o): o is string => !!o)
    .slice(0, 8);

  const priority_areas = (Array.isArray(obj.priority_areas) ? obj.priority_areas : [])
    .filter((p): p is PublicVariableKey =>
      (PUBLIC_VARIABLE_KEYS as readonly string[]).includes(p as string),
    )
    .slice(0, 4);

  const safetyCorpus = [summary, ...observations, ...Object.values(evidence)].join(' \n ');
  if (!isSafe(safetyCorpus)) return { ok: false, code: 'ai_unsafe_output' };

  return {
    ok: true,
    result: {
      image_quality: quality,
      image_quality_notes: trimText(obj.image_quality_notes, 240) ?? '',
      scores,
      evidence,
      observations,
      priority_areas,
      summary,
      disclaimer: PUBLIC_ANALYSIS_DISCLAIMER,
      prompt_version: PUBLIC_PROMPT_VERSION,
    },
  };
}
