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
});