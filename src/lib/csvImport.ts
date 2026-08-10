import type { Database } from '@/integrations/supabase/types';
import { AGE_GROUPS, type AgeGroup } from '@/lib/ageGroups';

export type SystemField =
  | 'full_name'
  | 'phone'
  | 'email'
  | 'gender'
  | 'age_group'
  | 'location'
  | 'source_type'
  | 'notes'
  | 'ignore';

export const SYSTEM_FIELDS: { id: SystemField; label: string; required?: boolean }[] = [
  { id: 'full_name', label: 'Full Name', required: true },
  { id: 'phone', label: 'Phone', required: true },
  { id: 'email', label: 'Email' },
  { id: 'gender', label: 'Gender' },
  { id: 'age_group', label: 'Age Group' },
  { id: 'location', label: 'Location' },
  { id: 'source_type', label: 'Source' },
  { id: 'notes', label: 'Notes' },
  { id: 'ignore', label: '— Ignore —' },
];

export type ColumnMapping = Record<string, SystemField>;

export interface AutoTagRule {
  keyword: string;
  tag: string;
}

export interface MappingTemplate {
  id: string;
  name: string;
  mapping: ColumnMapping;
  defaultSource: string;
  autoTagRules: AutoTagRule[];
  createdAt: string;
}

const TEMPLATES_KEY = 'tropics.csvImport.templates.v1';

export const loadMappingTemplates = (): MappingTemplate[] => {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MappingTemplate[];
  } catch {
    return [];
  }
};

export const saveMappingTemplates = (list: MappingTemplate[]) => {
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota errors */
  }
};

/** Cleans a phone for use as a dedupe key — strips everything except digits. */
export const normalisePhoneKey = (raw: string | null | undefined): string => {
  if (!raw) return '';
  const digits = String(raw).replace(/\D+/g, '');
  return digits.replace(/^0+/, '');
};

const GENDER_MAP: Record<string, string> = {
  m: 'male', male: 'male', man: 'male',
  f: 'female', female: 'female', woman: 'female',
  o: 'other', other: 'other', nb: 'non-binary', 'non-binary': 'non-binary',
};

export const normaliseGender = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const k = String(raw).trim().toLowerCase();
  return GENDER_MAP[k] ?? (k || null);
};

/** Best-effort age group resolution from either an age number or a label. */
export const normaliseAgeGroup = (raw: string | null | undefined): AgeGroup | null => {
  if (!raw) return null;
  const v = String(raw).trim().toLowerCase().replace(/\s+/g, '');
  // Direct token match
  if ((AGE_GROUPS as readonly string[]).includes(v)) return v as AgeGroup;
  // Label-style: "18-24", "18–24"
  const cleanLabel = v.replace(/[–—]/g, '-');
  const labelMap: Record<string, AgeGroup> = {
    'under18': 'under_18', '<18': 'under_18',
    '18-24': '18_24',
    '25-34': '25_34',
    '35-44': '35_44',
    '45-54': '45_54',
    '55-64': '55_64',
    '65+': '65_plus', '65plus': '65_plus',
  };
  if (labelMap[cleanLabel]) return labelMap[cleanLabel];
  // Numeric age
  const n = Number(cleanLabel);
  if (Number.isFinite(n) && n > 0) {
    if (n < 18) return 'under_18';
    if (n <= 24) return '18_24';
    if (n <= 34) return '25_34';
    if (n <= 44) return '35_44';
    if (n <= 54) return '45_54';
    if (n <= 64) return '55_64';
    return '65_plus';
  }
  return null;
};

export type ParsedRow = Record<string, string>;

export type RowStatus = 'ready' | 'invalid' | 'duplicate_update';

export interface PreparedRow {
  index: number;
  raw: ParsedRow;
  full_name: string;
  phone: string | null;
  phoneKey: string;
  email: string | null;
  gender: string | null;
  age_group: AgeGroup | null;
  location: string | null;
  source_type: string;
  notes: string | null;
  appliedTags: string[];
  status: RowStatus;
  errors: string[];
  matchedExistingId: string | null;
}

export interface PrepareInput {
  rows: ParsedRow[];
  mapping: ColumnMapping;
  defaultSource: string;
  autoTagRules: AutoTagRule[];
  existingClients: { id: string; phone: string | null }[];
}

const findColumn = (mapping: ColumnMapping, target: SystemField): string | null => {
  for (const [col, field] of Object.entries(mapping)) {
    if (field === target) return col;
  }
  return null;
};

