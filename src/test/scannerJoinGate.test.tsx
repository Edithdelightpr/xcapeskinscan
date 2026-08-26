/**
 * Membership rule: the scanner runs for anyone, but the results are released
 * only to a signed-in XCAPE account.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import JoinToViewResults from '@/components/xcape/public/JoinToViewResults';

const page = readFileSync('src/pages/PublicSkinAnalysis.tsx', 'utf8');

describe('scanner join gate', () => {
  it('renders the report stage only for a signed-in account', () => {
    expect(page).toMatch(/stage === 'analyzed' && !user && !authLoading && <JoinToViewResults \/>/);
    expect(page).toMatch(/stage === 'analyzed' && user && \(\s*<PublicReportStage/);
  });

  it('offers join and sign-in routes that return to the scanner', () => {
    render(
      <MemoryRouter>
        <JoinToViewResults />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /join xcape to see my results/i })).toHaveAttribute(
      'href',
      '/auth?mode=signup&next=%2Fskin-analysis',
    );
    expect(screen.getByRole('link', { name: /already have an account/i })).toHaveAttribute(
      'href',
      '/auth?mode=signin&next=%2Fskin-analysis',
    );
  });

  it('opens the auth form in sign-up mode for join links', () => {
    const auth = readFileSync('src/pages/Auth.tsx', 'utf8');
    expect(auth).toMatch(/searchParams\.get\('mode'\) === 'signup' \? 'signup' : 'signin'/);
  });

  it('no longer promises that no account is needed', () => {
    const intro = readFileSync('src/components/xcape/public/PublicScanIntro.tsx', 'utf8');
    expect(intro).not.toMatch(/No account needed/i);
    expect(intro).not.toMatch(/No account is created/i);
  });
});
