import { Link } from 'react-router-dom';
import { ArrowRight, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ServiceRow } from '@/hooks/useServices';
import { useServiceAddonLinks } from '@/hooks/useServiceMenuLinks';
import { eligibleCoreIdsFor } from '@/lib/serviceMenu';

interface Props {
  service: ServiceRow;
  allServices: ServiceRow[];
}

/**
 * Shown instead of a booking CTA on a booster detail route.
 * Boosters cannot be booked standalone — they must be added to a qualifying infusion.
 */
const AddonRequiresCoreNotice = ({ service, allServices }: Props) => {
  const { data: links = [] } = useServiceAddonLinks();
  const coreIds = eligibleCoreIdsFor(service.id, links);
  const cores = coreIds
    .map((id) => allServices.find((s) => s.id === id))
    .filter((s): s is ServiceRow => !!s && s.active !== false && s.public_visible !== false);

  return (
    <section className="px-4 md:px-6 pb-4">
      <div className="max-w-4xl mx-auto glass rounded-2xl p-6 md:p-8">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-bronze mt-0.5 shrink-0" />
          <div className="space-y-2">
            <h2 className="font-editorial text-xl md:text-2xl">This booster is an add-on</h2>
            <p className="text-muted-foreground text-[15px]">
              {service.name} can’t be booked on its own. It’s added to a qualifying infusion during booking.
              Choose one of the infusions below and select this booster on that page.
            </p>
          </div>
        </div>

        {cores.length > 0 ? (
          <div className="mt-6 grid gap-3">
            {cores.map((c) => (
              <Link
                key={c.id}
                to={`/treatments/${c.public_slug ?? c.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-border/50 px-4 py-3 hover:border-bronze/60 transition-colors"
              >
                <span className="font-medium">{c.name}</span>
                <ArrowRight className="w-4 h-4 text-bronze shrink-0" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-6">
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/treatments">Browse treatments</Link>
            </Button>
          </div>
        )}

        <div className="mt-6">
          <Button asChild variant="ghost" className="rounded-full">
            <Link to="/consultation">Not sure? Book a free consultation</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default AddonRequiresCoreNotice;
