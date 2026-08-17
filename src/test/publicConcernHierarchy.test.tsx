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
import { commBandLabel, isActiveConcern } from '@/lib/xcapeReportLanguage';
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
    band: isActive ? 'low' : 'strong',
    bandLabel: commBandLabel(score),
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

  it('renders Visible observation after XCAPE response for an active concern', () => {
    const { container } = render(
      <PublicConcernBreakdown
        concerns={[concern('pigmentation_stability', true, 30)]}
        report={
          {
            variables: {
              pigmentation_stability: { note: 'observed surface pattern' },
            },
          } as never
        }
      />,
    );
    const text = container.textContent ?? '';
    const responseIdx = text.indexOf('response pigmentation_stability');
    const obsIdx = text.indexOf('Visible observation');
    expect(responseIdx).toBeGreaterThan(-1);
    if (obsIdx > -1) expect(obsIdx).toBeGreaterThan(responseIdx);
    // order of controlled fields is canonical
    expect(text.indexOf('detected pigmentation_stability')).toBeLessThan(
      text.indexOf('why pigmentation_stability'),
    );
    expect(text.indexOf('risk pigmentation_stability')).toBeLessThan(responseIdx);
  });
});

describe('score status contract on the public surface', () => {
  it('renders an 89 concern expanded and a 90 concern collapsed', () => {
    render(
      <PublicConcernBreakdown
        concerns={[
          concern('pigmentation_stability', isActiveConcern(89), 89),
          concern('firmness_skin_support', isActiveConcern(90), 90),
        ]}
        report={null}
      />,
    );
    expect(screen.getByText('detected pigmentation_stability')).toBeInTheDocument();
    expect(screen.queryByText('detected firmness_skin_support')).toBeNull();
    expect(screen.getByText('Maintenance concern')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });
});

describe('secure report protocol copy', () => {
  it('states pending practitioner confirmation and not purchasable', () => {
    const src = readFileSync('src/components/report/PersonalReportView.tsx', 'utf8');
    expect(src).toContain(
      'Pending practitioner confirmation. This protocol is not yet purchasable.',
    );
    expect(src).not.toMatch(/footnote="[^"]*\u2014/);
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
