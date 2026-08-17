/**
 * Component-level proof that the admin mockup preview cannot purchase or
 * emit events: in mock mode the CTA is visibly disabled, clicking it adds
 * nothing to the cart and logs no report event — even with a mock price
 * entered — while the same card in live mode still adds the kit line.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CustomizationFormulaCard from './CustomizationFormulaCard';
import { useCartStore } from '@/store/cartStore';
import { logReportEvent } from '@/hooks/useReportPayload';
import { DEFAULT_MOCKUP_CONFIG, mockupToFormula, withCataloguePreview } from '@/lib/xcapeRules/mockup';
import type { ReportFormula } from '@/hooks/useReportPayload';

vi.mock('@/hooks/useReportPayload', () => ({ logReportEvent: vi.fn() }));

const liveFormula = (over: Partial<ReportFormula> = {}): ReportFormula => ({
  id: 'snap-1',
  category: 'pigmentation_stability',
  score: 48,
  kit_product_id: 'kit-1',
  kit_name: 'Delight Express Kit',
  kit_unit_price: 85000,
  kit_image_url: null,
  kit_public_slug: null,
  kit_short_description: null,
  base_product_name: 'XCAPE Base Serum',
  active_name: 'Melanin Control Active',
  dose_ml: 1.5,
  companion_name: 'Anti-Inflammatory Companion',
  companion_dose_ml: 1.5,
  instructions: null,
  warnings: [],
  rule_version: 1,
  approved_at: '2026-01-01T00:00:00Z',
  is_demo: false,
  ...over,
});

describe('CustomizationFormulaCard mock mode', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [] });
    vi.clearAllMocks();
  });

  it('renders the CTA visibly disabled with a not-purchasable notice', () => {
    render(
      <CustomizationFormulaCard
        token="mockup"
        formula={mockupToFormula({ ...DEFAULT_MOCKUP_CONFIG })}
        compact
        mock
        ctaLabel="Add customized kit to cart"
      />,
    );
    const button = screen.getByRole('button', { name: /add customized kit to cart/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Mockup only, not purchasable');
    expect(screen.getByText('Mockup only, not purchasable')).toBeInTheDocument();
  });

  it('clicking the mock CTA never calls cart addItem and logs no event', () => {
    render(
      <CustomizationFormulaCard
        token="mockup"
        formula={mockupToFormula({ ...DEFAULT_MOCKUP_CONFIG, display_price: 250000 })}
        compact
        mock
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /add customized kit to cart/i }));
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(logReportEvent).not.toHaveBeenCalled();
  });

  it('a real catalogue item selected for preview still cannot be purchased', () => {
    const formula = withCataloguePreview(mockupToFormula({ ...DEFAULT_MOCKUP_CONFIG }), {
      id: 'real-product-id',
      name: 'Delight Express Kit',
      selling_price: 120000,
    });
    render(<CustomizationFormulaCard token="mockup" formula={formula} compact mock />);
    const button = screen.getByRole('button', { name: /add customized kit to cart/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(logReportEvent).not.toHaveBeenCalled();
  });

  it('shows the companion line only for aggressive mock configs', () => {
    const { rerender } = render(
      <CustomizationFormulaCard
        token="mockup"
        formula={mockupToFormula({ ...DEFAULT_MOCKUP_CONFIG, aggressiveness: 'aggressive' })}
        compact
        mock
      />,
    );
    expect(screen.getByText(/Required companion:/)).toBeInTheDocument();
    rerender(
      <CustomizationFormulaCard
        token="mockup"
        formula={mockupToFormula({ ...DEFAULT_MOCKUP_CONFIG, aggressiveness: 'mild' })}
        compact
        mock
      />,
    );
    expect(screen.queryByText(/Required companion:/)).not.toBeInTheDocument();
  });

  it('live mode still adds exactly one kit line with the snapshot attached', () => {
    render(<CustomizationFormulaCard token="report-token" formula={liveFormula()} compact />);
    fireEvent.click(screen.getByRole('button', { name: /add customized kit to cart/i }));
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].product_id).toBe('kit-1');
    expect(items[0].formula_snapshot_id).toBe('snap-1');
    expect(logReportEvent).toHaveBeenCalledWith(
      'report-token',
      'formula_interest',
      expect.objectContaining({ formula_snapshot_id: 'snap-1' }),
    );
  });
});
