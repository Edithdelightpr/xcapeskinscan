// EDGE MIRROR — byte-identical MIRROR REGION of src/lib/xcapeReportLanguage.ts.
// Do not edit here without updating the canonical file in the same commit.
// Parity enforced by src/lib/reportConcernFormatter.parity.test.ts.

// ---- MIRROR REGION START ------------------------------------------------

export const REPORT_LANGUAGE_VERSION = 'xcape-report-language-v2';

export type LanguageVariableKey =
  | 'pigmentation_stability'
  | 'barrier_surface_hydration'
  | 'firmness_skin_support'
  | 'oil_congestion_balance';

export const LANGUAGE_VARIABLE_KEYS: LanguageVariableKey[] = [
  'pigmentation_stability',
  'barrier_surface_hydration',
  'firmness_skin_support',
  'oil_congestion_balance',
];

export const LANGUAGE_VARIABLE_NAME: Record<LanguageVariableKey, string> = {
  pigmentation_stability: 'Hyperpigmentation',
  barrier_surface_hydration: 'Surface Dehydration',
  firmness_skin_support: 'Weak Elasticity',
  oil_congestion_balance: 'Over-Sebaceous Activity (Clogged Pores)',
};

/** Short client-safe area name used inside sentences. */
export const LANGUAGE_VARIABLE_SHORT: Record<LanguageVariableKey, string> = {
  pigmentation_stability: 'tone evenness',
  barrier_surface_hydration: 'surface hydration',
  firmness_skin_support: 'firmness support',
  oil_congestion_balance: 'oil and congestion balance',
};

/* ------------------------------------------------------------------ */
/* Communication bands — raw score driven, truthful labels            */
/* ------------------------------------------------------------------ */

export type CommBand =
  | 'priority'
  | 'active'
  | 'correction'
  | 'watch'
  | 'maintenance'
  | 'preventive';

export interface CommBandDefinition {
  band: CommBand;
  range: [number, number];
  label: string;
  /** Active concerns render in full; stable findings may collapse. */
  active: boolean;
}

export const COMM_BANDS: CommBandDefinition[] = [
  { band: 'priority', range: [0, 20], label: 'Priority concern', active: true },
  { band: 'active', range: [21, 40], label: 'Active concern', active: true },
  { band: 'correction', range: [41, 60], label: 'Needs correction', active: true },
  { band: 'watch', range: [61, 80], label: 'Mild concern / watch area', active: true },
  { band: 'maintenance', range: [81, 90], label: 'Stable with maintenance need', active: false },
  { band: 'preventive', range: [91, 100], label: 'Strong / preventive care', active: false },
];

const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function communicationBandFor(score: number): CommBandDefinition {
  const s = clampScore(score);
  return COMM_BANDS.find((b) => s >= b.range[0] && s <= b.range[1]) ?? COMM_BANDS[0];
}

export const commBandLabel = (score: number): string => communicationBandFor(score).label;

/** Active concern = shown in full. Stable = collapsible summary, score still visible. */
export const isActiveConcern = (score: number): boolean => communicationBandFor(score).active;

/* ------------------------------------------------------------------ */
/* Copy bank — 4 variables x 10 raw stages = 40 entries               */
/* ------------------------------------------------------------------ */

/** Raw ten-step stage keys. Selected from the RAW score, never calibrated. */
export type LanguageStage =
  | 'critical' | 'very_low' | 'low' | 'mild' | 'moderate'
  | 'fair' | 'good' | 'strong' | 'very_strong' | 'optimal';

export const LANGUAGE_STAGES: { stage: LanguageStage; range: [number, number] }[] = [
  { stage: 'critical', range: [0, 10] },
  { stage: 'very_low', range: [11, 20] },
  { stage: 'low', range: [21, 30] },
  { stage: 'mild', range: [31, 40] },
  { stage: 'moderate', range: [41, 50] },
  { stage: 'fair', range: [51, 60] },
  { stage: 'good', range: [61, 70] },
  { stage: 'strong', range: [71, 80] },
  { stage: 'very_strong', range: [81, 90] },
  { stage: 'optimal', range: [91, 100] },
];

export function languageStageFor(score: number): LanguageStage {
  const s = clampScore(score);
  return (LANGUAGE_STAGES.find((r) => s >= r.range[0] && s <= r.range[1]) ?? LANGUAGE_STAGES[0]).stage;
}

