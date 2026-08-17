/**
 * No em dash (U+2014) may appear in client-visible report copy. Comments and
 * admin-only implementation notes are exempt, so the guard strips comments
 * before checking.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { formatMoney } from '@/lib/xcapeRetail';

const FILES = [
  'src/components/report/ConcernCard.tsx',
  'src/components/report/CustomizationFormulaCard.tsx',
  'src/components/report/RecommendedProducts.tsx',
  'src/components/report/PersonalReportView.tsx',
  'src/components/report/PriorityFindings.tsx',
  'src/components/report/NextStepCard.tsx',
  'src/components/report/PaymentActionCard.tsx',
  'src/components/report/EngineOverviewCard.tsx',
  'src/components/report/YourCareJourney.tsx',
  'src/components/report/YourTreatmentPlan.tsx',
  'src/components/report/AskOnWhatsAppBlock.tsx',
  'src/components/xcape/public/PublicReportStage.tsx',
  'src/components/xcape/public/PublicScoreMeters.tsx',
  'src/components/xcape/public/PublicConcernBreakdown.tsx',
  'src/lib/xcapeReportLanguage.ts',
  'supabase/functions/_shared/xcapeReportLanguage.ts',
];

const stripComments = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => (/^\s*(\/\/|\*)/.test(line) ? '' : line))
    .join('\n');

describe('report copy has no em dash', () => {
  it.each(FILES)('%s', (path) => {
    const code = stripComments(readFileSync(path, 'utf8'));
    const offending = code
      .split('\n')
      .filter((l) => l.includes('\u2014'));
    expect(offending, `em dash in ${path}`).toEqual([]);
  });

  it('the default price placeholder has no em dash', () => {
    expect(formatMoney(null)).toBe('Not available');
  });
});
