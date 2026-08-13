import { describe, it, expect } from 'vitest';
import { sanitizeReportSkinAnalysis } from '../../supabase/functions/_shared/reportSkinAnalysis';
import { formatReport, CONCERN_FIELD_ORDER } from '@/lib/reportConcernFormatter';

/**
 * The Personal Report payload is a WHITELIST. These tests are the contract:
 * anything the practitioner-side blob may legitimately hold — raw AI JSON,
 * media ids, storage paths, staff ids, tokens, contacts, the embedded
 * protocol snapshot — must be provably unable to escape, while everything
 * `formatReport()` renders must survive intact.
 */

const FORBIDDEN_KEYS = [
  'raw',
  'media_ids',
  'machine_media_id',
  'analyzed_by',
  'analyzed_at',
  'approved_by',
  'assessed_by',
  'assessed_by_staff_id',
  'public_protocol_snapshot',
  'image_path',
  'image_paths',
  'token_hash',
  'phone',
  'email',
  'client_id',
  'model',
  'observations',
  'practitioner_notes',
  'areas_to_mark',
  'report_ready_summary',
];

const FORBIDDEN_VALUES = [
  'sess_secret_token',
  'clients/abc/front.jpg',
  '11111111-1111-1111-1111-111111111111',
  '+2348012345678',
  'leak@example.com',
  'gemini-2.5-flash',
  'RAW MODEL OUTPUT',
];

function walk(value: unknown, visit: (key: string | null, val: unknown) => void, key: string | null = null) {
  visit(key, value);
  if (Array.isArray(value)) {
    for (const v of value) walk(v, visit);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) walk(v, visit, k);
  }
}

function assertClean(payload: unknown) {
  walk(payload, (key, val) => {
    if (key !== null) expect(FORBIDDEN_KEYS).not.toContain(key);
    if (typeof val === 'string') {
      for (const bad of FORBIDDEN_VALUES) expect(val).not.toContain(bad);
    }
  });
}

const dirtyBlob = {
  skin_type: 'combination',
  machine_media_id: '11111111-1111-1111-1111-111111111111',
  practitioner_interpretation: 'internal note',
  assessed_by_staff_id: '11111111-1111-1111-1111-111111111111',
  image_paths: ['clients/abc/front.jpg'],
  token_hash: 'sess_secret_token',
  phone: '+2348012345678',
  email: 'leak@example.com',
  public_protocol_snapshot: { protocol_version: 'xcape-protocol-1.1', face: [{ product_id: 'x' }] },
  engine: {
    variables: {
      pigmentation_stability: { machine_score: 30, practitioner_score: 30, notes: 'clients/abc/front.jpg' },
      barrier_surface_hydration: { machine_score: 80, practitioner_score: null },
      firmness_skin_support: { machine_score: 10, practitioner_score: 10 },
      oil_congestion_balance: { machine_score: 60, practitioner_score: 60 },
    },
    priority_order: ['firmness_skin_support', 'pigmentation_stability', 'not_a_key', 'firmness_skin_support'],
    priority_category: 'firmness_skin_support',
    media_ids: ['11111111-1111-1111-1111-111111111111'],
    raw: 'RAW MODEL OUTPUT',
  },
  ai_assist: {
    version: '1.0',
    model: 'gemini-2.5-flash',
    analyzed_at: '2026-01-01T00:00:00Z',
    analyzed_by: '11111111-1111-1111-1111-111111111111',
    approved_by: '11111111-1111-1111-1111-111111111111',
    approved_at: '2026-01-02T00:00:00Z',
    media_ids: ['11111111-1111-1111-1111-111111111111'],
    raw: { text: 'RAW MODEL OUTPUT' },
    observations: ['clients/abc/front.jpg'],
    practitioner_notes: ['internal only'],
    image_quality: { usable: true, notes: 'Even lighting, face fully in frame.' },
    disclaimer: 'AI-assisted, reviewed by a practitioner.',
    suggested_scores: {
      pigmentation_stability: { score: 30, reasons: ['Uneven tone across the cheeks.'] },
      oil_congestion_balance: { score: 60, reasons: ['Shine across the T-zone.'] },
    },
  },
};

