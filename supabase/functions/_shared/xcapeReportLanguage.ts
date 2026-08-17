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
      'Your images show widespread uneven tone, with dark patches covering several areas of the face. Tone evenness is the weakest reading in this assessment.',
    very_low:
      'Your images show strongly uneven tone, with dark marks that are visible across more than one area of the face.',
    low: 'Your images show clearly uneven tone, with dark marks concentrated in specific areas rather than spread evenly.',
    mild: 'Your images show visible unevenness in tone, with some areas reading noticeably darker than the surrounding skin.',
    moderate:
      'Your images show moderate unevenness in tone. The pattern is not severe, but it is visible and it is not yet settled.',
    fair: 'Your images show mild unevenness in tone, mostly in the areas that receive the most sun exposure.',
    good: 'Your images show mostly even tone, with a small number of visible marks that have not fully faded.',
    strong:
      'Your images show even tone across most of the face, with only faint traces of past marks still visible.',
    very_strong:
      'Your images show even, settled tone. Nothing in this reading points to an active pigmentation concern right now.',
    optimal:
      'Your images show consistently even tone with no visible pigmentation pattern in this capture.',
  },
  barrier_surface_hydration: {
    critical:
      'Your images show a very dry, tight-looking surface. Surface hydration is the weakest reading in this assessment.',
    very_low:
      'Your images show a noticeably dry surface, with the flat, dull look that comes with low surface hydration.',
    low: 'Your images show clear surface dryness, with a texture that reads rough rather than smooth in the light.',
    mild: 'Your images show early surface dryness, with patches that look drier than the rest of the face.',
    moderate:
      'Your images show moderate surface dryness. Your skin is holding some moisture, but not consistently across the face.',
    fair: 'Your images show mild surface dryness, mostly around the areas that dry out first.',
    good: 'Your images show mostly comfortable surface hydration, with light dryness in one or two areas.',
    strong:
      'Your images show a smooth, well-hydrated surface, with no meaningful dry patches in this capture.',
    very_strong:
      'Your images show a consistently hydrated surface. Your barrier is doing its job in this reading.',
    optimal:
      'Your images show an even, well-hydrated surface with no visible dryness in this capture.',
  },
  firmness_skin_support: {
    critical:
      'Your images show significant loss of visible firmness, with softening along the cheeks and jawline. Firmness support is the weakest reading in this assessment.',
    very_low:
      'Your images show clear loss of visible firmness, with lines and softening that are easy to see in the capture.',
    low: 'Your images show reduced visible firmness, with lines that stay visible when the face is at rest.',
    mild: 'Your images show early loss of visible firmness, with fine lines starting to hold in a few areas.',
    moderate:
      'Your images show moderate firmness support. The structure is holding, but the bounce-back looks reduced.',
    fair: 'Your images show mild softening in firmness, mostly in the areas that move the most.',
    good: 'Your images show mostly good firmness support, with only light early signs in one or two areas.',
    strong: 'Your images show firm, well-supported skin with minimal visible softening.',
    very_strong:
      'Your images show strong firmness support. Nothing in this reading points to an active elasticity concern.',
    optimal: 'Your images show excellent firmness support with no visible loss in this capture.',
  },
  oil_congestion_balance: {
    critical:
      'Your images show heavy oil on the surface with widespread congestion and visible breakouts. Oil and congestion balance is the weakest reading in this assessment.',
    very_low:
      'Your images show high oil on the surface with clearly congested pores across more than one area.',
    low: 'Your images show elevated oil with visible congestion, mostly through the T-zone and cheeks.',
    mild: 'Your images show early oil build-up with pores that read congested in specific areas.',
    moderate:
      'Your images show moderate oil activity. Congestion is present in places but it is not spread across the face.',
    fair: 'Your images show mild oil activity with occasional congestion in the areas that oil first.',
    good: 'Your images show mostly balanced oil, with light congestion in one or two spots.',
    strong: 'Your images show well-balanced oil and clear pores in this capture.',
    very_strong:
      'Your images show consistently balanced oil with no meaningful congestion in this reading.',
    optimal: 'Your images show clear pores and balanced oil throughout this capture.',
  },
};