export interface ClientConcernCopy {
  /** 1. What XCAPE detected, including the shortcoming. */
  detected: string;
  /** 2. Why it matters for this person's skin. */
  whyItMatters: string;
  /** 3. If left unsupported, phrased carefully and non-diagnostically. */
  ifLeftUnsupported: string;
  /** 4. The controlled XCAPE protocol direction. Never a product promise. */
  xcapeResponse: string;
  /** 5. Reassurance, always last. */
  reassurance: string;
}

type Tier = 'severe' | 'clear' | 'early' | 'stable';

const TIER_BY_STAGE: Record<LanguageStage, Tier> = {
  critical: 'severe',
  very_low: 'severe',
  low: 'clear',
  mild: 'clear',
  moderate: 'early',
  fair: 'early',
  good: 'early',
  strong: 'stable',
  very_strong: 'stable',
  optimal: 'stable',
};

/** Detected line per variable per raw stage. Every one of the 40 is distinct. */
const DETECTED: Record<LanguageVariableKey, Record<LanguageStage, string>> = {
  pigmentation_stability: {
    critical:
      'Your images show a widespread uneven tone pattern, with darker areas visible across several parts of the face. Tone evenness is the weakest reading in this assessment.',
    very_low:
      'Your images show a strongly uneven tone pattern, with dark marks visible across more than one area of the face.',
    low: 'Your images show a clearly uneven tone pattern, with dark marks concentrated in specific areas rather than spread evenly.',
    mild: 'Your images show a visible unevenness in tone, with some areas reading darker than the surrounding skin.',
    moderate:
      'Your images show a moderate unevenness in tone. The visible surface pattern is not severe, but it can still be seen.',
    fair: 'Your images show a mild unevenness in tone, mostly in the areas that receive the most sun exposure.',
    good: 'Your images show mostly even tone, with a small number of visible marks in this capture.',
    strong:
      'Your images show even tone across most of the face, with only faint marks still visible.',
    very_strong:
      'Your images show even, settled tone. Nothing in this capture reads as an active pigmentation pattern.',
    optimal:
      'Your images show consistently even tone with no visible pigmentation pattern in this capture.',
  },
  barrier_surface_hydration: {
    critical:
      'Your images show a very dry, tight-looking surface. Surface hydration is the weakest reading in this assessment.',
    very_low:
      'Your images show a noticeably dry surface, with a flat, dull visible surface pattern.',
    low: 'Your images show clear surface dryness, with a texture that reads rough rather than smooth in the light.',
    mild: 'Your images show early surface dryness, with patches that read drier than the rest of the face.',
    moderate:
      'Your images show moderate surface dryness. Some areas read comfortable and others read dry in this capture.',
    fair: 'Your images show mild surface dryness, mostly in the areas that tend to read dry first.',
    good: 'Your images show a mostly comfortable-looking surface, with light dryness in one or two areas.',
    strong:
      'Your images show a smooth, well-hydrated-looking surface, with no meaningful dry patches in this capture.',
    very_strong:
      'Your images show a consistently hydrated-looking surface, with no visible dry areas in this capture.',
    optimal:
      'Your images show an even, well-hydrated-looking surface with no visible dryness in this capture.',
  },
  firmness_skin_support: {
    critical:
      'Your images show a marked loss of visible firmness, with softening along the cheeks and jawline. Firmness support is the weakest reading in this assessment.',
    very_low:
      'Your images show a clear loss of visible firmness, with lines and softening that can be seen in the capture.',
    low: 'Your images show reduced visible firmness, with lines that stay visible when the face is at rest.',
    mild: 'Your images show an early loss of visible firmness, with fine lines visible in a few areas.',
    moderate:
      'Your images show a moderate visible firmness pattern. Contours read supported in places and softer in others.',
    fair: 'Your images show mild visible softening, mostly in the areas that move the most.',
    good: 'Your images show mostly good visible firmness, with only light early signs in one or two areas.',
    strong: 'Your images show firm-looking, well-supported contours with minimal visible softening.',
    very_strong:
      'Your images show strong visible firmness. Nothing in this capture reads as an active elasticity pattern.',
    optimal: 'Your images show excellent visible firmness with no visible softening in this capture.',
  },
  oil_congestion_balance: {
    critical:
      'Your images show heavy surface shine with widespread congestion and visible breakouts. Oil and congestion balance is the weakest reading in this assessment.',
    very_low:
      'Your images show high surface shine with clearly congested pores across more than one area.',
    low: 'Your images show raised surface shine with visible congestion, mostly through the T-zone and cheeks.',
    mild: 'Your images show early surface shine with pores that read congested in specific areas.',
    moderate:
      'Your images show a moderate oil and congestion pattern. Congestion can be seen in places but not across the face.',
    fair: 'Your images show mild surface shine with occasional congestion in the areas that shine first.',
    good: 'Your images show mostly balanced surface shine, with light congestion in one or two spots.',
    strong: 'Your images show balanced surface shine and clear-looking pores in this capture.',
    very_strong:
      'Your images show consistently balanced surface shine with no meaningful visible congestion.',
    optimal: 'Your images show clear-looking pores and balanced surface shine throughout this capture.',
  },
};