export const prepareRows = ({
  rows, mapping, defaultSource, autoTagRules, existingClients,
}: PrepareInput): PreparedRow[] => {
  const cols: Partial<Record<SystemField, string>> = {};
  (Object.keys(mapping) as string[]).forEach((c) => {
    const f = mapping[c];
    if (f && f !== 'ignore') cols[f] = c;
  });

  const phoneIndex = new Map<string, string>();
  existingClients.forEach((c) => {
    const k = normalisePhoneKey(c.phone);
    if (k) phoneIndex.set(k, c.id);
  });

  return rows.map<PreparedRow>((raw, index) => {
    const get = (f: SystemField) => {
      const c = cols[f];
      if (!c) return '';
      const v = raw[c];
      return (v ?? '').toString().trim();
    };

    const full_name = get('full_name');
    const phoneRaw = get('phone');
    const phoneKey = normalisePhoneKey(phoneRaw);
    const email = get('email') || null;
    const gender = normaliseGender(get('gender'));
    const age_group = normaliseAgeGroup(get('age_group'));
    const location = get('location') || null;
    const source_type = get('source_type') || defaultSource || 'csv-import';
    const notes = get('notes') || null;

    const errors: string[] = [];
    if (!full_name) errors.push('Missing name');
    if (!phoneKey) errors.push('Missing phone');

    // Auto-tag based on notes content
    const appliedTags: string[] = [];
    if (notes && autoTagRules.length) {
      const lower = notes.toLowerCase();
      autoTagRules.forEach((r) => {
        const kw = r.keyword.trim().toLowerCase();
        if (kw && lower.includes(kw) && !appliedTags.includes(r.tag)) {
          appliedTags.push(r.tag);
        }
      });
    }

    const matchedExistingId = phoneKey ? phoneIndex.get(phoneKey) ?? null : null;

    let status: RowStatus = 'ready';
    if (errors.length) status = 'invalid';
    else if (matchedExistingId) status = 'duplicate_update';

    return {
      index,
      raw,
      full_name,
      phone: phoneRaw || null,
      phoneKey,
      email,
      gender,
      age_group,
      location,
      source_type,
      notes,
      appliedTags,
      status,
      errors,
      matchedExistingId,
    };
  });
};

/** Returns the auto-detected mapping for a given header row (best-effort by name). */
export const autoDetectMapping = (headers: string[]): ColumnMapping => {
  const result: ColumnMapping = {};
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const hits: Record<SystemField, string[]> = {
    full_name: ['name', 'fullname', 'clientname', 'customer'],
    phone: ['phone', 'mobile', 'whatsapp', 'tel', 'cell'],
    email: ['email', 'mail'],
    gender: ['gender', 'sex'],
    age_group: ['age', 'agegroup'],
    location: ['location', 'city', 'address', 'town'],
    source_type: ['source', 'channel', 'origin', 'campaign'],
    notes: ['notes', 'comment', 'remarks', 'message'],
    ignore: [],
  };

  headers.forEach((h) => {
    const n = norm(h);
    let chosen: SystemField = 'ignore';
    for (const f of Object.keys(hits) as SystemField[]) {
      if (hits[f].some((needle) => n.includes(needle))) {
        chosen = f;
        break;
      }
    }
    result[h] = chosen;
  });
  return result;
};

export type ClientInsert = Database['public']['Tables']['clients']['Insert'];
export type ClientUpdate = Database['public']['Tables']['clients']['Update'];

export const buildInsertPayload = (row: PreparedRow, attributedStaffId: string | null): ClientInsert => ({
  full_name: row.full_name,
  phone: row.phone,
  email: row.email,
  gender: row.gender,
  age_group: row.age_group,
  location: row.location,
  source_type: row.source_type,
  notes: row.appliedTags.length
    ? `${row.notes ?? ''}\n[tags: ${row.appliedTags.join(', ')}]`.trim()
    : row.notes,
  attributed_staff_id: attributedStaffId,
  status: 'new_lead',
  membership_type: 'none',
  last_contact_date: null,
});

export const buildUpdatePayload = (row: PreparedRow): ClientUpdate => {
  const patch: ClientUpdate = {
    full_name: row.full_name,
    source_type: row.source_type,
  };
  if (row.email) patch.email = row.email;
  if (row.gender) patch.gender = row.gender;
  if (row.age_group) patch.age_group = row.age_group;
  if (row.location) patch.location = row.location;
  if (row.notes || row.appliedTags.length) {
    const tagPart = row.appliedTags.length ? `\n[tags: ${row.appliedTags.join(', ')}]` : '';
    patch.notes = `${row.notes ?? ''}${tagPart}`.trim();
  }
  return patch;
};