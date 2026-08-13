import { AlertTriangle, Check, FlaskConical, Image as ImageIcon, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { formatNaira } from '@/lib/serviceDiscount';
import { CUSTOMIZATION_CATEGORIES } from '@/lib/xcapeRules/customization';
import { buildFormulaCartItem } from '@/lib/reportFormulas';
import { logReportEvent, type ReportFormula } from '@/hooks/useReportPayload';
import { useCartStore } from '@/store/cartStore';

interface Props {
  token: string;
  formula: ReportFormula;
  /** Compact layout for rendering inline inside a concern card's
   *  CUSTOMIZATION position (no standalone card chrome). */
  compact?: boolean;
  /** Admin mockup preview mode: renders the card exactly as it would appear
   *  in a report, but add-to-cart and event logging are hard-disabled —
   *  regardless of any price or product-like values entered in the mockup.
   *  The CTA renders visibly disabled with a "not purchasable" notice. */
  mock?: boolean;
  /** Optional CTA label override (used by the admin mockup preview). */
  ctaLabel?: string;
}

/**
 * Client-facing XCAPE customized formula — renders the practitioner-approved
 * immutable snapshot: the kit to buy, which product inside it is customized,
 * the active solution and exact dose, the required companion, and usage
 * guidance. The client never constructs or guesses anything; only the kit
 * product is purchasable and the cart line carries the snapshot id so staff
 * fulfilment sees the same formula. Base/active/companion components are
 * prepared by XCAPE within the kit and are never sold separately here.
 */
const CustomizationFormulaCard = ({ token, formula, compact = false, mock = false, ctaLabel }: Props) => {
  const cartItems = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);

  const categoryLabel =
    CUSTOMIZATION_CATEGORIES.find((c) => c.key === formula.category)?.label ?? formula.category;

  // Mock mode never builds a cart line — the formula preview is display-only.
  const cartItem = mock ? null : buildFormulaCartItem(formula);
  const purchasable = cartItem != null;
  const inCart =
    purchasable &&
    cartItems.some(
      (i) => i.product_id === formula.kit_product_id && i.formula_snapshot_id === formula.id,
    );

  const onAdd = () => {
    if (mock || !cartItem) return;
    addItem(cartItem, 1);
    logReportEvent(token, 'formula_interest', {
      formula_snapshot_id: formula.id,
      kit_product_id: formula.kit_product_id,
    });
    toast.success(`${formula.kit_name ?? 'Kit'} added to your care plan`, {
      description: `Your customized formula travels with the order · ${formatNaira(formula.kit_unit_price!)}`,
    });
  };

  const protocolLines = formula.formula_lines ?? [];

  const formulaLines = (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-bronze font-semibold">
        Your exact formula
      </div>
      {/* Multi-product protocol lines, exactly as snapshotted at approval. */}
      {(['face', 'body'] as const).map((area) => {
        const group = protocolLines.filter((l) => l.area === area);
        if (group.length === 0) return null;
        return (
          <div key={area} className="space-y-0.5">
            <p className="text-[11px] uppercase tracking-[0.14em] text-cocoa/55">
              {area === 'face' ? 'Face' : 'Body — always alongside face'}
            </p>
            {group.map((l, i) => (
              <p key={i} className="text-[12.5px] text-cocoa">
                <span className="font-medium">{l.product_name}</span> + {l.ds_name}
                <span className="font-semibold"> — {l.dose_ml} ml</span>
                {l.companion && <span className="text-cocoa/60"> (required companion)</span>}
              </p>
            ))}
          </div>
        );
      })}
      {formula.base_product_name && (
        <p className="text-[12.5px] text-cocoa">
          Customized product: <span className="font-medium">{formula.base_product_name}</span>
        </p>
      )}
      {formula.active_name && (
        <p className="text-[12.5px] text-cocoa">
          Active solution: <span className="font-medium">{formula.active_name}</span>
          {formula.dose_ml != null && (
            <span className="font-semibold"> — {formula.dose_ml} ml</span>
          )}
        </p>
      )}
      {formula.companion_name && (
        <p className="text-[12.5px] text-cocoa">
          Required companion: <span className="font-medium">{formula.companion_name}</span>
          {formula.companion_dose_ml != null && (
            <span className="font-semibold"> — {formula.companion_dose_ml} ml</span>
          )}
        </p>
      )}
    </div>
  );

  const guidance = (
    <>
      {formula.instructions && (
        <p className="text-[12.5px] text-cocoa/75 leading-relaxed">{formula.instructions}</p>
      )}
      {(formula.warnings?.length ?? 0) > 0 && (
        <div className="space-y-1">
          {formula.warnings.map((w, i) => (
            <p key={i} className="text-[11.5px] text-bronze flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={1.9} /> {w}
            </p>
          ))}
        </div>
      )}
    </>
  );

  const purchaseRow = (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <p className="text-[11px] text-cocoa/55 max-w-md leading-relaxed">
        XCAPE prepares the customized base, active and companion inside this one kit, exactly
        to your practitioner's specification — nothing to buy, measure or mix separately.
      </p>
      {mock ? (
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            disabled
            title="Mockup only — not purchasable"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-medium bg-cocoa/30 text-white/70 cursor-not-allowed"
          >
            <ShoppingBag className="w-3.5 h-3.5" strokeWidth={1.8} />{' '}
            {ctaLabel ?? 'Add customized kit to cart'}
          </button>
          <span className="text-[10px] uppercase tracking-[0.14em] text-bronze font-medium">
            Mockup only — not purchasable
          </span>
        </div>
      ) : purchasable ? (
        <button
          type="button"
          onClick={onAdd}
          disabled={inCart}
          className={
            'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-medium transition ' +
            (inCart
              ? 'bg-bronze/15 text-bronze cursor-default'
              : 'bg-cocoa text-white hover:bg-cocoa/90')
          }
        >
          {inCart ? (
            <>
              <Check className="w-3.5 h-3.5" strokeWidth={2} /> In your plan
            </>
          ) : (
            <>
              <ShoppingBag className="w-3.5 h-3.5" strokeWidth={1.8} /> Add customized kit to cart
            </>
          )}
        </button>
      ) : null}
    </div>
  );

  const header = (
    <div className="flex items-start gap-3">
      {formula.kit_image_url ? (
        <img
          src={formula.kit_image_url}
          alt={formula.kit_name ?? 'Customized XCAPE kit'}
          loading="lazy"
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border border-bronze/15 shrink-0"
        />
      ) : mock ? (
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border border-dashed border-bronze/30 bg-cream-warm/60 flex flex-col items-center justify-center gap-1 shrink-0">
          <ImageIcon className="w-4 h-4 text-bronze/60" strokeWidth={1.8} />
          <span className="text-[8px] uppercase tracking-wider text-bronze/60">No image</span>
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-3 flex-wrap flex-1 min-w-0">
        <div className="space-y-1 min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-bronze font-medium flex-wrap">
            <FlaskConical className="w-3.5 h-3.5" strokeWidth={1.9} />
            Customized for your {categoryLabel.toLowerCase()}
            {formula.score != null && <span className="text-cocoa/50">· score {formula.score}/100</span>}
            {formula.is_demo && (
              <span className="rounded-full border border-bronze/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wider">
                Demo
              </span>
            )}
          </div>
          <h3 className="font-display text-[16px] sm:text-[18px] text-cocoa leading-snug">
            {formula.kit_name ?? 'Your customized kit'}
          </h3>
          {formula.kit_short_description && (
            <p className="text-[12px] text-cocoa/65 leading-relaxed">
              {formula.kit_short_description}
            </p>
          )}
        </div>
        {formula.kit_unit_price != null && formula.kit_unit_price > 0 && (
          <span className="text-[15px] text-cocoa font-semibold tabular-nums shrink-0">
            {formatNaira(formula.kit_unit_price)}
          </span>
        )}
      </div>
    </div>
  );

  // Compact: nested inside a concern card — quieter chrome, tighter spacing.
  if (compact) {
    return (
      <div className="rounded-2xl border border-bronze/20 bg-cream-warm/50 p-4 space-y-3">
        {header}
        {formulaLines}
        {guidance}
        {purchaseRow}
      </div>
    );
  }

  return (
    <article className="rounded-3xl border border-bronze/20 bg-white/85 backdrop-blur p-5 sm:p-6 shadow-[0_1px_0_hsl(28_30%_60%_/_0.06)] hover:shadow-[0_16px_36px_-24px_hsl(22_38%_18%_/_0.3)] transition-shadow">
      <div className="space-y-4">
        {header}
        <div className="rounded-2xl bg-cream-warm/70 border border-bronze/10 p-4">
          {formulaLines}
        </div>
        {guidance}
        {purchaseRow}
      </div>
    </article>
  );
};

export default CustomizationFormulaCard;
