// Formula → report/cart plumbing for the practitioner-approved XCAPE
// customization snapshots. Pure functions, no I/O — unit-tested.
//
// Contract:
//  - A formula belongs to exactly one engine category (pigmentation,
//    hydration, firmness, oil). The report renders it inside that concern's
//    CUSTOMIZATION position — never as a separate duplicate section.
//  - The ONLY purchasable line a formula produces is the kit itself. The
//    customized base, active solution and companion are prepared by XCAPE
//    inside the kit; their product ids never leave the snapshot, so the
//    client can never add them to the cart separately.
import type { ReportFormula } from '@/hooks/useReportPayload';
import type { CartItem } from '@/store/cartStore';

/**
 * Index approved formulas by engine category so each concern card can find
 * its matching kit formula. First formula per category wins — duplicate
 * approvals for the same category should not stack cards.
 */
export function formulasByCategory(
  formulas: ReportFormula[] | null | undefined,
): Map<string, ReportFormula> {
  const map = new Map<string, ReportFormula>();
  for (const f of formulas ?? []) {
    if (!f || typeof f.category !== 'string' || !f.category) continue;
    if (!map.has(f.category)) map.set(f.category, f);
  }
  return map;
}

/** Human-readable one-line summary of the exact formula (cart line label). */
export function formulaLabel(formula: ReportFormula): string {
  return [
    formula.base_product_name ? `Customize: ${formula.base_product_name}` : null,
    formula.active_name && formula.dose_ml != null
      ? `${formula.active_name} ${formula.dose_ml} ml`
      : null,
    formula.companion_name && formula.companion_dose_ml != null
      ? `+ ${formula.companion_name} ${formula.companion_dose_ml} ml`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Build the single cart line for a formula: the kit product only, carrying
 * the immutable snapshot id so the order RPC can verify it server-side.
 * Returns null when the kit is not purchasable (no real catalogue product
 * or price yet) — approval/purchase stay blocked in that state.
 *
 * Base/active/companion product ids are intentionally NOT part of the
 * returned line and must never be added as separate cart items.
 */
export function buildFormulaCartItem(
  formula: ReportFormula,
): Omit<CartItem, 'quantity'> | null {
  if (formula.kit_product_id == null || formula.kit_unit_price == null) return null;
  return {
    product_id: formula.kit_product_id,
    name: formula.kit_name ?? 'Customized kit',
    slug: formula.kit_public_slug ?? null,
    image_url: formula.kit_image_url ?? null,
    unit_price: formula.kit_unit_price,
    formula_snapshot_id: formula.id,
    formula_label: formulaLabel(formula) || null,
  };
}
