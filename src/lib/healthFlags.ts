/**
 * Pure helpers for deriving health-risk flags from a client safety/health
 * intake record. Used in the intake modal preview, the client Health tab,
 * the Front Desk active-visit card and any treatment view.
 */
export type HealthFlagSeverity = 'red' | 'amber' | 'green';

export interface HealthFlag {
  key: string;
  label: string;
  severity: 'red' | 'amber';
}

export interface HealthIntakeFlagInput {
  is_pregnant?: string | null;
  is_breastfeeding?: boolean | null;
  allergy_severity?: string | null;
  anaesthetic_reaction?: boolean | null;
  on_blood_thinners?: boolean | null;
  on_retinoids?: boolean | null;
  on_hormonal_therapy?: boolean | null;
  keloid_tendency?: boolean | null;
  cold_sore_history?: boolean | null;
  recent_sun_exposure?: boolean | null;
  recent_procedures?: string | null;
  chronic_conditions?: string[] | null;
}

/** Compute red/amber flags. Returns [] when nothing is concerning. */
export const computeHealthFlags = (i: HealthIntakeFlagInput | null | undefined): HealthFlag[] => {
  if (!i) return [];
  const flags: HealthFlag[] = [];

  // RED — high risk
  if (i.is_pregnant === 'yes') flags.push({ key: 'pregnant', label: 'Pregnant', severity: 'red' });
  if (i.allergy_severity === 'anaphylaxis')
    flags.push({ key: 'anaphylaxis', label: 'Anaphylaxis history', severity: 'red' });
  if (i.anaesthetic_reaction)
    flags.push({ key: 'anaesthetic', label: 'Anaesthetic reaction', severity: 'red' });
  if (i.on_blood_thinners)
    flags.push({ key: 'blood_thinners', label: 'On blood thinners', severity: 'red' });

  // AMBER — caution
  if (i.is_pregnant === 'unsure')
    flags.push({ key: 'pregnant_unsure', label: 'Pregnancy status unsure', severity: 'amber' });
  if (i.is_breastfeeding) flags.push({ key: 'breastfeeding', label: 'Breastfeeding', severity: 'amber' });
  if (i.allergy_severity === 'severe')
    flags.push({ key: 'severe_allergy', label: 'Severe allergy', severity: 'amber' });
  if (i.on_retinoids) flags.push({ key: 'retinoids', label: 'On retinoids', severity: 'amber' });
  if (i.on_hormonal_therapy)
    flags.push({ key: 'hormonal', label: 'Hormonal therapy', severity: 'amber' });
  if (i.keloid_tendency)
    flags.push({ key: 'keloid', label: 'Keloid tendency', severity: 'amber' });
  if (i.cold_sore_history)
    flags.push({ key: 'cold_sores', label: 'Cold sore history', severity: 'amber' });
  if (i.recent_sun_exposure)
    flags.push({ key: 'sun', label: 'Recent sun exposure', severity: 'amber' });
  if (i.recent_procedures && i.recent_procedures.trim().length > 0)
    flags.push({ key: 'recent_procedure', label: 'Recent procedure', severity: 'amber' });

  if (i.chronic_conditions && i.chronic_conditions.length > 0) {
    const real = i.chronic_conditions.filter((c) => c && c !== 'None');
    if (real.length > 0) {
      flags.push({
        key: 'chronic',
        label: real.length === 1 ? real[0] : `${real.length} chronic conditions`,
        severity: 'amber',
      });
    }
  }

  return flags;
};

export const overallSeverity = (flags: HealthFlag[]): HealthFlagSeverity => {
  if (flags.some((f) => f.severity === 'red')) return 'red';
  if (flags.length > 0) return 'amber';
  return 'green';
};

export const flagChipClass = (sev: 'red' | 'amber'): string =>
  sev === 'red'
    ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
    : 'bg-amber-500/15 border-amber-500/40 text-amber-700 font-semibold';

export const overallSeverityChipClass = (sev: HealthFlagSeverity): string => {
  if (sev === 'red') return 'bg-rose-500/15 border-rose-500/40 text-rose-300';
  if (sev === 'amber') return 'bg-amber-500/15 border-amber-500/40 text-amber-700 font-semibold';
  return 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300';
};

export const overallSeverityLabel = (sev: HealthFlagSeverity): string => {
  if (sev === 'red') return 'High risk';
  if (sev === 'amber') return 'Caution';
  return 'No major flags';
};