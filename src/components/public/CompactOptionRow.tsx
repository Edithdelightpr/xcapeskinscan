import { Link } from 'react-router-dom';
import { ArrowRight, Clock } from 'lucide-react';

interface Props {
  to: string;
  title: string;
  subtitle?: string | null;
  durationMinutes?: number | null;
  metaText?: string | null;
  priceText?: string | null;
  showOffer?: boolean;
  actionLabel?: string;
}

/**
 * Compact full-width CTA row used by the public treatment category/family menus.
 * No media area — title, optional subtitle, meta, price, offer badge, action.
 */
const CompactOptionRow = ({
  to,
  title,
  subtitle,
  durationMinutes,
  metaText,
  priceText,
  showOffer,
  actionLabel = 'Explore',
}: Props) => (
  <Link
    to={to}
    className="group card-luxe p-0 block overflow-hidden"
  >
    <div className="flex items-center gap-3 px-4 py-3 md:px-5 md:py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-display font-semibold text-foreground text-[15px] md:text-base group-hover:text-primary transition truncate">
            {title}
          </h3>
          {showOffer && (
            <span className="text-[9px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full bg-primary text-primary-foreground shrink-0">
              Offer
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs md:text-sm text-muted-foreground line-clamp-1 mt-0.5 leading-relaxed">{subtitle}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground mt-1">
          {!!durationMinutes && durationMinutes > 0 && (
            <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {durationMinutes} min</span>
          )}
          {metaText && <span>{metaText}</span>}
        </div>
      </div>
      <div className="text-right shrink-0">
        {priceText ? (
          <div className="text-sm md:text-base font-editorial text-foreground whitespace-nowrap">{priceText}</div>
        ) : (
          <div className="text-[11px] text-muted-foreground">On consultation</div>
        )}
        <span className="inline-flex items-center text-xs text-bronze gap-1 group-hover:gap-1.5 transition-all mt-0.5">
          {actionLabel} <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </div>
  </Link>
);

export default CompactOptionRow;
