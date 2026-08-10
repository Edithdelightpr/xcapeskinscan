/**
 * Tropics Skin Analysis Engine V1
 *
 * Pure logic + reference tables. No React, no I/O.
 *
 * Scoring direction: 0 = weakest / worst concern, 100 = healthiest / most stable.
 * concern_burden = 100 - practitioner_score.
 */

export type EngineVariableKey =
  | 'pigmentation_stability'
  | 'barrier_surface_hydration'
  | 'firmness_skin_support'
  | 'oil_congestion_balance';

export type Confidence = 'low' | 'medium' | 'high';

export interface EngineVariableScore {
  machine_score?: number | null;
  practitioner_score: number;
  confidence?: Confidence;
  adjustment_reason?: string | null;
  note?: string | null;
}

export interface EnginePayload {
  engine_version: '1.0';
  scoring_direction: '100_good_0_bad';
  variables: Partial<Record<EngineVariableKey, EngineVariableScore>>;
  overall_skin_stability: number;
  overall_concern_burden: number;
  priority_order: EngineVariableKey[];
  combined_interpretation: string;
  recommended_treatment_directions: string[];
  recommended_home_care_directions: string[];
  created_at: string;
  assessed_by?: string | null;
}

export const ENGINE_VARIABLE_KEYS: EngineVariableKey[] = [
  // Fixed engine INPUT order (per UX spec). Priority order for the report is
  // computed separately by lowest stability score — do not change this array
  // expecting priority output to follow.
  'oil_congestion_balance',
  'pigmentation_stability',
  'firmness_skin_support',
  'barrier_surface_hydration',
];

export const ENGINE_VARIABLE_LABEL: Record<EngineVariableKey, string> = {
  pigmentation_stability: 'Hyperpigmentation',
  barrier_surface_hydration: 'Surface Dehydration',
  firmness_skin_support: 'Weak Elasticity',
  oil_congestion_balance: 'Over-Sebaceous Activity (Clogged Pores)',
};