describe('sanitizeReportSkinAnalysis', () => {
  it('emits exactly two top-level keys', () => {
    const out = sanitizeReportSkinAnalysis(dirtyBlob);
    expect(Object.keys(out).sort()).toEqual(['ai_assist', 'engine']);
  });

  it('lets no forbidden key or value escape, recursively', () => {
    assertClean(sanitizeReportSkinAnalysis(dirtyBlob));
  });

  it('drops the embedded public protocol snapshot (delivered separately)', () => {
    const out = sanitizeReportSkinAnalysis(dirtyBlob) as unknown as Record<string, unknown>;
    expect(out.public_protocol_snapshot).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('xcape-protocol-1.1');
  });

  it('reconstructs the engine with only safe report fields', () => {
    const { engine } = sanitizeReportSkinAnalysis(dirtyBlob);
    expect(engine).not.toBeNull();
    expect(Object.keys(engine!).sort()).toEqual(['priority_category', 'priority_order', 'variables']);
    expect(Object.keys(engine!.variables!.pigmentation_stability!).sort()).toEqual([
      'machine_score',
      'practitioner_score',
    ]);
    // Unknown / duplicate priority keys are dropped.
    expect(engine!.priority_order).toEqual(['firmness_skin_support', 'pigmentation_stability']);
  });

  it('keeps approved AI observation text and its quality/disclaimer fields only', () => {
    const { ai_assist } = sanitizeReportSkinAnalysis(dirtyBlob);
    expect(Object.keys(ai_assist!).sort()).toEqual([
      'approved_at',
      'disclaimer',
      'image_quality',
      'suggested_scores',
    ]);
    expect(ai_assist!.suggested_scores.pigmentation_stability?.reasons).toEqual([
      'Uneven tone across the cheeks.',
    ]);
    expect(ai_assist!.image_quality).toEqual({
      usable: true,
      notes: 'Even lighting, face fully in frame.',
    });
  });

  it('withholds AI text entirely until a practitioner approved the envelope', () => {
    const unapproved = { ...dirtyBlob, ai_assist: { ...dirtyBlob.ai_assist, approved_at: null } };
    expect(sanitizeReportSkinAnalysis(unapproved).ai_assist).toBeNull();
  });

  it('is total: junk input yields the empty whitelisted shape', () => {
    for (const junk of [null, undefined, 'string', 42, [], { engine: 'nope' }]) {
      expect(sanitizeReportSkinAnalysis(junk)).toEqual({ engine: null, ai_assist: null });
    }
  });
});

describe('formatter still receives everything it needs', () => {
  const sanitized = sanitizeReportSkinAnalysis(dirtyBlob);
  const report = formatReport({
    clientFirstName: 'Ada',
    assessment: {
      id: 'a1',
      created_at: '2026-01-02T00:00:00Z',
      main_concern: 'Dark spots',
      client_goal: 'Even tone',
      skin_analysis: sanitized,
    },
  });

  it('renders all four concerns in engine priority order', () => {
    expect(report.concerns.map((c) => c.key)).toEqual([
      'firmness_skin_support',
      'pigmentation_stability',
      'barrier_surface_hydration',
      'oil_congestion_balance',
    ]);
  });

  it('produces every required concern field from sanitized input', () => {
    for (const c of report.concerns) {
      for (const f of CONCERN_FIELD_ORDER) {
        if (f.key === 'aiObservation') continue;
        expect(String(c[f.key as keyof typeof c] ?? '').length).toBeGreaterThan(0);
      }
      expect(c.score).toBeGreaterThanOrEqual(0);
    }
  });

  it('still surfaces the approved AI observation', () => {
    const pig = report.concerns.find((c) => c.key === 'pigmentation_stability');
    expect(pig?.aiObservation).toBe('Uneven tone across the cheeks.');
  });

  it('keeps first-name-only identity', () => {
    expect(report.client.firstName).toBe('Ada');
    expect(report.client.greeting).toBe('Welcome, Ada');
  });

  it('matches the report produced from the unsanitized blob', () => {
    const raw = formatReport({
      clientFirstName: 'Ada',
      assessment: {
        id: 'a1',
        created_at: '2026-01-02T00:00:00Z',
        main_concern: 'Dark spots',
        client_goal: 'Even tone',
        skin_analysis: dirtyBlob,
      },
    });
    expect(report).toEqual(raw);
  });
});
