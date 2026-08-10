import { AlertTriangle, Check, FlaskConical, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { formatNaira } from '@/lib/serviceDiscount';
import { CUSTOMIZATION_CATEGORIES } from '@/lib/xcapeRules/customization';
import { logReportEvent, type ReportFormula } from '@/hooks/useReportPayload';
import { useCartStore } from '@/store/cartStore';

interface Props {
  token: string;
  formula: ReportFormula;
}

/**
 * Client-facing XCAPE customized formula — renders the practitioner-approved
 * immutable snapshot: the kit to buy, which product inside it is customized,
 * the active solution and exact dose, the required companion, and usage
 * guidance. The client never constructs or guesses anything; the purchase
 * action carries the snapshot id so staff fulfilment sees the same formula.
 */
const CustomizationFormulaCard = ({ token, formula }: Props) => {
  const cartItems = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);

  const categoryLabel =
    CUSTOMIZATION_CATEGORIES.find((c) => c.key === formula.category)?.label ?? formula.category;

  const purchasable = formula.kit_product_id != null && formula.kit_unit_price != null;
  const inCart =
    purchasable &&
    cartItems.some(
      (i) => i.product_id === formula.kit_product_id && i.formula_snapshot_id === formula.id,
    );

  const formulaLabel = [
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

  const onAdd = () => {
    if (!purchasable) return;
    addItem(
      {
        product_id: formula.kit_product_id!,
        name: formula.kit_name ?? 'Customized kit',
        slug: null,
        image_url: null,
        unit_price: formula.kit_unit_price!,
        formula_snapshot_id: formula.id,
        formula_label: formulaLabel || null,
      },
      1,
    );
    logReportEvent(token, 'formula_interest', {
      formula_snapshot_id: formula.id,
      kit_product_id: formula.kit_product_id,
    });
    toast.success(`${formula.kit_name ?? 'Kit'} added to your care plan`, {
      description: `Your customized formula travels with the order · ${formatNaira(formula.kit_unit_price!)}`,
    });
  };

  return (
    <article className="rounded-3xl border border-bronze/20 bg-white/85 backdrop-blur p-5 sm:p-6 shadow-[0_1px_0_hsl(28_30%_60%_/_0.06)] hover:shadow-[0_16px_36px_-24px_hsl(22_38%_18%_/_0.3)] transition-shadow">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1 min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-bronze font-medium">
            <FlaskConical className="w-3.5 h-3.5" strokeWidth={1.9} />
            Customized for your {categoryLabel.toLowerCase()}
            {formula.score != null && <span className="text-cocoa/50">· score {formula.score}/100</span>}
            {formula.is_demo && (
              <span className="rounded-full border border-bronze/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wider">
                Demo
              </span>
            )}
          </div>
          <h3 className="font-display text-[18px] text-cocoa leading-snug">
            {formula.kit_name ?? 'Your customized kit'}
          </h3>
        </div>
        {formula.kit_unit_price != null && (
          <span className="text-[15px] text-cocoa font-semibold tabular-nums shrink-0">
            {formatNaira(formula.kit_unit_price)}
          </span>
        )}
      </div>

      {/* The exact formula — fixed by the practitioner, nothing to mix at home */}
      <div className="mt-4 rounded-2xl bg-cream-warm/70 border border-bronze/10 p-4 space-y-1.5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-bronze font-semibold">
          Your exact formula
        </div>
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
            Companion solution: <span className="font-medium">{formula.companion_name}</span>
            {formula.companion_dose_ml != null && (
              <span className="font-semibold"> — {formula.companion_dose_ml} ml</span>
            )}
          </p>
        )}
      </div>

      {formula.instructions && (
        <p className="mt-3 text-[12.5px] text-cocoa/75 leading-relaxed">{formula.instructions}</p>
      )}

      {(formula.warnings?.length ?? 0) > 0 && (
        <div className="mt-3 space-y-1">
          {formula.warnings.map((w, i) => (
            <p key={i} className="text-[11.5px] text-bronze flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={1.9} /> {w}
            </p>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-cocoa/55 max-w-md leading-relaxed">
          Prepared exactly to your practitioner's specification — nothing to measure or mix
          yourself.
        </p>
        {purchasable && (
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
        )}
      </div>
    </article>
  );
};

export default CustomizationFormulaCard;
