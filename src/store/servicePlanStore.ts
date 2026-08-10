import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { sanitizeServiceSelection, isAddonRole, eligibleCoreIdsFor, type AddonLinkLite } from '@/lib/serviceMenu';

/**
 * Treatment-plan calculator store.
 *
 * Mirrors the shape of `useCartStore` but for SERVICES (not products) and is
 * persisted to `sessionStorage` only — so a plan does not silently survive a
 * browser restart. The store is intentionally separate from the product cart
 * and is consumed by `CategoryDetailModal` (build the plan) and
 * `PublicBookingWizard` (submit the plan as `service_ids[]`).
 *
 * Hard cap of 6 items matches the backend `public-create-booking` validation.
 */

export const MAX_PLAN_ITEMS = 6;

export interface ServicePlanItem {
  service_id: string;
  name: string;
  unit_price: number;
  duration_minutes: number | null;
  quantity: number;
  /** 'core' | 'addon' | 'bundle' — boosters may never stand alone. */
  menu_role?: string | null;
}

interface ServicePlanState {
  items: ServicePlanItem[];
  /** Eligibility map for boosters, injected by whichever surface loads it. */
  addonLinks: AddonLinkLite[];
  setAddonLinks: (links: AddonLinkLite[]) => void;
  addItem: (item: Omit<ServicePlanItem, 'quantity'>, qty?: number) => { ok: boolean; reason?: string };
  removeItem: (service_id: string) => void;
  setQty: (service_id: string, qty: number) => void;
  clear: () => void;
  has: (service_id: string) => boolean;
  count: () => number;
  total: () => number;
  totalDuration: () => number;
  /** Flattened id list, repeating each id by its quantity, capped at MAX_PLAN_ITEMS. */
  expandedIds: () => string[];
}

export const useServicePlanStore = create<ServicePlanState>()(
  persist(
    (set, get) => ({
      items: [],
      addonLinks: [],
      setAddonLinks: (links) =>
        set((s) => {
          const roleOf = (id: string) => s.items.find((i) => i.service_id === id)?.menu_role ?? null;
          const keep = new Set(
            sanitizeServiceSelection(s.items.map((i) => i.service_id), links, roleOf).ids,
          );
          return { addonLinks: links, items: s.items.filter((i) => keep.has(i.service_id)) };
        }),
      addItem: (item, qty = 1) => {
        const state = get();
        const currentCount = state.items.reduce((n, i) => n + i.quantity, 0);
        if (currentCount + qty > MAX_PLAN_ITEMS) {
          return { ok: false, reason: `You can select up to ${MAX_PLAN_ITEMS} procedures per plan.` };
        }
        if (isAddonRole(item.menu_role)) {
          const cores = eligibleCoreIdsFor(item.service_id, state.addonLinks);
          const hasCore = state.items.some((i) => cores.includes(i.service_id));
          if (!hasCore) {
            return { ok: false, reason: 'This booster must be added to an eligible infusion first.' };
          }
        }
        set((s) => {
          const existing = s.items.find((i) => i.service_id === item.service_id);
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.service_id === item.service_id ? { ...i, quantity: i.quantity + qty } : i,
              ),
            };
          }
          return { items: [...s.items, { ...item, quantity: qty }] };
        });
        return { ok: true };
      },
      removeItem: (service_id) =>
        set((s) => {
          const rest = s.items.filter((i) => i.service_id !== service_id);
          const roleOf = (id: string) => rest.find((i) => i.service_id === id)?.menu_role ?? null;
          const keep = new Set(
            sanitizeServiceSelection(rest.map((i) => i.service_id), s.addonLinks, roleOf).ids,
          );
          return { items: rest.filter((i) => keep.has(i.service_id)) };
        }),
      setQty: (service_id, qty) =>
        set((s) => {
          const others = s.items.filter((i) => i.service_id !== service_id);
          const otherCount = others.reduce((n, i) => n + i.quantity, 0);
          const capped = Math.max(0, Math.min(qty, MAX_PLAN_ITEMS - otherCount));
          const next = s.items
            .map((i) => (i.service_id === service_id ? { ...i, quantity: capped } : i))
            .filter((i) => i.quantity > 0);
          const roleOf = (id: string) => next.find((i) => i.service_id === id)?.menu_role ?? null;
          const keep = new Set(
            sanitizeServiceSelection(next.map((i) => i.service_id), s.addonLinks, roleOf).ids,
          );
          return { items: next.filter((i) => keep.has(i.service_id)) };
        }),
      clear: () => set({ items: [] }),
      has: (service_id) => get().items.some((i) => i.service_id === service_id),
      count: () => get().items.reduce((n, i) => n + i.quantity, 0),
      total: () => get().items.reduce((n, i) => n + i.quantity * i.unit_price, 0),
      totalDuration: () =>
        get().items.reduce((n, i) => n + i.quantity * (i.duration_minutes ?? 0), 0),
      expandedIds: () => {
        const out: string[] = [];
        for (const i of get().items) {
          for (let k = 0; k < i.quantity; k++) out.push(i.service_id);
        }
        return out.slice(0, MAX_PLAN_ITEMS);
      },
    }),
    {
      name: 'tropics-plan-v1',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.sessionStorage : (undefined as unknown as Storage),
      ),
      partialize: (s) => ({ items: s.items }),
    },
  ),
);