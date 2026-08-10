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

  it('neither copy exposes a customization field or leaks home_care_direction into formatted concerns', async () => {
    // The CUSTOMIZATION position belongs to the practitioner-approved kit
    // formula only — generic engine copy (SPF, brightening routines,
    // antioxidants…) must never occupy it, in src OR in the edge mirror.
    const { formatConcerns } = await import('./reportConcernFormatter');
    const analysis = JSON.parse(
      readFileSync(resolve(process.cwd(), 'src/lib/skinEngine.ts'), 'utf8')
        .replace(/[\s\S]*?const ENGINE_DATA = /, '')
        .replace(/;\s*export[\s\S]*$/, '')
        .replace(/export default[\s\S]*$/, ''),
    ) as {
      hydration: { stages: Record<string, { home_care_direction: string }> };
      pigmentation: { stages: Record<string, { home_care_direction: string }> };
      firmness: { stages: Record<string, { home_care_direction: string }> };
      oil: { stages: Record<string, { home_care_direction: string }> };
    };
    const directions = [analysis.hydration, analysis.pigmentation, analysis.firmness, analysis.oil]
      .flatMap((v) => Object.values(v.stages).map((s) => s.home_care_direction));
    const concerns = formatConcerns({
      client_first_name: 'Ada',
      skin_analysis: {
        hydration: { score: 42 },
        pigmentation: { score: 48 },
        firmness: { score: 62 },
        oil: { score: 54 },
      },
    });
    expect(concerns).toHaveLength(4);
    for (const c of concerns) {
      expect('customization' in c).toBe(false);
      for (const v of Object.values(c)) {
        expect(directions).not.toContain(v);
      }
    }
  });
});