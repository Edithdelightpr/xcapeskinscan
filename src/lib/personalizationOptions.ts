/**
 * Option catalogue for the Tropixa product-personalization intake.
 *
 * These are plain-language, non-clinical groupings. They are intentionally
 * kept in one place so they can later be moved to an admin-editable
 * `site_settings` key without touching the form component.
 */

export const CONCERN_GROUPS = [
  { value: 'breakouts', label: 'Breakouts / acne' },
  { value: 'dark_marks', label: 'Dark marks / uneven tone' },
  { value: 'dryness', label: 'Dryness / barrier discomfort' },
  { value: 'sensitivity', label: 'Sensitivity / redness' },
  { value: 'other', label: 'Other' },
] as const;

export const CONCERN_DURATIONS = [
  { value: 'lt_1m', label: 'Less than 1 month' },
  { value: '1_6m', label: '1–6 months' },
  { value: '6_12m', label: '6–12 months' },
  { value: 'gt_1y', label: 'More than 1 year' },
] as const;

export const SKIN_FEEL = [
  { value: 'dry', label: 'Dry / tight' },
  { value: 'oily', label: 'Oily' },
  { value: 'combination', label: 'Both oily and dry' },
  { value: 'normal', label: 'Comfortable / normal' },
  { value: 'sensitive', label: 'Sensitive or easily irritated' },
] as const;

export const SYMPTOMS = [
  { value: 'breakouts', label: 'Breakouts' },
  { value: 'dark_marks', label: 'Dark marks' },
  { value: 'rough_texture', label: 'Rough texture' },
  { value: 'itching', label: 'Itching' },
  { value: 'burning', label: 'Burning / stinging' },
  { value: 'redness', label: 'Redness' },
  { value: 'flaking', label: 'Flaking' },
  { value: 'none', label: 'None of these' },
  { value: 'other', label: 'Other' },
] as const;

export const REACTION_OPTIONS = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

export const PRACTITIONER_NOTES = [
  { value: 'pregnancy', label: 'Pregnant or breastfeeding' },
  { value: 'prescription', label: 'Using prescription skin medication' },
  { value: 'allergies', label: 'Known allergies' },
  { value: 'under_care', label: 'Currently being treated by a dermatologist or doctor' },
  { value: 'none', label: 'None of these' },
] as const;

export const CONTACT_METHODS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
] as const;

const asMap = (list: readonly { value: string; label: string }[]) =>
  Object.fromEntries(list.map((o) => [o.value, o.label]));

/** Turn a stored answer value into its human label (falls back to the raw value). */
export const labelFor = (
  list: readonly { value: string; label: string }[],
  value?: string | null,
) => (value ? asMap(list)[value] ?? value : '');

export const labelsFor = (
  list: readonly { value: string; label: string }[],
  values?: string[] | null,
) => (values ?? []).map((v) => labelFor(list, v));
