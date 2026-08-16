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

/**
 * Trusted commercial context for a cart built from ONE secure report link.
 * A report cart is scoped to exactly one token / merchant / currency —
 * marketplace items and items from another report can never share it.
 */
export interface CartReportContext {
  token: string;
  merchant_org_id: string | null;
  merchant_name: string;
  currency: 'XAF';
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
  /** Non-null only while the cart belongs to a report. */
  report: CartReportContext | null;
  addItem: (item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  /** Targets the composite line (product + formula snapshot), never every
   *  line that happens to share a product id. */
  removeItem: (product_id: string, formula_snapshot_id?: string | null) => void;
  setQty: (product_id: string, qty: number, formula_snapshot_id?: string | null) => void;

  clear: () => void;
  setAttribution: (a: Partial<CartAttribution>) => void;
  /** Enters (or switches to) a report cart, clearing incompatible items. */
  setReportContext: (ctx: CartReportContext) => void;
  /** Leaves report mode — used by the ordinary marketplace cart. */
  clearReportContext: () => void;
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
      report: null,
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
      removeItem: (product_id, formula_snapshot_id = null) =>
        set((s) => ({
          items: s.items.filter((i) => !isLine(i, product_id, formula_snapshot_id)),
        })),
      setQty: (product_id, qty, formula_snapshot_id = null) =>
        set((s) => ({
          items: s.items
            .map((i) =>
              isLine(i, product_id, formula_snapshot_id) ? { ...i, quantity: Math.max(0, qty) } : i,
            )
            .filter((i) => i.quantity > 0),
        })),

      clear: () => set({ items: [], attribution: emptyAttribution, report: null }),
      setReportContext: (ctx) =>
        set((s) => {
          const same = s.report?.token === ctx.token;
          return {
            report: ctx,
            // Switching report (or arriving from the marketplace) drops every
            // item that does not belong to this report's merchant/currency.
            items: same ? s.items : [],
            attribution: same
              ? { ...s.attribution, report_token: ctx.token }
              : { ...emptyAttribution, report_token: ctx.token },
          };
        }),
      clearReportContext: () =>
        set((s) => ({
          report: null,
          items: s.report ? [] : s.items,
          attribution: { ...s.attribution, report_token: null },
        })),
      setAttribution: (a) =>
        set((s) => ({ attribution: { ...s.attribution, ...a } })),
      count: () => get().items.reduce((n, i) => n + i.quantity, 0),
      total: () => get().items.reduce((n, i) => n + i.quantity * i.unit_price, 0),
    }),
    { name: 'tropics-cart-v2' },
  ),
);