/** Reason the shortcoming matters, per variable, per severity tier. */
const WHY: Record<LanguageVariableKey, Record<Tier, string>> = {
  pigmentation_stability: {
    severe:
      'Uneven tone is what most people notice first, and in melanin-rich skin the marks left behind by irritation take much longer to fade than the irritation itself.',
    clear:
      'In melanin-rich skin, every episode of irritation can leave a mark that outlasts its cause, so tone unevenness tends to build up over time rather than reset on its own.',
    early:
      'Tone unevenness responds well when it is addressed early, because fresh marks sit closer to the surface than older ones.',
    stable:
      'Even tone is easy to lose and slow to rebuild, so protecting it is worth more than correcting it later.',
  },
  barrier_surface_hydration: {
    severe:
      'A dry surface makes skin feel tight and uncomfortable, and it limits how well anything you apply is absorbed.',
    clear:
      'When the surface is dry, products sit on top instead of working, and your skin can react to steps it normally tolerates.',
    early:
      'Surface hydration decides how comfortable your skin feels and how well the rest of your routine performs.',
    stable:
      'A hydrated surface is what keeps the rest of your routine working, and it is the first thing to drop during travel, heat or air conditioning.',
  },
  firmness_skin_support: {
    severe:
      'Reduced firmness changes how rested and defined the face looks, and it affects how the skin holds after expression.',
    clear:
      'Firmness declines gradually, so the changes you can see now are the ones that respond best to consistent support.',
    early:
      'Firmness responds to steady support far better than to occasional intensive treatment.',
    stable:
      'Firmness is protected by consistency and by daylight protection, both of which are easier to keep than to restore.',
  },
  oil_congestion_balance: {
    severe:
      'Congested pores are where breakouts start, and in melanin-rich skin each breakout can leave a mark that lasts far longer than the spot itself.',
    clear:
      'Congestion tends to repeat in the same areas, and every repeat raises the chance of a mark that outlasts it.',
    early:
      'Excess oil is often the skin compensating for a dry surface, so balance is usually restored by supporting hydration as well as controlling oil.',
    stable:
      'Balanced oil keeps pores clear, and it is easier to maintain that balance than to clear congestion once it settles.',
  },
};

const IF_LEFT: Record<LanguageVariableKey, Record<Tier, string>> = {
  pigmentation_stability: {
    severe:
      'Without support, and with continued sun exposure, marks like these commonly deepen and spread rather than settle.',
    clear: 'Without support, this pattern usually stays visible and can darken with sun exposure.',
    early: 'Without support, mild unevenness tends to become more defined over time.',
    stable: 'Without daily protection, even settled tone can start to shift again.',
  },
  barrier_surface_hydration: {
    severe:
      'Without support, a dry surface commonly leads to sensitivity, and stronger products become harder to tolerate.',
    clear: 'Without support, dryness usually persists and your skin may react more easily.',
    early: 'Without support, early dryness tends to spread across more of the face.',
    stable: 'Without consistent hydration, comfort can drop quickly in heat or air conditioning.',
  },
  firmness_skin_support: {
    severe: 'Without support, visible softening generally continues rather than reverses on its own.',
    clear: 'Without support, these early lines usually become more set over time.',
    early: 'Without support, mild softening tends to progress gradually.',
    stable: 'Without protection from daily sun exposure, firmness declines faster than it needs to.',
  },
  oil_congestion_balance: {
    severe:
      'Without support, congestion at this level commonly continues to produce breakouts and the marks that follow them.',
    clear: 'Without support, congestion usually keeps returning in the same areas.',
    early: 'Without support, early congestion can develop into recurring breakouts.',
    stable: 'Without maintenance, congestion can return during heat, humidity or routine changes.',
  },
};

