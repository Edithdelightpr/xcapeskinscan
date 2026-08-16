import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useCartStore } from '@/store/cartStore';

const TOKEN = 'tok_report_1';
const SHARED_PRODUCT_ID = 'prod-shared';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: vi.fn() },
}));

vi.mock('@/hooks/useReportPayload', () => ({
  useReportPayload: () => ({
    state: 'ok',
    data: {
      merchant: { org_id: 'cdp-1', name: 'Douala Partner', kind: 'cdp', price_source: 'cdp' },
      merchant_contact: {
        order_contact_phone: '650000000',
        whatsapp_number: null,
        momo_provider: 'MTN MoMo',
        momo_recipient_number: '650000000',
        momo_recipient_name: null,
      },
      ordering_available: true,
      recommended_products: [
        { id: SHARED_PRODUCT_ID, name: 'XCAPE Face Cream', selling_price: 25000 },
      ],
      formulas: [],
    },
  }),
  logReportEvent: vi.fn(),
}));

import ReportCheckout from '@/pages/ReportCheckout';

const renderCheckout = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[`/report/${TOKEN}/order`]}>
        <Routes>
          <Route path="/report/:token/order" element={<ReportCheckout />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

/**
 * Opening the report checkout directly while an ordinary marketplace cart
 * exists must never spend that cart — even when the marketplace item happens
 * to be the same product the report recommends.
 */
describe('report checkout cart scope', () => {
  beforeEach(() => useCartStore.getState().clear());

  it('never reuses a marketplace item that shares a product id', async () => {
    useCartStore.getState().addItem({
      product_id: SHARED_PRODUCT_ID,
      name: 'XCAPE Face Cream',
      slug: null,
      image_url: null,
      unit_price: 9999, // marketplace NGN price — must never be charged here
    });
    expect(useCartStore.getState().report).toBeNull();

    renderCheckout();

    // The incompatible cart is dropped and this report's context established.
    await waitFor(() => {
      expect(useCartStore.getState().report?.token).toBe(TOKEN);
    });
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(useCartStore.getState().report?.merchant_org_id).toBe('cdp-1');
    expect(useCartStore.getState().report?.currency).toBe('XAF');

    expect(await screen.findByText(/Your order is empty/i)).toBeTruthy();
    expect(screen.queryByText(/XCAPE Face Cream/i)).toBeNull();
  });

  it('spends a cart that belongs to this report', async () => {
    useCartStore.getState().setReportContext({
      token: TOKEN,
      merchant_org_id: 'cdp-1',
      merchant_name: 'Douala Partner',
      currency: 'XAF',
    });
    useCartStore.getState().addItem({
      product_id: SHARED_PRODUCT_ID,
      name: 'XCAPE Face Cream',
      slug: null,
      image_url: null,
      unit_price: 25000,
    });

    renderCheckout();

    expect(await screen.findByText('XCAPE Face Cream')).toBeTruthy();
    expect(useCartStore.getState().items).toHaveLength(1);
  });
});