/** Reason the shortcoming matters, per variable, per severity tier. */
const WHY: Record<LanguageVariableKey, Record<Tier, string>> = {
  pigmentation_stability: {
    severe:
      'Uneven tone is what most people notice first, and in melanin-rich skin marks left after irritation can remain visible long after the irritation itself has settled.',
    clear:
      'In melanin-rich skin, an episode of irritation can leave a mark that remains visible for some time, so tone unevenness can build up rather than reset on its own.',
    early:
      'Tone unevenness is generally easier to work with when it is addressed early rather than left in place.',
    stable:
      'Even tone can be easy to lose and slow to rebuild, so protecting it is generally worth more than correcting it later.',
  },
  barrier_surface_hydration: {
    severe:
      'A dry-looking surface can make skin feel tight and uncomfortable, and it can make a routine harder to tolerate.',
    clear:
      'When the surface reads dry, skin can feel less comfortable and can react to steps it normally tolerates.',
    early:
      'Surface hydration shapes how comfortable your skin feels day to day and how easily a routine can be kept up.',
    stable:
      'A hydrated-looking surface is worth protecting, and it can be the first thing to change during travel, heat or air conditioning.',
  },
  firmness_skin_support: {
    severe:
      'Reduced visible firmness can change how rested and defined the face looks in photographs and in the mirror.',
    clear:
      'Visible firmness tends to change gradually, so the changes you can see now are the ones consistent support can work with.',
    early:
      'Visible firmness generally responds better to steady support than to occasional intensive treatment.',
    stable:
      'Visible firmness is supported by consistency and by daylight protection, both of which are easier to keep than to restore.',
  },
  oil_congestion_balance: {
    severe:
      'Congested pores are where breakouts can start, and in melanin-rich skin a breakout can leave a mark that remains visible after the spot itself has gone.',
    clear:
      'Congestion can repeat in the same areas, and each repeat can raise the chance of a mark that remains visible.',
    early:
      'Excess surface oil can accompany a dry-reading surface, so balance is usually approached by supporting hydration as well as controlling oil.',
    stable:
      'Balanced oil helps keep pores clear, and maintaining that balance is generally easier than clearing congestion once it settles.',
  },
};

const IF_LEFT: Record<LanguageVariableKey, Record<Tier, string>> = {
  pigmentation_stability: {
    severe:
      'Without support, and with continued sun exposure, a pattern like this can remain visible and can become more pronounced.',
    clear: 'Without support, this visible surface pattern can remain visible and can darken with sun exposure.',
    early: 'Without support, mild unevenness can become more defined over time.',
    stable: 'Without daily protection, even settled tone can start to shift again.',
  },
  barrier_surface_hydration: {
    severe:
      'Without support, a dry-reading surface can stay uncomfortable and stronger products can become harder to tolerate.',
    clear: 'Without support, dryness can remain visible and your skin may react more easily.',
    early: 'Without support, early dryness can spread across more of the face.',
    stable: 'Without consistent hydration, comfort can drop in heat or air conditioning.',
  },
  firmness_skin_support: {
    severe: 'Without support, visible softening can continue rather than settle on its own.',
    clear: 'Without support, these early lines can become more set over time.',
    early: 'Without support, mild visible softening can progress gradually.',
    stable: 'Without protection from daily sun exposure, visible firmness can decline faster than it needs to.',
  },
  oil_congestion_balance: {
    severe:
      'Without support, congestion at this level can keep producing breakouts and the marks that can follow them.',
    clear: 'Without support, congestion can keep returning in the same areas.',
    early: 'Without support, early congestion can develop into recurring breakouts.',
    stable: 'Without maintenance, congestion can return during heat, humidity or routine changes.',
  },
};

/** Practitioner-confirmed protocol direction. Never a product promise. */
const PRACTITIONER_NOTE =
  'Your final preparation is confirmed by a practitioner before anything is made.';

