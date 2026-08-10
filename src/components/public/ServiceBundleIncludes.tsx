import { useMemo } from 'react';
import { Check } from 'lucide-react';
import { formatNaira } from '@/lib/finance';
import type { ServiceRow } from '@/hooks/useServices';
import { useServiceBundleItems } from '@/hooks/useServiceMenuLinks';

interface Props {
  service: ServiceRow;
  allServices: ServiceRow[];
  /** Bundle price actually charged (after any active discount). */
  bundlePrice: number;
}

/** "What's included" for a bundle service. Display only — booking still uses the bundle service id. */
const ServiceBundleIncludes = ({ service, allServices, bundlePrice }: Props) => {
  const { data: items = [] } = useServiceBundleItems({ bundleServiceId: service.id });

  const rows = useMemo(
    () =>
      items
        .map((it) => {
          const comp = allServices.find((s) => s.id === it.component_service_id);
          return comp ? { item: it, comp } : null;
        })
        .filter(Boolean) as Array<{ item: (typeof items)[number]; comp: ServiceRow }>,
    [items, allServices],
  );

  if (rows.length === 0) return null;

  const componentValue = rows.reduce(
    (sum, r) => sum + (Number(r.comp.price_per_session) || 0) * (r.item.quantity ?? 1),
    0,
  );
  const saving = componentValue > bundlePrice ? componentValue - bundlePrice : 0;

  return (
    <section className="px-4 md:px-6 pb-4">
      <div className="max-w-4xl mx-auto glass rounded-2xl p-6 md:p-8">
        <p className="eyebrow text-bronze">Bundle</p>
        <h2 className="font-editorial text-2xl md:text-3xl mt-2">What's included</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Everything below is delivered in one treatment, at one fixed price.
        </p>

        <ul className="mt-5 grid gap-3">
          {rows.map(({ item, comp }) => (
            <li key={item.id} className="rounded-xl border border-border/60 px-4 py-3.5 flex items-start gap-3">
              <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/15 text-primary shrink-0 flex items-center justify-center">
                <Check className="w-3.5 h-3.5" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-display font-semibold text-foreground">
                  {comp.name}
                  {item.quantity > 1 && <span className="text-muted-foreground font-normal"> × {item.quantity}</span>}
                </span>
                {(item.display_note ?? comp.public_summary ?? comp.description) && (
                  <span className="block text-sm text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                    {item.display_note ?? comp.public_summary ?? comp.description}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 border-t border-border/40 pt-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <div className="text-2xl font-editorial">{formatNaira(bundlePrice)}</div>
          {saving > 0 && (
            <>
              <div className="text-base text-muted-foreground line-through">{formatNaira(componentValue)}</div>
              <div className="text-sm text-bronze">You save {formatNaira(saving)}</div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default ServiceBundleIncludes;
