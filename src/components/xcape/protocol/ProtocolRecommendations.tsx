import { FlaskConical, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Display shape shared by the staff resolver and the server-derived public
 * payload. Deliberately id-free and price-free: the protocol view shows
 * product name, concern, DS solution, exact ml, tier and usage area only.
 */
export interface ProtocolDisplayAddition {
  concern: string;
  ds_name: string;
  dose_ml: number;
  tier_label: string;
  score: number;
  companion: boolean;
}

/** ONLY the two customizable base products (Face Cream / Body Milk). */
export interface ProtocolDisplayProduct {
  product_name: string;
  /** Official XCAPE packaging image from the product configuration. */
  product_image_url?: string | null;
  area: 'face' | 'body';
  additions: ProtocolDisplayAddition[];
}

/**
 * A recommended, NON-customizable product. Never carries DS ingredients,
 * ml quantities or dose tiers — recommendation reason only.
 */
export interface ProtocolDisplayAddon {
  product_name: string;
  product_image_url?: string | null;
  area: 'face' | 'body';
  concern: string;
  reason: string;
  supports: string;
}

interface Props {
  face: ProtocolDisplayProduct[];
  body: ProtocolDisplayProduct[];
  /** Recommended add-ons — displayed in their own, non-customized section. */
  addons?: ProtocolDisplayAddon[];
  tone?: 'light' | 'dark';
  /** Shown under the heading; explains approval / purchasability status. */
  footnote?: string;
  className?: string;
}


const AreaGroup = ({
  title,
  subtitle,
  items,
  tone,
}: {
  title: string;
  subtitle: string;
  items: ProtocolDisplayProduct[];
  tone: 'light' | 'dark';
}) => {
  if (items.length === 0) return null;
  const dark = tone === 'dark';
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h4
          className={cn(
            'text-[11px] font-semibold uppercase tracking-[0.16em]',
            dark ? 'text-slate-400' : 'text-muted-foreground',
          )}
        >
          {title}
        </h4>
        <span className={cn('text-[11px]', dark ? 'text-slate-500' : 'text-muted-foreground/80')}>
          {subtitle}
        </span>
      </div>
      <ul className="space-y-2">
        {items.map((p) => (
          <li
            key={`${p.area}-${p.product_name}`}
            className={cn(
              'flex gap-3 rounded-2xl border p-3 sm:gap-4 sm:p-4',
              dark ? 'border-slate-700/80 bg-slate-900/40' : 'border-border/60 bg-surface/40',
            )}
          >
            {p.product_image_url && (
              <img
                src={p.product_image_url}
                alt={p.product_name}
                loading="lazy"
                className={cn(
                  'h-16 w-16 shrink-0 rounded-xl border object-cover sm:h-20 sm:w-20',
                  dark ? 'border-slate-700/80' : 'border-border/60',
                )}
              />
            )}
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-sm font-medium',
                  dark ? 'text-slate-100' : 'text-foreground',
                )}
              >
                {p.product_name}
              </p>
              <p
                className={cn(
                  'text-[10px] uppercase tracking-[0.16em]',
                  dark ? 'text-slate-500' : 'text-muted-foreground/80',
                )}
              >
                Customized for you with
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {p.additions.map((a, i) => (
                  <li
                    key={`${a.ds_name}-${a.concern}-${i}`}
                    className={cn(
                      'flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12.5px]',
                      dark ? 'text-slate-300' : 'text-muted-foreground',
                    )}
                  >
                    <span className={dark ? 'text-slate-100' : 'text-foreground'}>
                      {a.ds_name}
                      {a.companion && ' (companion)'}
                    </span>
                    <span
                      className={cn(
                        'font-semibold tabular-nums',
                        dark ? 'text-sky-300' : 'text-primary',
                      )}
                    >
                      {a.dose_ml} ml
                    </span>
                    <span className="text-[11px]">
                      {a.concern} · score {a.score}/100 · tier {a.tier_label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>

    </div>
  );
};

/** Recommended-only products: no DS ingredient, no ml, no tier. */
const AddonGroup = ({
  items,
  tone,
}: {
  items: ProtocolDisplayAddon[];
  tone: 'light' | 'dark';
}) => {
  if (items.length === 0) return null;
  const dark = tone === 'dark';
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h4
          className={cn(
            'flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em]',
            dark ? 'text-slate-300' : 'text-foreground',
          )}
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden /> Recommended XCAPE products
        </h4>
        <span className={cn('text-[11px]', dark ? 'text-slate-500' : 'text-muted-foreground/80')}>
          not customized — supporting routine
        </span>
      </div>
      <ul className="space-y-2">
        {items.map((p) => (
          <li
            key={`${p.area}-${p.product_name}`}
            className={cn(
              'flex gap-3 rounded-2xl border p-3 sm:gap-4 sm:p-4',
              dark ? 'border-slate-800 bg-slate-900/25' : 'border-border/50 bg-surface/25',
            )}
          >
            {p.product_image_url && (
              <img
                src={p.product_image_url}
                alt={p.product_name}
                loading="lazy"
                className={cn(
                  'h-14 w-14 shrink-0 rounded-xl border object-cover sm:h-16 sm:w-16',
                  dark ? 'border-slate-700/80' : 'border-border/60',
                )}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm font-medium', dark ? 'text-slate-100' : 'text-foreground')}>
                {p.product_name}
              </p>
              <p className={cn('mt-0.5 text-[12.5px]', dark ? 'text-slate-300' : 'text-muted-foreground')}>
                {p.reason}
              </p>
              {p.supports && (
                <p className={cn('text-[12px]', dark ? 'text-slate-400' : 'text-muted-foreground/80')}>
                  {p.supports}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * The deterministic XCAPE protocol recommendation.
 *
 * Two clearly separated sections:
 *  A) CUSTOMIZED PROTOCOL — XCAPE Face Cream and XCAPE Body Milk only, with
 *     their DS solutions and exact ml (body = 3× face).
 *  B) RECOMMENDED XCAPE PRODUCTS — every other product, recommendation
 *     reason only, never a customization.
 * Nothing here is generated by generic AI.
 */
const ProtocolRecommendations = ({
  face,
  body,
  addons = [],
  tone = 'light',
  footnote,
  className,
}: Props) => {
  if (face.length === 0 && body.length === 0 && addons.length === 0) return null;
  const dark = tone === 'dark';
  const hasCustomization = face.length > 0 || body.length > 0;
  return (
    <section
      aria-label="XCAPE protocol recommendations"
      className={cn(
        'space-y-5 rounded-2xl border p-4',
        dark ? 'border-slate-700/80 bg-[#101214]' : 'border-border/60 bg-card/50',
        className,
      )}
    >
      <div className="space-y-1">
        <h3
          className={cn(
            'flex items-center gap-1.5 text-sm font-semibold',
            dark ? 'text-slate-50' : 'text-foreground',
          )}
        >
          <FlaskConical className="h-4 w-4 shrink-0" aria-hidden /> XCAPE protocol recommendations
        </h3>
        <p className={cn('text-[11.5px]', dark ? 'text-slate-400' : 'text-muted-foreground')}>
          {footnote ??
            'Derived from your four health scores using the confirmed XCAPE customization protocol. Only the Face Cream and Body Milk are customized; body is prepared at 3× the face dose.'}
        </p>
      </div>

      {hasCustomization && (
        <div className="space-y-4">
          <div className="space-y-0.5">
            <h4
              className={cn(
                'text-[11px] font-semibold uppercase tracking-[0.16em]',
                dark ? 'text-sky-300' : 'text-primary',
              )}
            >
              Customized protocol
            </h4>
            <p className={cn('text-[11px]', dark ? 'text-slate-500' : 'text-muted-foreground/80')}>
              XCAPE Face Cream and Body Milk are the only products customized for you.
            </p>
          </div>
          <AreaGroup title="Face" subtitle="applied to facial skin" items={face} tone={tone} />
          <AreaGroup title="Body" subtitle="3× the face dose" items={body} tone={tone} />
        </div>
      )}

      <AddonGroup items={addons} tone={tone} />
    </section>
  );
};


export default ProtocolRecommendations;