const RESPONSE: Record<LanguageVariableKey, Record<Tier, string>> = {
  pigmentation_stability: {
    severe:
      `XCAPE places this in its higher-support protocol direction: a coordinated exfoliating and melanin-control direction, always paired with the required anti-inflammatory companion, at the dose your score calls for. ${PRACTITIONER_NOTE}`,
    clear:
      `XCAPE places this in its higher-support protocol direction: a coordinated exfoliating and melanin-control direction with the required anti-inflammatory companion, at the dose your score calls for. ${PRACTITIONER_NOTE}`,
    early:
      `XCAPE applies its exfoliating and melanin-control direction with the required anti-inflammatory companion, at the lighter dose your score calls for. ${PRACTITIONER_NOTE}`,
    stable:
      'XCAPE keeps this in preventive care. No pigmentation customization is called for by this score alone.',
  },
  barrier_surface_hydration: {
    severe:
      `XCAPE customizes your facial moisturizer for surface hydration, at the dose your score calls for. Your cleanser and toner are not customized for this. ${PRACTITIONER_NOTE}`,
    clear:
      `XCAPE customizes your facial moisturizer for surface hydration, at the dose your score calls for. ${PRACTITIONER_NOTE}`,
    early:
      `XCAPE customizes your facial moisturizer at the lighter dose your score calls for. ${PRACTITIONER_NOTE}`,
    stable:
      'XCAPE keeps this in maintenance. No hydration customization is called for by this score alone.',
  },
  firmness_skin_support: {
    severe:
      `XCAPE applies its anti-aging and elasticity direction, at the dose your score calls for. ${PRACTITIONER_NOTE}`,
    clear:
      `XCAPE applies its anti-aging and elasticity direction, at the dose your score calls for. ${PRACTITIONER_NOTE}`,
    early:
      `XCAPE applies its anti-aging and elasticity direction at the lighter dose your score calls for. ${PRACTITIONER_NOTE}`,
    stable:
      'XCAPE keeps this in preventive care. No elasticity customization is called for by this score alone.',
  },
  oil_congestion_balance: {
    severe:
      `XCAPE places this in its higher-support protocol direction: the overactive-sebaceous direction with the required anti-inflammatory companion, at the dose your score calls for. ${PRACTITIONER_NOTE}`,
    clear:
      `XCAPE applies the overactive-sebaceous direction with the required anti-inflammatory companion, at the dose your score calls for. ${PRACTITIONER_NOTE}`,
    early:
      `XCAPE applies the overactive-sebaceous direction with its required companion at the lighter dose your score calls for. ${PRACTITIONER_NOTE}`,
    stable:
      'XCAPE keeps this in maintenance. No sebaceous customization is called for by this score alone.',
  },
};

const REASSURANCE: Record<LanguageVariableKey, Record<Tier, string>> = {
  pigmentation_stability: {
    severe: 'This is a familiar pattern in tropical and melanin-rich skin, and it is workable with the right sequence.',
    clear: 'This is common, and a consistent, correctly sequenced routine is the usual starting point.',
    early: 'Addressed at this stage, this area is generally one of the more straightforward to work on.',
    stable: 'This area is reading well. Keeping it there is straightforward.',
  },
  barrier_surface_hydration: {
    severe: 'Surface hydration is often one of the more straightforward areas to support once a routine is consistent.',
    clear: 'A consistent hydration routine is the usual starting point for this area.',
    early: 'Small, steady changes are usually the starting point here.',
    stable: 'This area is reading well. A steady routine helps keep it that way.',
  },
  firmness_skin_support: {
    severe: 'Visible firmness is a long game, and steady support here is the usual approach.',
    clear: 'Consistency generally matters more than intensity in this area.',
    early: 'Starting now gives this area the longest runway.',
    stable: 'This area is reading well, and daily protection helps keep it there.',
  },
  oil_congestion_balance: {
    severe: 'Congestion at this level is common, and the usual approach is to calm the skin rather than strip it.',
    clear: 'This area is usually approached by handling oil control and hydration together.',
    early: 'Handled now, this area is generally more straightforward to keep in balance.',
    stable: 'This area is reading well. Maintenance is enough for now.',
  },
};


/** Fully materialised 4 x 10 client copy bank. */
export const REPORT_COPY_BANK_V2: Record<
  LanguageVariableKey,
  Record<LanguageStage, ClientConcernCopy>
> = (() => {
  const out = {} as Record<LanguageVariableKey, Record<LanguageStage, ClientConcernCopy>>;
  for (const key of LANGUAGE_VARIABLE_KEYS) {
    const perStage = {} as Record<LanguageStage, ClientConcernCopy>;
    for (const { stage } of LANGUAGE_STAGES) {
      const tier = TIER_BY_STAGE[stage];
      perStage[stage] = {
        detected: DETECTED[key][stage],
        whyItMatters: WHY[key][tier],
        ifLeftUnsupported: IF_LEFT[key][tier],
        xcapeResponse: RESPONSE[key][tier],
        reassurance: REASSURANCE[key][tier],
      };
    }
    out[key] = perStage;
  }
  return out;
})();

