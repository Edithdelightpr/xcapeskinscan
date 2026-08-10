import { Sparkles, MapPin, Phone } from 'lucide-react';
import type { ReportPromo } from '@/hooks/useReportPayload';
import { logReportEvent } from '@/hooks/useReportPayload';

interface Props {
  promo: ReportPromo;
  token: string;
}

const cleanNumber = (n: string | null) =>
  n ? n.replace(/[^\d]/g, '') : '';

/**
 * Branded promo/CTA block appended to every Personal Report. Always rendered
 * when a promo code is present (practitioner-specific or house fallback).
 */
const ReportPromoCta = ({ promo, token }: Props) => {
  const whatsapp = cleanNumber(promo.whatsapp_number);
  const bookHref = `/book?promo=${encodeURIComponent(promo.code)}`;
  const waHref = whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(
        `Hi Tropics MedSpa, I'd like to book a visit. My promo code is ${promo.code}.`,
      )}`
    : null;

  return (
    <section
      aria-labelledby="promo-cta"
      className="rounded-2xl border border-bronze/30 bg-gradient-to-br from-[hsl(30_60%_98%)] to-[hsl(30_40%_94%)] p-5 sm:p-8 shadow-sm"
    >
      <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] text-bronze font-semibold">
        <Sparkles className="w-3.5 h-3.5" /> Your reward
      </div>
      <h2 id="promo-cta" className="mt-1 font-display text-lg sm:text-2xl text-cocoa tracking-tight">
        {promo.practitioner_first_name
          ? `A gift from ${promo.practitioner_first_name}`
          : 'A gift from Tropics MedSpa'}
      </h2>

      <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-5">
        <div className="inline-flex items-center gap-2 rounded-full bg-cocoa text-[hsl(30_40%_97%)] px-4 py-2 shadow-md">
          <span className="text-[10px] uppercase tracking-[0.2em] opacity-70">Promo</span>
          <span className="font-display font-bold text-lg sm:text-xl tracking-wider">
            {promo.code}
          </span>
        </div>
        {promo.discount_pct ? (
          <p className="text-sm sm:text-base text-cocoa/90">
            <span className="font-semibold text-bronze">
              {Number(promo.discount_pct)}% off
            </span>{' '}
            your next visit — {promo.cta_text.toLowerCase()}
          </p>
        ) : (
          <p className="text-sm sm:text-base text-cocoa/90">{promo.cta_text}</p>
        )}
      </div>

      {(promo.address || promo.whatsapp_number) && (
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px] text-cocoa/80">
          {promo.address && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-bronze mt-0.5 shrink-0" />
              <span>{promo.address}</span>
            </div>
          )}
          {promo.whatsapp_number && (
            <div className="flex items-start gap-2">
              <Phone className="w-4 h-4 text-bronze mt-0.5 shrink-0" />
              <a
                href={waHref ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:underline"
                onClick={() => {
                  void logReportEvent(token, 'promo_whatsapp_click', { code: promo.code });
                }}
              >
                {promo.whatsapp_number}
              </a>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <a
          href={bookHref}
          onClick={() => {
            void logReportEvent(token, 'promo_book_click', { code: promo.code });
          }}
          className="inline-flex items-center justify-center rounded-full bg-bronze text-[hsl(30_40%_97%)] px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Book a visit
        </a>
        {waHref && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              void logReportEvent(token, 'promo_whatsapp_click', { code: promo.code });
            }}
            className="inline-flex items-center justify-center rounded-full border border-bronze/50 text-cocoa px-5 py-2.5 text-sm font-semibold hover:bg-bronze/10 transition-colors"
          >
            Chat on WhatsApp
          </a>
        )}
      </div>
    </section>
  );
};

export default ReportPromoCta;