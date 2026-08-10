import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIRROR_START = '// ---- MIRROR REGION START';
const MIRROR_END_MARKER = '// ---- MIRROR REGION END';

function extractMirrorRegion(path: string): string {
  const source = readFileSync(path, 'utf8');
  const start = source.indexOf(MIRROR_START);
  const end = source.indexOf(MIRROR_END_MARKER);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Missing mirror markers in ${path}`);
  }
  return source.slice(start, end);
}

describe('reportConcernFormatter mirror parity', () => {
  it('src canonical and edge-function mirror have byte-identical MIRROR REGIONs', () => {
    const root = process.cwd();
    const canonical = extractMirrorRegion(
      resolve(root, 'src/lib/reportConcernFormatter.ts'),
    );
    const mirror = extractMirrorRegion(
      resolve(root, 'supabase/functions/_shared/reportConcernFormatter.ts'),
    );
    expect(mirror).toBe(canonical);
  });

  it('edge-function skinEngine mirror matches src canonical', () => {
    const root = process.cwd();
    const canonical = readFileSync(resolve(root, 'src/lib/skinEngine.ts'), 'utf8');
    const mirror = readFileSync(
      resolve(root, 'supabase/functions/_shared/skinEngine.ts'),
      'utf8',
    );
    expect(mirror).toBe(canonical);
  });

  it('formatted concerns never expose a customization field or leak home_care_direction copy', async () => {
    // The CUSTOMIZATION position belongs to the practitioner-approved kit
    // formula only — generic engine copy (SPF, brightening routines,
    // antioxidants…) must never occupy it.
    const { formatConcerns } = await import('./reportConcernFormatter');
    const { ENGINE_VARIABLE_KEYS, stageFor } = await import('./skinEngine');
    // Collect every stage's home_care_direction string across all bands.
    const directions = new Set<string>();
    for (const key of ENGINE_VARIABLE_KEYS) {
      for (const score of [10, 30, 60, 90]) {
        directions.add(stageFor(key, score).home_care_direction);
      }
    }
    const concerns = formatConcerns({
      engine: {
        priority_order: [
          'barrier_surface_hydration',
          'pigmentation_stability',
          'firmness_skin_support',
          'oil_congestion_balance',
        ],
        variables: {
          barrier_surface_hydration: { practitioner_score: 42 },
          pigmentation_stability: { practitioner_score: 48 },
          firmness_skin_support: { practitioner_score: 62 },
          oil_congestion_balance: { practitioner_score: 54 },
        },
      },
    });
    expect(concerns).toHaveLength(4);
    for (const c of concerns) {
      expect('customization' in c).toBe(false);
      for (const v of Object.values(c)) {
        expect(directions.has(v as string)).toBe(false);
      }
    }
  });
});