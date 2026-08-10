/**
 * Safety and behaviour tests for the Delight Express admin mockup.
 *
 * The critical guarantee: mock configuration can NEVER become a purchase or
 * leak into public surfaces. These tests pin that
 *  - mock formulas always have `kit_product_id: null`, so no cart line can
 *    be built from them at any price, category or score;
 *  - selecting a real catalogue item for visual preview cannot change that;
 *  - no public report / cart / checkout edge function reads the mock table;
 *  - the public report fetch still limits formulas to practitioner-approved,
 *    non-demo snapshots.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_MOCKUP_CONFIG,
  MOCKUP_KEY,
  MOCKUP_TABLE,
  isMockPlaceholder,
  mockupToFormula,
  sanitizeMockupConfig,
  withCataloguePreview,
  type DelightMockupConfig,
} from './mockup';
import { buildFormulaCartItem } from '../reportFormulas';
import { CUSTOMIZATION_CATEGORIES, validateDoseTiers } from './customization';

const cfg = (over: Partial<DelightMockupConfig> = {}): DelightMockupConfig => ({
  ...DEFAULT_MOCKUP_CONFIG,
  dose_tiers: DEFAULT_MOCKUP_CONFIG.dose_tiers.map((t) => ({ ...t })),
  ...over,
});

describe('sanitizeMockupConfig', () => {
  it('falls back to defaults for missing or garbage input', () => {
    expect(sanitizeMockupConfig(null)).toEqual(DEFAULT_MOCKUP_CONFIG);
    expect(sanitizeMockupConfig('junk')).toEqual(DEFAULT_MOCKUP_CONFIG);
    expect(sanitizeMockupConfig([1, 2, 3])).toEqual(DEFAULT_MOCKUP_CONFIG);
    expect(sanitizeMockupConfig({ dose_tiers: 'nope' })).toEqual(DEFAULT_MOCKUP_CONFIG);
  });

  it('merges a partial stored config over defaults', () => {
    const merged = sanitizeMockupConfig({ kit_display_name: 'My Kit', preview_score: 12 });
    expect(merged.kit_display_name).toBe('My Kit');
    expect(merged.preview_score).toBe(12);
    expect(merged.companion_label).toBe(DEFAULT_MOCKUP_CONFIG.companion_label);
  });

  it('rejects unknown categories and clamps the score', () => {
    const merged = sanitizeMockupConfig({ preview_category: 'not_a_category', preview_score: 500 });
    expect(merged.preview_category).toBe(DEFAULT_MOCKUP_CONFIG.preview_category);
    expect(merged.preview_score).toBe(100);
  });
});

describe('mock placeholders', () => {
  it('flags untouched defaults as mock, cleared once edited', () => {
    expect(isMockPlaceholder(cfg(), 'base_product_label')).toBe(true);
    expect(isMockPlaceholder(cfg(), 'companion_label')).toBe(true);
    expect(isMockPlaceholder(cfg({ base_product_label: 'XCAPE Moisturizer' }), 'base_product_label')).toBe(false);
  });
});

describe('mockupToFormula dose resolution', () => {
  it.each([
    [0, 2.0],
    [24, 2.0],
    [25, 1.5],
    [49, 1.5],
    [50, 1.0],
    [74, 1.0],
    [75, 0.5],
    [100, 0.5],
  ])('score %i resolves to %s ml from the default tiers', (score, dose) => {
    expect(mockupToFormula(cfg({ preview_score: score })).dose_ml).toBe(dose);
  });

  it('resolves the dose from edited tiers too', () => {
    const custom = cfg({
      dose_tiers: [
        { score_min: 0, score_max: 49, dose_ml: 3.0 },
        { score_min: 50, score_max: 100, dose_ml: 1.0 },
      ],
      preview_score: 30,
    });
    expect(mockupToFormula(custom).dose_ml).toBe(3.0);
    expect(validateDoseTiers(custom.dose_tiers)).toEqual([]);
  });

  it('returns no dose when tiers have a gap over the preview score', () => {
    const gapped = cfg({
      dose_tiers: [
        { score_min: 0, score_max: 20, dose_ml: 2.0 },
        { score_min: 30, score_max: 100, dose_ml: 1.0 },
      ],
      preview_score: 25,
    });
    expect(mockupToFormula(gapped).dose_ml).toBeNull();
    expect(validateDoseTiers(gapped.dose_tiers).length).toBeGreaterThan(0);
  });
});

describe('companion behaviour', () => {
  it('shows the companion dose only for aggressive actives', () => {
    const mild = mockupToFormula(cfg({ aggressiveness: 'mild', preview_score: 10 }));
    expect(mild.companion_name).toBeNull();
    expect(mild.companion_dose_ml).toBeNull();

    const aggressive = mockupToFormula(cfg({ aggressiveness: 'aggressive', preview_score: 10 }));
    expect(aggressive.companion_name).toBe(DEFAULT_MOCKUP_CONFIG.companion_label);
    expect(aggressive.companion_dose_ml).toBe(2.0); // 2.0 ml dose × ratio 1.0
  });

  it('applies the companion ratio to the resolved dose', () => {
    const f = mockupToFormula(cfg({ aggressiveness: 'aggressive', preview_score: 10, companion_ratio: 2 }));
    expect(f.companion_dose_ml).toBe(4.0);
  });
});

describe('purchase isolation — mock data can never become a cart line', () => {
  it('mock formulas always have a null kit product id and demo flag', () => {
    const f = mockupToFormula(cfg({ display_price: 250000 }));
    expect(f.kit_product_id).toBeNull();
    expect(f.is_demo).toBe(true);
    expect(f.id).toBe('mockup');
  });

  it('no cart line can be built at any category, score or price', () => {
    const scores = [0, 10, 24, 25, 40, 49, 50, 74, 75, 90, 100];
    for (const c of CUSTOMIZATION_CATEGORIES) {
      for (const score of scores) {
        const f = mockupToFormula(
          cfg({ preview_category: c.key, preview_score: score, display_price: 999999 }),
        );
        expect(buildFormulaCartItem(f)).toBeNull();
      }
    }
  });

  it('previewing a real catalogue item still cannot produce a cart line', () => {
    const f = withCataloguePreview(mockupToFormula(cfg()), {
      id: 'real-product-id',
      name: 'Delight Express Kit',
      selling_price: 120000,
      image_url: 'https://example.com/kit.jpg',
    });
    expect(f.kit_name).toBe('Delight Express Kit');
    expect(f.kit_unit_price).toBe(120000);
    expect(f.kit_product_id).toBeNull(); // the invariant that blocks purchase
    expect(buildFormulaCartItem(f)).toBeNull();
  });
});

describe('public surface isolation', () => {
  const funcSrc = (name: string): string => {
    const dir = join(process.cwd(), 'supabase', 'functions', name);
    return readdirSync(dir)
      .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
      .map((f) => readFileSync(join(dir, f), 'utf8'))
      .join('\n');
  };

  const PUBLIC_SURFACES = [
    'public-report-fetch',
    'public-report-download-pdf',
    'public-report-event',
    'public-report-claim-payment',
    'admin-preview-report',
  ];

  it('mock config lives in its own admin-only table, never in operational tables', () => {
    expect(MOCKUP_TABLE).toBe('xcape_admin_mockups');
    expect(MOCKUP_KEY).toBe('delight_express_card');
    for (const table of [
      'products',
      'xcape_formula_snapshots',
      'xcape_recommendation_proposals',
      'pending_outreach_orders',
      'xcape_category_customization',
    ]) {
      expect(MOCKUP_TABLE).not.toBe(table);
    }
  });

  it.each(PUBLIC_SURFACES)('edge function %s never reads the mock table', (name) => {
    expect(funcSrc(name)).not.toContain(MOCKUP_TABLE);
  });

  it('public report payloads stay limited to approved, non-demo snapshots', () => {
    const src = funcSrc('public-report-fetch');
    expect(src).toContain(".eq('status', 'approved')");
    expect(src).toContain(".eq('is_demo', false)");
  });
});

describe('private mock image storage', () => {
  const editorSrc = () =>
    readFileSync(
      join(process.cwd(), 'src/components/xcape/admin/DelightExpressMockup.tsx'),
      'utf8',
    );

  it('uploads only to the private xcape-admin-mockups bucket via signed URLs', () => {
    const src = editorSrc();
    expect(src).toContain("'xcape-admin-mockups'");
    expect(src).toContain('createSignedUrl');
    expect(src).not.toContain('product-media');
    expect(src).not.toContain('getPublicUrl');
  });

  it('never persists signed storage URLs in the mock config', () => {
    const signed =
      'https://example.supabase.co/storage/v1/object/sign/xcape-admin-mockups/mockups/x.png?token=abc123';
    const cleaned = sanitizeMockupConfig({
      kit_image_url: signed,
      kit_image_storage_path: 'mockups/delight-express/x.png',
    });
    expect(cleaned.kit_image_url).toBe(''); // stripped back to the empty default
    expect(cleaned.kit_image_storage_path).toBe('mockups/delight-express/x.png');
    // a plain external URL remains an explicit allowed option
    expect(
      sanitizeMockupConfig({ kit_image_url: 'https://cdn.example.com/kit.png' }).kit_image_url,
    ).toBe('https://cdn.example.com/kit.png');
  });

  it('storage policies for the mockup bucket are admin role-scoped with no anon access', () => {
    const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
    const sql = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(join(migrationsDir, f), 'utf8'))
      .join('\n');
    const statements = sql.split(/;/).filter((s) => s.includes('xcape-admin-mockups'));
    // SELECT + INSERT (with check) + DELETE policies
    expect(statements.length).toBeGreaterThanOrEqual(3);
    for (const statement of statements) {
      expect(statement).toContain("public.has_role(auth.uid(), 'admin')");
      expect(statement.toLowerCase()).not.toContain('to anon');
      expect(statement.toLowerCase()).toContain('to authenticated');
    }
  });
});