/** Client copy for one concern at its RAW displayed score. */
export function clientCopyFor(key: LanguageVariableKey, score: number): ClientConcernCopy {
  return REPORT_COPY_BANK_V2[key][languageStageFor(score)];
}

/* ------------------------------------------------------------------ */
/* Priority synthesis — always names the weakest area(s)              */
/* ------------------------------------------------------------------ */

export interface PrioritySynthesis {
  /** Weakest first, at most two. Always at least one when any score exists. */
  weakest: LanguageVariableKey[];
  /** One-line headline naming the weakest area. */
  headline: string;
  /** Supporting lines, including any established interaction. */
  lines: string[];
  /** Average of the supplied raw scores, or null. */
  overall: number | null;
  /** True when no reading is an active concern; the headline is a maintenance focus. */
  allStable: boolean;
}


const byScoreThenKey = (
  entries: [LanguageVariableKey, number][],
): [LanguageVariableKey, number][] =>
  [...entries].sort((a, b) => (a[1] === b[1] ? a[0].localeCompare(b[0]) : a[1] - b[1]));

/**
 * Pure summary from the four raw scores. It always names the weakest area,
 * even when the overall average is high, and it only states an interaction
 * that the XCAPE protocol already recognises.
 */
export function prioritySynthesis(
  scores: Partial<Record<LanguageVariableKey, number>>,
): PrioritySynthesis {
  const entries = LANGUAGE_VARIABLE_KEYS
    .filter((k) => typeof scores[k] === 'number' && Number.isFinite(scores[k] as number))
    .map((k) => [k, clampScore(scores[k] as number)] as [LanguageVariableKey, number]);

  if (entries.length === 0) {
    return { weakest: [], headline: 'No scored areas are available for this assessment.', lines: [], overall: null, allStable: false };
  }

  const sorted = byScoreThenKey(entries);
  const overall = Math.round(sorted.reduce((a, [, v]) => a + v, 0) / sorted.length);

  const [first, second] = sorted;
  const weakest: LanguageVariableKey[] = [first[0]];
  // A second area joins the priority set when it is also active (<= 80) and
  // close behind the weakest reading.
  if (second && second[1] <= 80 && second[1] - first[1] <= 15) weakest.push(second[0]);

  // Every reading is stable. The weakest area is still named, but it is the
  // first maintenance focus rather than something that needs attention.
  const allStable = sorted.every(([, v]) => !isActiveConcern(v));

  const name = (k: LanguageVariableKey) => LANGUAGE_VARIABLE_NAME[k];
  const headline = allStable
    ? `${name(weakest[0])} is your first maintenance focus.`
    : weakest.length > 1
      ? `${name(weakest[0])} needs attention first, with ${name(weakest[1])} close behind.`
      : `${name(weakest[0])} needs attention first.`;

  const lines: string[] = [];
  for (const [key, value] of sorted.slice(0, weakest.length)) {
    lines.push(`${name(key)} scored ${value} out of 100, read as ${commBandLabel(value).toLowerCase()}.`);
  }

  const scoreOf = (k: LanguageVariableKey) => sorted.find(([key]) => key === k)?.[1] ?? null;
  const hydration = scoreOf('barrier_surface_hydration');
  const oil = scoreOf('oil_congestion_balance');
  if (hydration != null && oil != null && hydration <= 60 && oil <= 60) {
    lines.push(
      'Surface dehydration and excess surface oil are reading low together. Excess oil can accompany a dry-reading surface, so XCAPE supports hydration alongside oil control rather than stripping the skin.',
    );
  }

  const pigment = scoreOf('pigmentation_stability');
  if (pigment != null && oil != null && pigment <= 60 && oil <= 60) {
    lines.push(
      'Tone unevenness and congestion are reading low together. Calming congestion first can reduce the marks that breakouts leave behind.',
    );
  }

  const stableCount = sorted.filter(([, v]) => !isActiveConcern(v)).length;
  if (stableCount > 0) {
    lines.push(
      `${stableCount} of your ${sorted.length} readings are stable and are summarised further down, with their scores kept visible.`,
    );
  }

  return { weakest, headline, lines, overall, allStable };

}

// ---- MIRROR REGION END --------------------------------------------------
