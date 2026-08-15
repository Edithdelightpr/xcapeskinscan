import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PublicScanIntro from '@/components/xcape/public/PublicScanIntro';

const setup = (starting = false, error: string | null = null) => {
  const onStart = vi.fn();
  render(<PublicScanIntro starting={starting} error={error} onStart={onStart} />);
  return { onStart, user: userEvent.setup() };
};

describe('PublicScanIntro progressive consent', () => {
  it('does not start immediately when choosing the camera', async () => {
    const { onStart, user } = setup();
    await user.click(screen.getByRole('button', { name: /start analysis here/i }));
    expect(onStart).not.toHaveBeenCalled();
    expect(await screen.findByText('Before we begin')).toBeInTheDocument();
  });

  it('keeps continue disabled until consent is checked, then dispatches camera', async () => {
    const { onStart, user } = setup();
    await user.click(screen.getByRole('button', { name: /start analysis here/i }));
    const cont = await screen.findByRole('button', { name: /agree and continue/i });
    expect(cont).toBeDisabled();
    await user.click(screen.getByRole('checkbox'));
    expect(cont).toBeEnabled();
    await user.click(cont);
    expect(onStart).toHaveBeenCalledWith('camera');
  });

  it('dispatches the upload method after consent', async () => {
    const { onStart, user } = setup();
    await user.click(screen.getByRole('button', { name: /upload photos instead/i }));
    await user.click(await screen.findByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /agree and continue/i }));
    expect(onStart).toHaveBeenCalledWith('upload');
  });

  it('resets the checkbox and pending method when closed with Escape', async () => {
    const { onStart, user } = setup();
    await user.click(screen.getByRole('button', { name: /start analysis here/i }));
    await user.click(await screen.findByRole('checkbox'));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByText('Before we begin')).not.toBeInTheDocument());
    expect(onStart).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /upload photos instead/i }));
    expect(await screen.findByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('button', { name: /agree and continue/i })).toBeDisabled();
  });

  it('shows the error near the primary action and no upfront consent checkbox', () => {
    setup(false, 'Camera unavailable');
    expect(screen.getByRole('alert')).toHaveTextContent('Camera unavailable');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
