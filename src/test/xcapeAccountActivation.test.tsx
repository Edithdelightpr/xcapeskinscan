/**
 * Self-serve XCAPE account activation.
 *
 * An Affiliate who signs up directly must become usable immediately — one tap,
 * no staff provisioning and no admin approval. A CDP application keeps the
 * existing review step.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const rpc = vi.fn(async () => ({ data: { claimed: true }, error: null }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...(args as [])) },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const { default: XcapeAccountActivation } = await import(
  '@/components/auth/XcapeAccountActivation'
);

beforeEach(() => rpc.mockClear());

describe('XcapeAccountActivation', () => {
  it('activates an Affiliate account instantly and refreshes access', async () => {
    const onClaimed = vi.fn();
    render(<XcapeAccountActivation onClaimed={onClaimed} onSignOut={() => {}} />);

    fireEvent.click(screen.getByText('XCAPE Affiliate'));

    await waitFor(() => expect(onClaimed).toHaveBeenCalled());
    expect(rpc).toHaveBeenCalledWith('claim_xcape_account_role', {
      _role: 'affiliate',
      _org_name: '',
    });
  });

  it('uses partner language, never employee/staff wording', () => {
    render(<XcapeAccountActivation onClaimed={() => {}} onSignOut={() => {}} />);
    const body = document.body.textContent ?? '';
    expect(body).toContain('XCAPE Affiliate');
    expect(body).not.toMatch(/employee/i);
  });

  it('registers a CDP location for review with its name', async () => {
    const onClaimed = vi.fn();
    render(<XcapeAccountActivation onClaimed={onClaimed} onSignOut={() => {}} />);

    fireEvent.click(screen.getByText('Certified Distribution Partner'));
    fireEvent.change(screen.getByPlaceholderText('e.g. XCAPE Lekki'), {
      target: { value: 'XCAPE Lekki' },
    });
    fireEvent.click(screen.getByText('Submit for review'));

    await waitFor(() => expect(onClaimed).toHaveBeenCalled());
    expect(rpc).toHaveBeenCalledWith('claim_xcape_account_role', {
      _role: 'cdp',
      _org_name: 'XCAPE Lekki',
    });
  });
});