const RESPONSE: Record<LanguageVariableKey, Record<Tier, string>> = {
  pigmentation_stability: {
    severe:
      'XCAPE treats this as an aggressive category: a coordinated exfoliating and melanin-control direction, always paired with the required anti-inflammatory companion, and prepared at the dose your score calls for.',
    clear:
      'XCAPE treats this as an aggressive category: a coordinated exfoliating and melanin-control direction with the required anti-inflammatory companion, prepared at the dose your score calls for.',
    early:
      'XCAPE applies its exfoliating and melanin-control direction with the required anti-inflammatory companion, at the lighter dose your score calls for.',
    stable:
      'XCAPE keeps this in preventive care. No pigmentation customization is called for by this score alone.',
  },
  barrier_surface_hydration: {
    severe:
      'XCAPE customizes your facial moisturizer for surface hydration, at the dose your score calls for. Your cleanser and toner are not customized for this.',
    clear:
      'XCAPE customizes your facial moisturizer for surface hydration, at the dose your score calls for.',
    early:
      'XCAPE customizes your facial moisturizer at the lighter dose your score calls for.',
    stable:
      'XCAPE keeps this in maintenance. No hydration customization is called for by this score alone.',
  },
  firmness_skin_support: {
    severe:
      'XCAPE applies its anti-aging and elasticity direction, prepared at the dose your score calls for.',
    clear:
      'XCAPE applies its anti-aging and elasticity direction, prepared at the dose your score calls for.',
    early:
      'XCAPE applies its anti-aging and elasticity direction at the lighter dose your score calls for.',
    stable:
      'XCAPE keeps this in preventive care. No elasticity customization is called for by this score alone.',
  },
  oil_congestion_balance: {
    severe:
      'XCAPE treats this as an aggressive category: the overactive-sebaceous direction with the required anti-inflammatory companion, prepared at the dose your score calls for.',
    clear:
      'XCAPE applies the overactive-sebaceous direction with the required anti-inflammatory companion, prepared at the dose your score calls for.',
    early:
      'XCAPE applies the overactive-sebaceous direction with its required companion at the lighter dose your score calls for.',
    stable:
      'XCAPE keeps this in maintenance. No sebaceous customization is called for by this score alone.',
  },
};

const REASSURANCE: Record<LanguageVariableKey, Record<Tier, string>> = {
  pigmentation_stability: {
    severe: 'This is a known pattern in tropical and melanin-rich skin, and it is workable with the right sequence.',
    clear: 'This is common, and it responds to a consistent, correctly sequenced routine.',
    early: 'Caught at this stage, this is one of the easier areas to bring back to even.',
    stable: 'This area is doing well. Keeping it there is straightforward.',
  },
  barrier_surface_hydration: {
    severe: 'Surface hydration is usually the fastest area to improve once it is properly supported.',
    clear: 'This area typically responds quickly once hydration is consistent.',
    early: 'Small, steady changes are usually enough here.',
    stable: 'This area is doing well. A steady routine keeps it that way.',
  },
  firmness_skin_support: {
    severe: 'Firmness support is a long game, and steady work here shows over time.',
    clear: 'Consistency matters more than intensity in this area.',
    early: 'Starting now gives this area the best runway.',
    stable: 'This area is doing well, and protection keeps it there.',
  },
  oil_congestion_balance: {
    severe: 'Congestion at this level is common and it does respond, provided the skin is calmed rather than stripped.',
    clear: 'This area responds well when oil control and hydration are handled together.',
    early: 'Handled now, this rarely becomes a bigger problem.',
    stable: 'This area is doing well. Maintenance is enough for now.',
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
    return { weakest: [], headline: 'No scored areas are available for this assessment.', lines: [], overall: null };
  }

  const sorted = byScoreThenKey(entries);
  const overall = Math.round(sorted.reduce((a, [, v]) => a + v, 0) / sorted.length);

  const [first, second] = sorted;
  const weakest: LanguageVariableKey[] = [first[0]];
  // A second area joins the priority set when it is also active (<= 80) and
  // close behind the weakest reading.
  if (second && second[1] <= 80 && second[1] - first[1] <= 15) weakest.push(second[0]);

  const name = (k: LanguageVariableKey) => LANGUAGE_VARIABLE_NAME[k];
  const headline = weakest.length > 1
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
      'Surface dehydration and excess oil are reading low together. Excess oil is often the skin compensating for a dry surface, so XCAPE supports hydration alongside oil control rather than stripping the skin.',
    );
  }

  const pigment = scoreOf('pigmentation_stability');
  if (pigment != null && oil != null && pigment <= 60 && oil <= 60) {
    lines.push(
      'Tone unevenness and congestion are reading low together. Calming congestion first reduces the marks that breakouts can leave behind.',
    );
  }

  const stableCount = sorted.filter(([, v]) => v > 80).length;
  if (stableCount > 0) {
    lines.push(
      `${stableCount} of your ${sorted.length} readings are stable and are summarised further down, with their scores kept visible.`,
    );
  }

  return { weakest, headline, lines, overall };
}

// ---- MIRROR REGION END --------------------------------------------------
