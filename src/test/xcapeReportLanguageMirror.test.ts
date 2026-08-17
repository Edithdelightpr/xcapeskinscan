/**
 * The edge copy of the report-language layer must stay byte-identical inside
 * the MIRROR REGION markers, otherwise the PDF and the live report can drift
 * apart in client-facing wording.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const START = '// ---- MIRROR REGION START';
const END = '// ---- MIRROR REGION END';

const region = (path: string) => {
  const src = readFileSync(path, 'utf8');
  const a = src.indexOf(START);
  const b = src.indexOf(END);
  expect(a, `${path} missing MIRROR REGION START`).toBeGreaterThan(-1);
  expect(b, `${path} missing MIRROR REGION END`).toBeGreaterThan(a);
  return src.slice(src.indexOf('\n', a) + 1, b);
};

describe('xcapeReportLanguage mirror', () => {
  it('is byte-identical between the app and the edge copy', () => {
    const app = region('src/lib/xcapeReportLanguage.ts');
    const edge = region('supabase/functions/_shared/xcapeReportLanguage.ts');
    expect(edge).toBe(app);
    expect(app.length).toBeGreaterThan(500);
  });
});