export const ENGINE_VARIABLE_DESCRIPTION: Record<EngineVariableKey, string> = {
  pigmentation_stability:
    'Overproduction of melanin causing uneven skin tone. Other causes may include sun exposure, post-inflammatory triggers, and hormonal shifts.',
  barrier_surface_hydration:
    'Surface dryness and difficulty for actives to penetrate. Other causes may include a weakened barrier, climate, AC exposure, and over-exfoliation.',
  firmness_skin_support:
    'Weak elasticity affecting the skin barrier and bounce-back. Other causes may include collagen/elastin decline, sun damage, and ageing.',
  oil_congestion_balance:
    'Over-sebaceous activity leading to clogged pores. Other causes may include hormones, comedogenic products, and dietary triggers.',
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export const concernBurden = (health: number): number => clamp(100 - clamp(health));

export type StageBand =
  | 'critical' | 'very_low' | 'low' | 'mild' | 'moderate'
  | 'fair'     | 'good'     | 'strong' | 'very_strong' | 'optimal';

export interface EngineStage {
  band: StageBand;
  range: [number, number];
  stage: string;
  meaning: string;
  impact: string;
  call_to_action: string;
  treatment_direction: string;
  home_care_direction: string;
  /** Client-facing tailored lead sentence. */
  analysis: string;
  /** Alias of home_care_direction with the client-facing label. */
  home_care_alternatives: string;
}

const UNIVERSAL: Pick<EngineStage, 'band' | 'range' | 'stage' | 'meaning'>[] = [
  { band: 'critical',    range: [0, 10],   stage: 'Critical / Very Weak',
    meaning: 'The variable is severely compromised.' },
  { band: 'very_low',    range: [11, 20],  stage: 'Very Low Stability',
    meaning: 'The variable is weak and requires priority support.' },
  { band: 'low',         range: [21, 30],  stage: 'Low Stability',
    meaning: 'The concern is clearly active.' },
  { band: 'mild',        range: [31, 40],  stage: 'Mild Stability / Weakening',
    meaning: 'The concern is visible but still manageable.' },
  { band: 'moderate',    range: [41, 50],  stage: 'Moderate Stability',
    meaning: 'The variable is functional but not strong.' },
  { band: 'fair',        range: [51, 60],  stage: 'Fair Stability',
    meaning: 'The variable is moderately stable.' },
  { band: 'good',        range: [61, 70],  stage: 'Good Stability',
    meaning: 'The variable is mostly stable with mild support needed.' },
  { band: 'strong',      range: [71, 80],  stage: 'Strong Stability',
    meaning: 'The variable is in good condition.' },
  { band: 'very_strong', range: [81, 90],  stage: 'Very Strong Stability',
    meaning: 'The variable appears highly stable.' },
  { band: 'optimal',     range: [91, 100], stage: 'Excellent / Optimal',
    meaning: 'The variable is in excellent condition.' },
];

/**
 * Tailored client-facing copy per variable × band.
 * Source of truth for the PDF report.
 */
export type VariableCopy = {
  analysis: string;
  impact: string;
  call_to_action: string;
  treatment_direction: string;
  home_care_alternatives: string;
};

export const VARIABLE_COPY_BANK: Record<EngineVariableKey, Record<StageBand, VariableCopy>> = {
  oil_congestion_balance: {
    critical: {
      analysis: 'Analyses show significant overproduction of sebum, severely clogging pores and strongly increasing the risk of inflammation, breakouts and acne.',
      impact: 'High concern burden — untreated congestion can lead to persistent acne and post-inflammatory marks.',
      call_to_action: 'Escalate carefully, calm inflammation first and avoid aggressive procedures until skin stabilises.',
      treatment_direction: 'Priority decongestion, oil control and acne management with anti-inflammatory support.',
      home_care_alternatives: 'Gentle BHA or azelaic acid as tolerated, niacinamide, oil-free non-comedogenic SPF.',
    },
    very_low: {
      analysis: 'Analyses show active overproduction of sebum, thus clogging pores, which can cause breakouts and acne.',
      impact: 'High likelihood of poor tolerance or slow results if untreated.',
      call_to_action: 'Begin corrective support carefully and avoid aggressive procedures.',
      treatment_direction: 'Targeted decongestion, oil control and acne management.',
      home_care_alternatives: 'BHA / azelaic routine, niacinamide, non-comedogenic SPF.',
    },
    low: {
      analysis: 'Analyses show clearly elevated sebum activity with visible congestion, which can lead to recurring breakouts if not supported.',
      impact: 'Visible congestion is likely to worsen without targeted oil-control support.',
      call_to_action: 'Start targeted decongestion treatment and supportive home care.',
      treatment_direction: 'Structured oil-balance and congestion-clearing treatments.',
      home_care_alternatives: 'BHA cleanser, niacinamide serum, non-comedogenic SPF.',
    },
    mild: {
      analysis: 'Analyses show early signs of sebum overactivity and pore congestion, which may progress to breakouts if left unmanaged.',
      impact: 'Early intervention can prevent progression into active acne.',
      call_to_action: 'Start targeted treatment, monitor triggers and support the skin consistently.',
      treatment_direction: 'Targeted decongestion treatments with steady monitoring.',
      home_care_alternatives: 'Light BHA routine, niacinamide, non-comedogenic SPF.',
    },
    moderate: {
      analysis: 'Analyses show moderate sebum activity, which may still clog pores and contribute to occasional breakouts if not controlled.',
      impact: 'Concern is functional but not optimal; structured support improves clarity.',
      call_to_action: 'Recommend structured oil-balance treatment and consistent home care.',
      treatment_direction: 'Structured oil-balance facials with pore-clarifying support.',
      home_care_alternatives: 'BHA 2–3×/week, niacinamide, non-comedogenic moisturiser and SPF.',
    },
    fair: {
      analysis: 'Analyses show mild-to-moderate sebum activity, partially stable but still prone to occasional congestion.',
      impact: 'Concern exists but is manageable with consistent support.',
      call_to_action: 'Continue oil-balance routine and monitor congestion triggers.',
      treatment_direction: 'Maintenance decongestion treatments with selective clarifying support.',
      home_care_alternatives: 'Light BHA, niacinamide, non-comedogenic SPF.',
    },
    good: {
      analysis: 'Analyses indicate that sebum activity appears mostly controlled, with only mild risk of congestion if maintenance is neglected.',
      impact: 'Maintenance and selective treatment are usually sufficient.',
      call_to_action: 'Maintain, prevent relapse and use light corrective care where needed.',
      treatment_direction: 'Maintenance plus selective pore-clarifying support.',
      home_care_alternatives: 'Maintenance routine with light BHA and non-comedogenic SPF.',
    },
    strong: {
      analysis: 'Analyses indicate that sebum activity appears well controlled, with minimal congestion concern.',
      impact: 'Low concern burden; maintenance protects current clarity.',
      call_to_action: 'Maintain results and protect against congestion triggers.',
      treatment_direction: 'Maintenance facials with selective clarifying top-ups.',
      home_care_alternatives: 'Gentle maintenance routine and non-comedogenic SPF.',
    },
    very_strong: {
      analysis: 'Analyses indicate highly stable sebum activity, with very mild congestion risk.',
      impact: 'Minimal concern; preventive care is sufficient.',
      call_to_action: 'Continue prevention and routine check-ins.',
      treatment_direction: 'Preventive maintenance only.',
      home_care_alternatives: 'Preventive routine and non-comedogenic SPF.',
    },
    optimal: {
      analysis: 'Analyses indicate optimal sebum balance, with pores clear and minimal congestion risk.',
      impact: 'Very low concern burden.',
      call_to_action: 'Maintain and protect current results.',
      treatment_direction: 'Maintenance only.',
      home_care_alternatives: 'Preventive routine, non-comedogenic SPF and antioxidants.',
    },
  },
  barrier_surface_hydration: {
    critical: {
      analysis: 'Analyses reveal severe surface dryness with significant barrier strain, which strongly limits treatment penetration and reduces skin comfort.',
      impact: 'High concern burden — actives and procedures may be poorly tolerated.',
      call_to_action: 'Pause actives, prioritise barrier repair and deep hydration before any corrective work.',
      treatment_direction: 'Barrier repair and hydration-focused treatments only.',
      home_care_alternatives: 'Gentle cleanser, ceramide moisturiser, hyaluronic acid, daily SPF.',
    },
    very_low: {
      analysis: 'Analyses reveal pronounced surface dryness and barrier strain, with clear difficulty supporting deeper-layer treatment penetration.',
      impact: 'High likelihood of poor tolerance or slow results if untreated.',
      call_to_action: 'Begin barrier-repair support and reintroduce actives slowly.',
      treatment_direction: 'Barrier-repair facials and gentle hydration treatments.',
      home_care_alternatives: 'Ceramide moisturiser, hyaluronic acid serum, daily SPF.',
    },
    low: {
      analysis: 'Analyses reveal dryness on the surface of the skin, which implies that penetration into the deeper layers is rather strained.',
      impact: 'Impact is likely, and the concern may worsen without support.',
      call_to_action: 'Start targeted treatment and supportive home care.',
      treatment_direction: 'Hydration-focused treatments with gentle support.',
      home_care_alternatives: 'Hydrating cleanser, hyaluronic acid, ceramides, SPF.',
    },
    mild: {
      analysis: 'Analyses reveal early surface dehydration, with mild barrier strain that can affect comfort and treatment response.',
      impact: 'Early hydration support can prevent progression to sensitivity.',
      call_to_action: 'Start consistent hydration support and monitor skin comfort.',
      treatment_direction: 'Hydration-focused facials with barrier-supportive ingredients.',
      home_care_alternatives: 'Hydrating cleanser, hyaluronic acid, light ceramide moisturiser, SPF.',
    },
    moderate: {
      analysis: 'Analyses reveal moderate surface dehydration, meaning the skin may still need hydration support for better comfort and treatment response.',
      impact: 'Hydration support meaningfully improves treatment outcomes.',
      call_to_action: 'Recommend structured hydration treatments and consistent home care.',
      treatment_direction: 'Structured hydration facials with barrier reinforcement.',
      home_care_alternatives: 'Hyaluronic acid serum, ceramide moisturiser, daily SPF.',
    },
    fair: {
      analysis: 'Analyses reveal mild-to-moderate surface dehydration, partially stable but still benefiting from consistent hydration.',
      impact: 'Concern exists but is not severe; consistency improves comfort and penetration.',
      call_to_action: 'Continue hydration routine and monitor seasonal changes.',
      treatment_direction: 'Maintenance hydration facials with selective barrier support.',
      home_care_alternatives: 'Hyaluronic acid, ceramide moisturiser, SPF.',
    },
    good: {
      analysis: 'Analyses indicate that surface hydration appears mostly stable, with only mild support needed to maintain comfort and treatment readiness.',
      impact: 'Maintenance and selective treatment are usually sufficient.',
      call_to_action: 'Maintain hydration and prevent relapse during dry seasons or travel.',
      treatment_direction: 'Maintenance hydration treatments with light barrier support.',
      home_care_alternatives: 'Hydrating routine with hyaluronic acid and SPF.',
    },
    strong: {
      analysis: 'Analyses indicate that surface hydration appears well controlled, with the barrier supporting comfortable treatment penetration.',
      impact: 'Low concern burden.',
      call_to_action: 'Maintain results and protect against dehydration triggers.',
      treatment_direction: 'Maintenance hydration facials when needed.',
      home_care_alternatives: 'Hydrating routine and SPF discipline.',
    },
    very_strong: {
      analysis: 'Analyses indicate highly stable surface hydration, with a resilient barrier supporting comfort and treatment tolerance.',
      impact: 'Minimal concern.',
      call_to_action: 'Continue prevention and routine check-ins.',
      treatment_direction: 'Preventive hydration support only.',
      home_care_alternatives: 'Preventive hydration routine, ceramides, SPF.',
    },
    optimal: {
      analysis: 'Analyses indicate optimal surface hydration, with a strong barrier and excellent treatment readiness.',
      impact: 'Very low concern burden.',
      call_to_action: 'Maintain and protect current results.',
      treatment_direction: 'Maintenance only.',
      home_care_alternatives: 'Preventive routine, antioxidants and SPF.',
    },
  },
  firmness_skin_support: {
    critical: {
      analysis: 'Analyses reveal significant visible signs linked to reduced collagen and elastin support, causing the skin to appear noticeably older than its actual age.',
      impact: 'High concern burden; firmness and bounce-back support appear strongly reduced.',
      call_to_action: 'Begin cautious firming and hydration-plumpness work; avoid aggressive procedures until barrier is stronger.',
      treatment_direction: 'Cautious collagen-support and hydration-plumpness treatments.',
      home_care_alternatives: 'Peptides, hyaluronic acid, antioxidants and daily SPF.',
    },
    very_low: {
      analysis: 'Analyses reveal visible signs linked to reduced elastin and collagen support, causing the skin to appear older than its actual age.',
      impact: 'High likelihood of progression without consistent support.',
      call_to_action: 'Begin targeted firming support and protect against elasticity loss.',
      treatment_direction: 'Gentle collagen-support and elasticity treatments with hydration-plumpness work.',
      home_care_alternatives: 'Peptides, hyaluronic acid, antioxidants and SPF.',
    },
    low: {
      analysis: 'Analyses reveal visible signs that may suggest reduced elastin recoil and weaker collagen support, with hydration-plumpness appearing reduced.',
      impact: 'Concern is active and likely to progress without support.',
      call_to_action: 'Start targeted firming treatment and consistent home care.',
      treatment_direction: 'Targeted collagen, elasticity, and hydration-plumpness treatments.',
      home_care_alternatives: 'Peptides, retinol as tolerated, hyaluronic acid, SPF.',
    },
    mild: {
      analysis: 'Analyses reveal early visible signs linked to elastin, collagen and hydration-plumpness support, with firmness support appearing mildly reduced.',
      impact: 'Early intervention is important to prevent progression.',
      call_to_action: 'Start targeted treatment, monitor triggers and support the skin consistently.',
      treatment_direction: 'Structured collagen, elastin and hydration-plumpness support plan.',
      home_care_alternatives: 'Peptides, retinol, hyaluronic acid, antioxidants and SPF.',
    },
    moderate: {
      analysis: 'Analyses reveal moderate weakening in firmness support, which may suggest reduced elasticity, collagen support and hydration-plumpness.',
      impact: 'Structured support may meaningfully slow elasticity loss.',
      call_to_action: 'Recommend structured firming treatments and consistent home care.',
      treatment_direction: 'Structured collagen / elastin / hydration-plumpness support.',
      home_care_alternatives: 'Peptides, retinol, hyaluronic acid, antioxidants, daily SPF.',
    },
    fair: {
      analysis: 'Analyses reveal mild-to-moderate signs that firmness support may be partially reduced, with elasticity and hydration-plumpness benefiting from consistent care.',
      impact: 'Concern exists but is manageable with steady support.',
      call_to_action: 'Continue firming routine and monitor progress.',
      treatment_direction: 'Maintenance firming treatments with selective hydration-plumpness boosters.',
      home_care_alternatives: 'Peptides, hyaluronic acid, antioxidants, SPF.',
    },
    good: {
      analysis: 'Analyses indicate that firmness and elasticity support appear mostly stable, with mild maintenance needed to protect collagen, elastin and hydration-plumpness.',
      impact: 'Maintenance and selective treatment are usually sufficient.',
      call_to_action: 'Maintain, prevent relapse and use light corrective care where needed.',
      treatment_direction: 'Maintenance plus selective firming support.',
      home_care_alternatives: 'Maintenance routine with peptides, antioxidants, SPF.',
    },
    strong: {
      analysis: 'Analyses indicate that firmness and elasticity support appear well preserved, with minimal visible signs of weakening.',
      impact: 'Low concern burden.',
      call_to_action: 'Maintain results and protect collagen and elastin from UV damage.',
      treatment_direction: 'Maintenance firming treatments with selective top-ups.',
      home_care_alternatives: 'Maintenance routine, antioxidants, daily SPF.',
    },
    very_strong: {
      analysis: 'Analyses indicate highly stable firmness and elasticity support, with very mild concern about collagen, elastin or hydration-plumpness.',
      impact: 'Minimal concern.',
      call_to_action: 'Continue prevention and routine check-ins.',
      treatment_direction: 'Preventive firming and hydration-plumpness support.',
      home_care_alternatives: 'Preventive routine, antioxidants, SPF.',
    },
    optimal: {
      analysis: 'Analyses indicate optimal firmness and elasticity support, with collagen, elastin and hydration-plumpness appearing excellent.',
      impact: 'Very low concern burden.',
      call_to_action: 'Maintain and protect current results.',
      treatment_direction: 'Maintenance only.',
      home_care_alternatives: 'Preventive routine, antioxidants and SPF.',
    },
  },
  pigmentation_stability: {
    critical: {
      analysis: 'Analysis indicates significant pigment instability, where inflammation and ultraviolet exposure may strongly stimulate melanocyte activity and contribute to uneven skin tone.',
      impact: 'High concern burden; aggressive pigment correction without barrier and inflammation control may worsen marks.',
      call_to_action: 'Stop pigment triggers, calm inflammation and repair the barrier before any strong pigment correction.',
      treatment_direction: 'Barrier and inflammation control first, then gradual pigment correction.',
      home_care_alternatives: 'Strict SPF 50, gentle barrier-support cleanser, niacinamide, anti-inflammatory serums.',
    },
    very_low: {
      analysis: 'Analysis indicates strong pigment instability, where inflammation and ultraviolet exposure may stimulate melanocyte activity and contribute to uneven skin tone.',
      impact: 'High likelihood of post-inflammatory marks if not supported.',
      call_to_action: 'Begin inflammation control and gentle brightening once skin is calmer.',
      treatment_direction: 'Inflammation control first, then gentle pigment correction.',
      home_care_alternatives: 'Daily SPF, niacinamide, gradual brightening agents at low frequency.',
    },
    low: {
      analysis: 'Analysis indicates clear pigment instability, with sun exposure and inflammation visibly contributing to uneven tone.',
      impact: 'Concern is active and likely to deepen without consistent photoprotection.',
      call_to_action: 'Start targeted pigment correction alongside inflammation control.',
      treatment_direction: 'Targeted gradual pigment correction with inflammation control.',
      home_care_alternatives: 'Daily SPF, brightening serum, gentle exfoliation as tolerated.',
    },
    mild: {
      analysis: 'Analysis indicates early signs of pigment instability, with sun exposure and inflammation beginning to influence melanocyte activity and skin tone evenness.',
      impact: 'Early intervention can prevent progression to deeper pigmentation.',
      call_to_action: 'Start structured pigment correction and reinforce photoprotection.',
      treatment_direction: 'Structured pigment correction with monitoring for rebound darkening.',
      home_care_alternatives: 'Daily SPF, brightening serum, consistent routine.',
    },
    moderate: {
      analysis: 'Analysis indicates moderate signs of pigment instability, where ongoing sun exposure and inflammation may continue to stimulate melanocyte activity if not managed.',
      impact: 'Structured support meaningfully improves tone evenness.',
      call_to_action: 'Recommend structured brightening and consistent photoprotection.',
      treatment_direction: 'Continue structured brightening and even-tone work.',
      home_care_alternatives: 'Daily SPF, brightening routine, antioxidants.',
    },
    fair: {
      analysis: 'Analysis indicates mild-to-moderate effects of sun exposure on the skin; photoprotection is important to prevent UV-induced melanocyte stimulation and uneven tone.',
      impact: 'Concern exists but is manageable with consistent care.',
      call_to_action: 'Continue brightening and photoprotection routine.',
      treatment_direction: 'Maintenance brightening with selective corrective support.',
      home_care_alternatives: 'Daily SPF, brightening serum, antioxidants.',
    },
    good: {
      analysis: 'Analysis indicates that the effects of sun exposure and inflammation on the skin are currently moderate. However, photoprotection is essential to prevent inflammation induced by ultraviolet exposure, which can stimulate melanocyte activity and lead to uneven skin tone.',
      impact: 'Maintenance and selective treatment may be sufficient.',
      call_to_action: 'Maintain, prevent relapse and use light corrective care where needed.',
      treatment_direction: 'Maintenance plus selective corrective support.',
      home_care_alternatives: 'Maintenance routine with light actives.',
    },
    strong: {
      analysis: 'Analysis indicates that pigment stability appears good, but continued photoprotection is important to prevent inflammation, melanocyte stimulation and uneven tone relapse.',
      impact: 'Low concern burden.',
      call_to_action: 'Maintain results and protect against UV and inflammation triggers.',
      treatment_direction: 'Maintenance facials with selective brightening top-ups.',
      home_care_alternatives: 'Daily SPF, light brightening serum, antioxidants.',
    },
    very_strong: {
      analysis: 'Analysis indicates that pigment stability appears highly stable, with very mild concern about melanocyte activity or uneven tone.',
      impact: 'Minimal concern.',
      call_to_action: 'Continue photoprotection and routine check-ins.',
      treatment_direction: 'Preventive maintenance only.',
      home_care_alternatives: 'Daily SPF, antioxidants, gentle maintenance routine.',
    },
    optimal: {
      analysis: 'Analysis indicates optimal pigment stability, with even tone and minimal melanocyte-driven concern.',
      impact: 'Very low concern burden.',
      call_to_action: 'Maintain and protect current results.',
      treatment_direction: 'Maintenance only.',
      home_care_alternatives: 'Daily SPF, antioxidants, preventive routine.',
    },
  },
};

export const STAGE_TABLE: Record<EngineVariableKey, EngineStage[]> = (() => {
  const out = {} as Record<EngineVariableKey, EngineStage[]>;
  for (const key of ENGINE_VARIABLE_KEYS) {
    out[key] = UNIVERSAL.map((u) => {
      const c = VARIABLE_COPY_BANK[key][u.band];
      return {
        band: u.band,
        range: u.range,
        stage: u.stage,
        meaning: u.meaning,
        analysis: c.analysis,
        impact: c.impact,
        call_to_action: c.call_to_action,
        treatment_direction: c.treatment_direction,
        home_care_direction: c.home_care_alternatives,
        home_care_alternatives: c.home_care_alternatives,
      };
    });
  }
  return out;
})();

export const stageFor = (variable: EngineVariableKey, health: number): EngineStage => {
  const { bandScore } = calibratedBandScoreFor(variable, health);
  const table = STAGE_TABLE[variable];
  return table.find((s) => bandScore >= s.range[0] && bandScore <= s.range[1]) ?? table[0];
};

/**
 * Per-variable stability calibration.
 * Raw slider stays 0–100 and is the only value saved. Only band selection uses
 * the rescaled `bandScore` so the existing 10 outcome bands spread evenly across
 * the calibrated max (above max = top/stable band).
 */
const VARIABLE_STABILITY_MAX: Record<EngineVariableKey, number> = {
  oil_congestion_balance: 70,    // Over-Sebaceous Activity / Clogged Pores
  pigmentation_stability: 100,   // Hyperpigmentation
  barrier_surface_hydration: 80, // Surface Dehydration
  firmness_skin_support: 80,     // Weak Elasticity
};

export function calibratedBandScoreFor(variable: EngineVariableKey, rawScore: number) {
  const max = VARIABLE_STABILITY_MAX[variable] ?? 100;
  const raw = clamp(rawScore);
  const capped = Math.max(0, Math.min(raw, max));
  const bandScore = Math.round((capped / max) * 100);
  return { rawScore: raw, stabilityMax: max, cappedScore: capped, bandScore };
}

export const overallStability = (
  vars: Partial<Record<EngineVariableKey, EngineVariableScore>>,
): number => {
  const vals = ENGINE_VARIABLE_KEYS
    .map((k) => vars[k]?.practitioner_score)
    .filter((n): n is number => typeof n === 'number');
  if (vals.length === 0) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
};

export const priorityOrder = (
  vars: Partial<Record<EngineVariableKey, EngineVariableScore>>,
): EngineVariableKey[] => {
  const entered = ENGINE_VARIABLE_KEYS.filter((k) => typeof vars[k]?.practitioner_score === 'number');
  return [...entered].sort(
    (a, b) => (vars[a]!.practitioner_score) - (vars[b]!.practitioner_score),
  );
};

const LOW_THRESHOLD = 40;

export const combinedInterpretation = (
  vars: Partial<Record<EngineVariableKey, EngineVariableScore>>,
): string => {
  const score = (k: EngineVariableKey) => vars[k]?.practitioner_score;
  const pig = score('pigmentation_stability');
  const bar = score('barrier_surface_hydration');
  const oil = score('oil_congestion_balance');
  const firm = score('firmness_skin_support');

  const lowPig = pig != null && pig <= LOW_THRESHOLD;
  const lowBar = bar != null && bar <= LOW_THRESHOLD;
  const lowOil = oil != null && oil <= LOW_THRESHOLD;
  const lowFirm = firm != null && firm <= LOW_THRESHOLD;

  const lines: string[] = [];

  if (lowPig && lowBar) {
    lines.push('Pigmentation stability and barrier hydration are both low. Prioritize barrier repair, hydration and inflammation control before any strong pigment correction.');
  }
  if (lowPig && lowOil) {
    lines.push('Pigmentation stability is low alongside oil & congestion concerns. Prioritize acne, oil and congestion control to prevent new post-inflammatory marks before aggressive pigment work.');
  }
  if (lowPig && lowFirm) {
    lines.push('Pigmentation stability and firmness support are both low. Avoid overly aggressive procedures — recommend gradual correction with close follow-up.');
  }
  if (lowPig && !lowBar && !lowOil && !lowFirm) {
    lines.push('Pigmentation instability suggests a stop-trigger → calm inflammation → repair barrier → prevent new pigment stimulation → correct gradually → reassess approach.');
  }
  if (lowFirm) {
    lines.push('Firmness & skin support is low — collagen support, elastin recoil / elasticity support and hyaluronic-acid hydration-plumpness support should be prioritized.');
  }
  if (lowBar && !lowPig) {
    lines.push('Barrier hydration is low — pause exfoliating actives and rebuild the barrier first.');
  }
  if (lowOil && !lowPig) {
    lines.push('Oil & congestion balance is low — targeted decongestion and oil-control treatments are recommended.');
  }

  if (lines.length === 0) {
    const overall = overallStability(vars);
    if (overall >= 81) lines.push('Overall skin stability is excellent — maintenance and prevention recommended.');
    else if (overall >= 61) lines.push('Overall skin stability is good — light corrective and maintenance care recommended.');
    else if (overall >= 41) lines.push('Overall skin stability is moderate — structured treatment and home-care support recommended.');
    else if (overall > 0)  lines.push('Overall skin stability is low — cautious, supportive corrective care recommended.');
  }

  return lines.join(' ');
};

export type RecommendationIntensity =
  | 'very_cautious' | 'targeted' | 'structured' | 'maintenance_plus' | 'maintenance';

export interface IntensityCopy {
  level: RecommendationIntensity;
  label: string;
  description: string;
  injectables_iv_allowed: 'auto_suggest' | 'manual_only';
  approval_note?: string;
}

export const recommendationIntensity = (health: number): IntensityCopy => {
  const h = clamp(health);
  if (h <= 20) return {
    level: 'very_cautious',
    label: 'Very cautious support',
    description: 'Consider practitioner / medical review before advanced treatment.',
    injectables_iv_allowed: 'manual_only',
    approval_note: 'Medical/practitioner approval required for injectables or IV therapy.',
  };
  if (h <= 40) return {
    level: 'targeted',
    label: 'Targeted corrective treatment',
    description: 'Targeted corrective treatment recommended.',
    injectables_iv_allowed: 'manual_only',
  };
  if (h <= 60) return {
    level: 'structured',
    label: 'Structured treatment + home-care',
    description: 'Structured treatment plus product / home-care support.',
    injectables_iv_allowed: 'manual_only',
  };
  if (h <= 80) return {
    level: 'maintenance_plus',
    label: 'Maintenance + selective correction',
    description: 'Maintenance plus selective corrective support.',
    injectables_iv_allowed: 'manual_only',
  };
  return {
    level: 'maintenance',
    label: 'Maintenance & prevention',
    description: 'Maintenance and prevention only.',
    injectables_iv_allowed: 'manual_only',
  };
};

export const buildEnginePayload = (
  vars: Partial<Record<EngineVariableKey, EngineVariableScore>>,
  meta: { assessed_by?: string | null; created_at?: string } = {},
): EnginePayload => {
  // Mirror practitioner_score → machine_score so the report displays a single
  // "Machine Score" column. Practitioner input is the source of truth.
  const mirrored: Partial<Record<EngineVariableKey, EngineVariableScore>> = {};
  (Object.keys(vars) as EngineVariableKey[]).forEach((k) => {
    const s = vars[k];
    if (!s) return;
    mirrored[k] = { ...s, machine_score: s.practitioner_score };
  });
  const stability = overallStability(mirrored);
  const order = priorityOrder(mirrored);

  const treatmentDirs = new Set<string>();
  const homeCareDirs = new Set<string>();
  order.forEach((k) => {
    const s = mirrored[k]!;
    const stage = stageFor(k, s.practitioner_score);
    treatmentDirs.add(`${ENGINE_VARIABLE_LABEL[k]}: ${stage.treatment_direction}`);
    homeCareDirs.add(`${ENGINE_VARIABLE_LABEL[k]}: ${stage.home_care_direction}`);
  });

  return {
    engine_version: '1.0',
    scoring_direction: '100_good_0_bad',
    variables: mirrored,
    overall_skin_stability: stability,
    overall_concern_burden: 100 - stability,
    priority_order: order,
    combined_interpretation: combinedInterpretation(mirrored),
    recommended_treatment_directions: Array.from(treatmentDirs),
    recommended_home_care_directions: Array.from(homeCareDirs),
    created_at: meta.created_at ?? new Date().toISOString(),
    assessed_by: meta.assessed_by ?? null,
  };
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  low: 'Low confidence',
  medium: 'Medium confidence',
  high: 'High confidence',
};

export const PRACTITIONER_HELPER_TEXT =
  'Enter the machine health score (0–100) for each variable. 100 = healthiest, 0 = most concern. Melanin-rich skin readings are tuned for Tropics protocols.';

/**
 * Curated lifestyle tip bank — each tip is one sentence with a built-in
 * "as <why>" rationale. Order matters: index 0 is the most impactful.
 */
const LIFESTYLE_TIP_BANK: Record<EngineVariableKey, string[]> = {
  oil_congestion_balance: [
    'Avoid picking your skin or using harsh scrubs, as this can irritate the skin, worsen clogged pores, and cause dark spots.',
    'Change pillowcases and face towels twice a week, as fabric oils transfer back to the skin and clog pores.',
    'Choose non-comedogenic moisturisers and SPF, as comedogenic products trap sebum and trigger breakouts.',
  ],
  barrier_surface_hydration: [
    'Drink 2–3 litres of water daily, as hydrated skin tolerates actives and recovers faster.',
    'Use a humidifier in air-conditioned rooms, as dry indoor air pulls moisture out of the skin barrier.',
    'Pause exfoliating actives until skin feels comfortable, as a stressed barrier worsens dryness and sensitivity.',
  ],
  firmness_skin_support: [
    'Get 7–8 hours of sleep each night, as collagen and elastin rebuild while you rest.',
    'Eat protein at every meal, as amino acids are the raw material for collagen and elastin.',
    'Reduce sugar and avoid smoking, as both accelerate elastin breakdown and premature ageing.',
  ],
  pigmentation_stability: [
    'Use gentle moisturisers and a non-pore-clogging SPF daily, as UV exposure can increase melanocyte activity and uneven tone.',
    'Wear a wide-brim hat and sunglasses in peak sun, as physical shade reduces inflammation that worsens pigmentation.',
    'Avoid unprescribed bleaching products, as they can irritate the skin and trigger rebound dark spots.',
  ],
};

export interface LifestyleRecommendation {
  tip: string;
}

/**
 * Returns at most 3 client-facing lifestyle tips.
 *
 * Selection:
 * - Walk priority_order lowest → highest.
 * - For each variable scoring ≤ 60, take its primary tip.
 * - Stop at 3.
 * - If fewer than 3 variables qualify, top up from the lowest-scoring
 *   variable's secondary tips. Never duplicate.
 */
export const lifestyleRecommendations = (
  engine: EnginePayload | null | undefined,
): LifestyleRecommendation[] => {
  if (!engine) return [];
  const order = (engine.priority_order ?? ENGINE_VARIABLE_KEYS).filter((k) => {
    const s = engine.variables[k];
    return s && typeof s.practitioner_score === 'number';
  });
  const qualifying = order.filter((k) => (engine.variables[k]!.practitioner_score) <= 60);
  const seen = new Set<string>();
  const out: LifestyleRecommendation[] = [];
  // Pass 1: one primary tip per qualifying variable.
  for (const k of qualifying) {
    if (out.length >= 2) break;
    const tip = LIFESTYLE_TIP_BANK[k][0];
    if (!seen.has(tip)) {
      seen.add(tip);
      out.push({ tip });
    }
  }
  // Pass 2: top up from the lowest-scoring variable's secondary tips.
  if (out.length < 2 && qualifying.length > 0) {
    const lowest = qualifying[0];
    for (const tip of LIFESTYLE_TIP_BANK[lowest].slice(1)) {
      if (out.length >= 2) break;
      if (seen.has(tip)) continue;
      seen.add(tip);
      out.push({ tip });
    }
  }
  return out.slice(0, 2);
};

/* --------------------------------------------------------------------------
 * Report personalization helpers (pure)
 * -------------------------------------------------------------------------- */

export interface PersonalizeCtx {
  firstName?: string;
  mainConcern?: string;
  goal?: string;
  topVariable?: string;
  topScore?: number;
  stability?: string;
  acceptedServices?: string[];
  acceptedProducts?: string[];
  topAcceptedService?: string;
  topAcceptedProduct?: string;
  hasAi?: boolean;
}

/**
 * Substitute {{token}} placeholders with values from ctx.
 * If a token has no value, remove it and collapse surrounding whitespace/punctuation cleanly.
 * Never throws; always returns a string.
 */
export function personalizeCopy(text: string, ctx: PersonalizeCtx): string {
  if (!text) return '';
  const map: Record<string, string | undefined> = {
    firstName: ctx.firstName,
    mainConcern: ctx.mainConcern,
    goal: ctx.goal,
    topVariable: ctx.topVariable,
    topScore: typeof ctx.topScore === 'number' ? `${ctx.topScore}%` : undefined,
    stability: ctx.stability,
    topAcceptedService: ctx.topAcceptedService,
    topAcceptedProduct: ctx.topAcceptedProduct,
  };
  let out = text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => {
    const v = map[key];
    return v ? v : '\u0000';
  });
  // Remove placeholder markers plus any leading connector words / stray punctuation.
  out = out.replace(/\s*[,;:—-]?\s*\u0000/g, '');
  out = out.replace(/\s{2,}/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();
  return out;
}

/** Human label for engine stability (higher score = more stable). */
export function stabilityLabel(score: number | null | undefined): string {
  if (typeof score !== 'number') return '—';
  if (score >= 80) return 'Very stable';
  if (score >= 65) return 'Stable';
  if (score >= 50) return 'Watch';
  if (score >= 35) return 'Needs support';
  return 'Priority';
}

/** Build a personalization context from the assessment row + client. */
export function buildPersonalizeCtx(input: {
  clientName?: string | null;
  mainConcern?: string | null;
  goal?: string | null;
  engine?: EnginePayload | null;
  acceptedServices?: string[];
  acceptedProducts?: string[];
  hasAi?: boolean;
}): PersonalizeCtx {
  const firstName = (input.clientName ?? '').trim().split(/\s+/)[0] || undefined;
  const engine = input.engine ?? null;
  let topVariable: string | undefined;
  let topScore: number | undefined;
  let stability: string | undefined;
  if (engine) {
    const order = engine.priority_order ?? ENGINE_VARIABLE_KEYS;
    const firstKey = order.find((k) => typeof engine.variables[k]?.practitioner_score === 'number');
    if (firstKey) {
      topVariable = ENGINE_VARIABLE_LABEL[firstKey].toLowerCase();
      topScore = engine.variables[firstKey]!.practitioner_score;
      stability = stabilityLabel(topScore).toLowerCase();
    }
  }
  return {
    firstName,
    mainConcern: input.mainConcern?.trim() || undefined,
    goal: input.goal?.trim() || undefined,
    topVariable,
    topScore,
    stability,
    acceptedServices: input.acceptedServices,
    acceptedProducts: input.acceptedProducts,
    topAcceptedService: input.acceptedServices?.[0],
    topAcceptedProduct: input.acceptedProducts?.[0],
    hasAi: !!input.hasAi,
  };
}

export interface ConfidenceBanner {
  show: boolean;
  tone: 'info' | 'warn';
  message: string;
}

/**
 * Produce a small banner describing AI confidence / image quality.
 * `show=false` when there's no AI assist or the image was fine.
 */
export function confidenceBanner(ai: {
  image_quality?: { usable: boolean; notes?: string } | null;
} | null | undefined): ConfidenceBanner {
  if (!ai) return { show: false, tone: 'info', message: '' };
  const q = ai.image_quality;
  if (q && q.usable === false) {
    return {
      show: true,
      tone: 'warn',
      message: q.notes
        ? `Image quality limited (${q.notes}). Priority areas to monitor were flagged for practitioner review.`
        : 'Image quality limited — priority areas to monitor were flagged for practitioner review.',
    };
  }
  return { show: false, tone: 'info', message: '' };
}
