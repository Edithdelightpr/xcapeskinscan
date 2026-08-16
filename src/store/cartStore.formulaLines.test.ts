import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore } from './cartStore';

const kit = (formula_snapshot_id: string | null) => ({
  product_id: 'kit-1',
  name: 'Delight Express Kit',
  slug: null,
  image_url: null,
  unit_price: 25000,
  formula_snapshot_id,
});

/**
 * A cart line is (product, formula snapshot) — a customized kit must never be
 * merged with, or removed by, the plain catalogue line of the same product.
 */
describe('composite cart line identity', () => {
  beforeEach(() => useCartStore.getState().clear());

  it('keeps a plain line and a formula line of the same product apart', () => {
    useCartStore.getState().addItem(kit(null));
    useCartStore.getState().addItem(kit('snap-a'));
    expect(useCartStore.getState().items).toHaveLength(2);
  });

  it('removes only the targeted formula line', () => {
    useCartStore.getState().addItem(kit(null));
    useCartStore.getState().addItem(kit('snap-a'));
    useCartStore.getState().removeItem('kit-1', 'snap-a');
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].formula_snapshot_id ?? null).toBeNull();
  });

  it('changes quantity on the targeted line only', () => {
    useCartStore.getState().addItem(kit(null));
    useCartStore.getState().addItem(kit('snap-a'));
    useCartStore.getState().setQty('kit-1', 4, 'snap-a');
    const byFormula = useCartStore.getState().items.find((i) => i.formula_snapshot_id === 'snap-a');
    const plain = useCartStore.getState().items.find((i) => !i.formula_snapshot_id);
    expect(byFormula?.quantity).toBe(4);
    expect(plain?.quantity).toBe(1);
  });

  it('merges a repeat add of the same formula line', () => {
    useCartStore.getState().addItem(kit('snap-a'));
    useCartStore.getState().addItem(kit('snap-a'), 2);
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].quantity).toBe(3);
  });
});
