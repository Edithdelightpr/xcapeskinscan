/**
 * /skin-analysis must stay a public route: registered in the router and never
 * wrapped in AuthGuard (direct navigation and refresh must work signed-out).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('src/App.tsx', 'utf8');

describe('public route registration', () => {
  it('registers /skin-analysis', () => {
    expect(app).toMatch(/path="\/skin-analysis"/);
  });

  it('does not wrap /skin-analysis in AuthGuard or MedSpaGuard', () => {
    const line = app
      .split('\n')
      .find((l) => l.includes('path="/skin-analysis"')) as string;
    expect(line).toBeTruthy();
    expect(line).not.toMatch(/AuthGuard|MedSpaGuard/);
  });
});
