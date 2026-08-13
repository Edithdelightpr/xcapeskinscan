import { describe, expect, it } from 'vitest';
import { sanitizeProtocol, sanitizeReportPayload } from '@/lib/publicAnalysisReport';
import { buildFormulaCartItem } from '@/lib/reportFormulas';
import { resolveProtocol } from '@/lib/xcapeRules/protocol';
import { scoresFromSkin } from '@/components/xcape/protocol/StaffProtocolPanel';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyFormula = (over: Record<string, unknown>) => over as any;

describe('public protocol sanitizer', () => {
  const payload = {
    face: [
      {
        product_name: 'XCAPE Face Cream',
        product_sku: 'XC-FACE-CREAM',
        product_id: 'uuid-leak',
        price: 25000,
        additions: [
          {
            concern: 'Hyperpigmentation',
            ds_name: 'DS Tyrosinase Inhibitor',
            ds_sku: 'XC-DS-TYROSINASE',
            dose_ml: 1.5,
            tier_label: '25–49',
            score: 30,
            companion: false,
            ai_raw: { anything: true },
          },
        ],
      },
    ],
    body: [],
  };

  it('keeps only whitelisted display fields', () => {
    const out = sanitizeProtocol(payload)!;
    expect(Object.keys(out.face[0]).sort()).toEqual([
      'additions',
      'area',
      'product_image_url',
      'product_name',
    ]);
    expect(Object.keys(out.face[0].additions[0]).sort()).toEqual([
      'companion',
      'concern',
      'derivation',
      'dose_ml',
      'ds_name',
      'score',
      'tier_label',
    ]);
    expect(JSON.stringify(out)).not.toMatch(/uuid-leak|25000|ai_raw|XC-DS|XC-FACE/);
  });

  it('drops a companion-only product card', () => {
    const out = sanitizeProtocol({
      face: [
        {
          product_name: 'XCAPE Face Cream',
          additions: [
            {
              concern: 'Hyperpigmentation',
              ds_name: 'DS Anti-Inflammatory',
              dose_ml: 1.5,
              tier_label: '25–49',
              score: 30,
              companion: true,
            },
          ],
        },
      ],
      body: [],
    });
    expect(out).toBeNull();
  });

  it('rejects malformed doses and scores', () => {
    expect(
      sanitizeProtocol({
        face: [
          {
            product_name: 'X',
            additions: [{ concern: 'c', ds_name: 'd', dose_ml: -1, score: 30, companion: false }],
          },
        ],
      }),
    ).toBeNull();
  });

  it('report payload carries a null protocol when absent', () => {
    expect(sanitizeReportPayload({ variables: {} }).protocol).toBeNull();
  });
});

describe('staff / public resolver parity', () => {
  it('the staff resolver output maps 1:1 onto the sanitized public payload', () => {
    const scores = {
      pigmentation_stability: 30,
      oil_congestion_balance: 60,
      firmness_skin_support: 80,
      barrier_surface_hydration: 20,
    };
    const staff = resolveProtocol({ scores });
    const publicPayload = sanitizeProtocol({
      face: staff.face.map((p) => ({ product_name: p.product_name, additions: p.additions })),
      body: staff.body.map((p) => ({ product_name: p.product_name, additions: p.additions })),
    })!;
    expect(publicPayload.face.map((p) => p.product_name)).toEqual(
      staff.face.map((p) => p.product_name),
    );
    expect(publicPayload.body.map((p) => p.product_name)).toEqual(
      staff.body.map((p) => p.product_name),
    );
    expect(publicPayload.face[0].additions.map((a) => a.dose_ml)).toEqual(
      staff.face[0].additions.map((a) => a.dose_ml),
    );
  });
});

describe('staff score extraction', () => {
  it('reads approved practitioner scores from the engine payload', () => {
    const skin = {
      observed_causes: [],
      engine: { variables: { pigmentation_stability: { practitioner_score: 42 } } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    expect(scoresFromSkin(skin)).toEqual({ pigmentation_stability: 42 });
  });

  it('a pigmentation score resolves the required companion in the public payload', () => {
    const staff = resolveProtocol({ scores: { pigmentation_stability: 30 } });
    const publicPayload = sanitizeProtocol({
      face: staff.face.map((p) => ({ product_name: p.product_name, additions: p.additions })),
      body: staff.body.map((p) => ({ product_name: p.product_name, additions: p.additions })),
    })!;
    const names = publicPayload.face.flatMap((p) => p.additions.map((a) => a.ds_name));
    expect(names).toContain('DS Anti-Inflammatory');
    expect(JSON.stringify(publicPayload)).not.toMatch(/sku|price|product_id|ai_raw/i);
  });
});

describe('zero-priced items cannot enter the cart', () => {
  it('blocks a kit with price 0', () => {
    expect(
      buildFormulaCartItem(anyFormula({ id: 'f1', kit_product_id: 'p1', kit_unit_price: 0 })),
    ).toBeNull();
  });
  it('blocks a kit with no price', () => {
    expect(
      buildFormulaCartItem(anyFormula({ id: 'f1', kit_product_id: 'p1', kit_unit_price: null })),
    ).toBeNull();
  });
  it('allows a real priced kit', () => {
    expect(
      buildFormulaCartItem(anyFormula({ id: 'f1', kit_product_id: 'p1', kit_unit_price: 25000 })),
    ).not.toBeNull();
  });
});
