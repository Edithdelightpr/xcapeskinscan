import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatNaira } from '@/lib/finance';
import type { ServiceRow } from '@/hooks/useServices';
import { useServiceAddonLinks } from '@/hooks/useServiceMenuLinks';

interface Props {
  /** The core service being viewed. */
  service: ServiceRow;
  /** All active services (already loaded by the page). */
  allServices: ServiceRow[];
  /** Price of the core service, after any active discount. */
  corePrice: number;
  /** Base booking link used when no add-ons are selected. */
  routeSlug: string;
}

/**
 * "Enhance your treatment" — optional add-ons eligible for this core service.
 * Selection only affects the booking deep link (`?services=core,addon…`),
 * which the public booking wizard already supports. No cart/checkout change.
 */
const ServiceAddonSelector = ({ service, allServices, corePrice, routeSlug }: Props) => {
  const { data: links = [] } = useServiceAddonLinks({ coreServiceId: service.id });
  const [selected, setSelected] = useState<string[]>([]);

  const options = useMemo(
    () =>
      links
        .filter((l) => l.visible)
        .map((l) => {
          const addon = allServices.find((s) => s.id === l.addon_service_id);
          if (!addon || addon.active === false) return null;
          const price = l.price_override != null ? Number(l.price_override) : Number(addon.price_per_session) || 0;
          return { link: l, addon, price };
        })
        .filter(Boolean) as Array<{ link: (typeof links)[number]; addon: ServiceRow; price: number }>,
    [links, allServices],
  );

  if (options.length === 0) return null;

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const addonsTotal = options
    .filter((o) => selected.includes(o.addon.id))
    .reduce((sum, o) => sum + o.price, 0);
  const total = corePrice + addonsTotal;

  const bookHref =
    selected.length > 0
      ? `/book-appointment?services=${encodeURIComponent([service.id, ...selected].join(','))}&src=treatment&slug=${encodeURIComponent(routeSlug)}`
      : `/book-appointment?service=${encodeURIComponent(service.id)}&src=treatment&slug=${encodeURIComponent(routeSlug)}`;

  return (
    <section className="px-4 md:px-6 pb-4">
      <div className="max-w-4xl mx-auto glass rounded-2xl p-6 md:p-8">
        <p className="eyebrow text-bronze">Optional</p>
        <h2 className="font-editorial text-2xl md:text-3xl mt-2">Enhance your treatment</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Add one or more boosters to your session. Each is optional and priced separately.
        </p>

        <ul className="mt-5 grid gap-3">
          {options.map(({ addon, price }) => {
            const isOn = selected.includes(addon.id);
            return (
              <li key={addon.id}>
                <button
                  type="button"
                  onClick={() => toggle(addon.id)}
                  aria-pressed={isOn}
                  className={`w-full text-left rounded-xl border px-4 py-3.5 flex items-start gap-3 transition-colors ${
                    isOn ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-border'
                  }`}
                >
                  <span
                    className={`mt-0.5 w-5 h-5 rounded-md border shrink-0 flex items-center justify-center ${
                      isOn ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
                    }`}
                  >
                    {isOn ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3 h-3 opacity-50" />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-display font-semibold text-foreground">{addon.name}</span>
                    {(addon.public_summary ?? addon.description) && (
                      <span className="block text-sm text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                        {addon.public_summary ?? addon.description}
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-editorial text-foreground whitespace-nowrap">
                    + {formatNaira(price)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border/40 pt-5">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.24em] text-bronze font-semibold">Your total</div>
            <div className="text-2xl font-editorial mt-1">{formatNaira(total)}</div>
            {selected.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                {service.name} + {selected.length} {selected.length === 1 ? 'booster' : 'boosters'}
              </div>
            )}
          </div>
          <Button asChild size="lg" className="rounded-full">
            <Link to={bookHref}>
              <CalendarDays className="w-4 h-4 mr-2" />
              {selected.length > 0 ? 'Book with boosters' : 'Book this treatment'}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ServiceAddonSelector;
