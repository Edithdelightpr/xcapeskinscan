/**
 * Public "immediate result" hierarchy contract:
 *  - every ACTIVE concern is open by default,
 *  - an all-stable reading starts fully collapsed,
 *  - the stored `combinedInterpretation` narrative is never rendered,
 *  - the deterministic protocol block says it is pending practitioner
 *    confirmation and not purchasable.
 */
import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import PublicConcernBreakdown from '@/components/xcape/public/PublicConcernBreakdown';
import type { FormattedConcern } from '@/lib/reportConcernFormatter';

const concern = (
  key: string,
  isActive: boolean,
  score: number,
): FormattedConcern =>
  ({
    key,
    clinicalName: `Concern ${key}`,
    plainDescription: `plain ${key}`,
    score,
    scoreLabel: `${score}/100`,
    band: isActive ? 'low' : 'good',
    bandLabel: isActive ? 'Needs support' : 'Stable',
    commBand: isActive ? 'priority' : 'stable',
    isActive,
    stageName: '',
    detected: `detected ${key}`,
    whyItMatters: `why ${key}`,
    ifLeftUnsupported: `risk ${key}`,
    xcapeResponse: `response ${key}`,
    reassurance: '',
    analysis: '',
    impact: '',
    callToAction: '',
    treatmentDirection: '',
    anchorId: `anchor-${key}`,
  }) as unknown as FormattedConcern;

describe('PublicConcernBreakdown hierarchy', () => {
  it('opens every active concern by default', () => {
    render(
      <PublicConcernBreakdown
        concerns={[
          concern('pigmentation_stability', true, 30),
          concern('barrier_surface_hydration', true, 44),
          concern('firmness_skin_support', false, 82),
        ]}
        report={null}
      />,
    );
    expect(screen.getByText('detected pigmentation_stability')).toBeInTheDocument();
    expect(screen.getByText('detected barrier_surface_hydration')).toBeInTheDocument();
    expect(screen.queryByText('detected firmness_skin_support')).toBeNull();
  });

  it('starts fully collapsed when every finding is stable', () => {
    render(
      <PublicConcernBreakdown
        concerns={[
          concern('pigmentation_stability', false, 88),
          concern('firmness_skin_support', false, 90),
        ]}
        report={null}
      />,
    );
    expect(screen.queryByText('detected pigmentation_stability')).toBeNull();
    expect(screen.queryByText('detected firmness_skin_support')).toBeNull();
  });
});

describe('public report stage contract', () => {
  const src = readFileSync('src/components/xcape/public/PublicReportStage.tsx', 'utf8');

  it('never renders the stored combinedInterpretation', () => {
    expect(src).not.toMatch(/\{\s*[\w.?]*combinedInterpretation/);
  });

  it('marks the protocol pending practitioner confirmation and not purchasable', () => {
    expect(src).toContain('Pending practitioner confirmation.');
    expect(src).toContain('This protocol is not yet purchasable.');
  });
});
