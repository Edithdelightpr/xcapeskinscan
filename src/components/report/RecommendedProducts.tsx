import { useState } from 'react';
import { Check, Minus, Plus, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import type { ReportProduct } from '@/hooks/useReportPayload';
import { logReportEvent } from '@/hooks/useReportPayload';
import { useCartStore } from '@/store/cartStore';
import { formatFcfa } from '@/lib/xcapeRetail';

interface Props {
  token: string;
  products: ReportProduct[];
  /** False when the responsible merchant has not configured Mobile Money. */
  orderingAvailable?: boolean;
  merchantName?: string;
  merchantContactPhone?: string | null;
}

const RecommendedProducts = ({
  token,
  products,
  orderingAvailable = true,
  merchantName = 'XCAPE',
  merchantContactPhone = null,
}: Props) => {
  const cartItems = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const setQty = useCartStore((s) => s.setQty);
  const [qty, setQty_] = useState<Record<string, number>>({});
  const [added, setAdded] = useState<Set<string>>(new Set());

  if (products.length === 0) return null;

  const getQty = (id: string) => qty[id] ?? 1;
  const setLocalQty = (id: string, next: number) =>
    setQty_((prev) => ({ ...prev, [id]: Math.max(1, Math.min(10, next)) }));

  const onAdd = (p: ReportProduct) => {
    if (p.selling_price == null) return;
    const quantity = getQty(p.id);
    addItem(
      {
        product_id: p.id,
        name: p.name,
        slug: p.public_slug,
        image_url: p.image_url,
        unit_price: p.selling_price,
      },
      quantity,
    );
    setAdded((prev) => new Set(prev).add(p.id));
    logReportEvent(token, 'product_interest', { product_id: p.id, name: p.name, quantity });
    toast.success(`${p.name} added to your care plan`, {
      description: `Quantity ${quantity} · ${formatFcfa(p.selling_price * quantity)}`,
    });
  };

  const cartHas = (id: string) => cartItems.some((i) => i.product_id === id);

  return (
    <section aria-labelledby="recommended-products">
      <div className="mb-5">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-bronze font-semibold">Home care essentials</div>
        <h2 id="recommended-products" className="mt-1 font-display text-2xl sm:text-3xl text-cocoa tracking-tight">
          Recommended products
        </h2>
      </div>
      {!orderingAvailable && (
        <p className="mb-5 rounded-xl border border-bronze/25 bg-white/70 px-4 py-3 text-[12.5px] text-cocoa/80">
          Online ordering is not available for this report yet — {merchantName} has not set up
          Mobile Money payments.
          {merchantContactPhone ? ` Call ${merchantContactPhone} to order.` : ' Contact your practitioner to order.'}
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        {products.map((p) => {
          const q = getQty(p.id);
          const inCart = cartHas(p.id);
          const isAdded = added.has(p.id) || inCart;
          const disabled = p.selling_price == null || !orderingAvailable;
          return (
            <article
              key={p.id}
              className="rounded-3xl border border-bronze/15 bg-white/85 backdrop-blur p-5 sm:p-6 flex flex-col sm:flex-row gap-5 shadow-[0_1px_0_hsl(28_30%_60%_/_0.06)] hover:shadow-[0_16px_36px_-24px_hsl(22_38%_18%_/_0.3)] transition-shadow"
            >
              {p.image_url ? (
                <div className="w-full sm:w-32 h-40 sm:h-32 rounded-2xl overflow-hidden bg-cream-warm shrink-0">
                  <img src={p.image_url} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-full sm:w-32 h-40 sm:h-32 rounded-2xl bg-cream-warm shrink-0" />
              )}
              <div className="flex-1 min-w-0 flex flex-col">
                <h3 className="font-display text-[16px] text-cocoa leading-snug">{p.name}</h3>
                {p.short_description && (
                  <p className="mt-1.5 text-[12.5px] text-cocoa/70 leading-relaxed line-clamp-2">{p.short_description}</p>
                )}
                <div className="mt-3 text-[11.5px] text-bronze inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" strokeWidth={2.4} />
                  Recommended for your plan
                </div>

                <div className="mt-auto pt-4 flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-[15px] text-cocoa font-semibold tabular-nums">
                    {p.selling_price != null ? formatFcfa(p.selling_price) : 'Price not configured'}
                  </span>
                  <div className="flex items-center gap-2">
                    {!disabled && (
                      <div className="inline-flex items-center rounded-full border border-cocoa/15 bg-white">
                        <button
                          type="button"
                          onClick={() => setLocalQty(p.id, q - 1)}
                          className="p-1.5 text-cocoa/70 hover:text-cocoa disabled:opacity-40"
                          disabled={q <= 1}
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                        <span className="w-6 text-center text-[13px] font-medium text-cocoa tabular-nums">{q}</span>
                        <button
                          type="button"
                          onClick={() => setLocalQty(p.id, q + 1)}
                          className="p-1.5 text-cocoa/70 hover:text-cocoa"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => (isAdded ? setQty(p.id, (cartItems.find((i) => i.product_id === p.id)?.quantity ?? 0) + 1) : onAdd(p))}
                      disabled={disabled}
                      className={
                        'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-medium transition ' +
                        (disabled
                          ? 'bg-cocoa/10 text-cocoa/40 cursor-not-allowed'
                          : isAdded
                            ? 'bg-bronze/15 text-bronze hover:bg-bronze/25'
                            : 'bg-cocoa text-white hover:bg-cocoa/90')
                      }
                    >
                      {!orderingAvailable ? (
                        <>Ordering unavailable</>
                      ) : isAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5" strokeWidth={2} />
                          In your plan
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="w-3.5 h-3.5" strokeWidth={1.8} />
                          Add to cart
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default RecommendedProducts;