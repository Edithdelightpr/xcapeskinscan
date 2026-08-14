import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  product_id: string;
  name: string;
  slug: string | null;
  image_url: string | null;
  unit_price: number;
  quantity: number;
  /** Set when this line is a practitioner-approved customized formula kit —
   *  the order RPC verifies and snapshots it server-side. */
  formula_snapshot_id?: string | null;
  formula_label?: string | null;
}

export interface CartAttribution {
  referral_staff_id: string | null;
  outreach_id: string | null;
  attributed_staff_id: string | null;
  utm: Record<string, string> | null;
  /** Secure report share token the cart was built from. Carries the
   *  originating operator/organisation onto an otherwise anonymous order. */
  report_token: string | null;
}

interface CartState {
  items: CartItem[];
  attribution: CartAttribution;
  addItem: (item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  removeItem: (product_id: string) => void;
  setQty: (product_id: string, qty: number) => void;
  clear: () => void;
  setAttribution: (a: Partial<CartAttribution>) => void;
  count: () => number;
  total: () => number;
}

const emptyAttribution: CartAttribution = {
  referral_staff_id: null,
  outreach_id: null,
  attributed_staff_id: null,
  utm: null,
  report_token: null,
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      attribution: emptyAttribution,
      addItem: (item, qty = 1) =>
        set((s) => {
          // Formula lines are distinct from plain catalogue lines of the same
          // product — a customized kit must not merge with an uncustomized one.
          const sameLine = (i: CartItem) =>
            i.product_id === item.product_id &&
            (i.formula_snapshot_id ?? null) === (item.formula_snapshot_id ?? null);
          const existing = s.items.find(sameLine);
          if (existing) {
            return {
              items: s.items.map((i) =>
                sameLine(i) ? { ...i, quantity: i.quantity + qty } : i,
              ),
            };
          }
          return { items: [...s.items, { ...item, quantity: qty }] };
        }),
      removeItem: (product_id) =>
        set((s) => ({ items: s.items.filter((i) => i.product_id !== product_id) })),
      setQty: (product_id, qty) =>
        set((s) => ({
          items: s.items
            .map((i) => (i.product_id === product_id ? { ...i, quantity: Math.max(0, qty) } : i))
            .filter((i) => i.quantity > 0),
        })),
      clear: () => set({ items: [], attribution: emptyAttribution }),
      setAttribution: (a) =>
        set((s) => ({ attribution: { ...s.attribution, ...a } })),
      count: () => get().items.reduce((n, i) => n + i.quantity, 0),
      total: () => get().items.reduce((n, i) => n + i.quantity * i.unit_price, 0),
    }),
    { name: 'tropics-cart-v1' },
  ),
);