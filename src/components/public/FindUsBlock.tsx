import { MapPin, Clock, Phone, Mail, MessageCircle, Navigation, Calendar } from 'lucide-react';
import { BRAND, whatsAppLink } from '@/lib/brand';
import SocialIcons from './SocialIcons';
import { Link } from 'react-router-dom';

const FindUsBlock = () => {
  const fullAddress = [BRAND.address.line1, BRAND.address.line2, BRAND.address.city, BRAND.address.country]
    .filter(Boolean)
    .join(', ');

  return (
    <section className="py-16 px-6">
      <div className="max-w-6xl mx-auto grid gap-8 md:grid-cols-2 items-stretch">
        <div className="rounded-3xl bg-card/95 border border-border/50 p-8 space-y-6
                        shadow-[0_15px_40px_-20px_hsl(275_45%_18%_/_0.25)] relative overflow-hidden">
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-accent font-semibold">Visit us</p>
            <h2 className="text-3xl font-display font-semibold text-foreground mt-1">Find {BRAND.name}</h2>
          </div>

          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <MapPin className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <a
                href={BRAND.googleMapsLinkUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-foreground/90 hover:text-primary group"
              >
                <span>{BRAND.address.line1}</span>
                {BRAND.address.line2 && <><br /><span>{BRAND.address.line2}</span></>}
                <br />
                <span className="text-muted-foreground text-xs">{BRAND.address.city}, {BRAND.address.country}</span>
                <span className="block mt-1 text-xs text-primary inline-flex items-center gap-1">
                  <Navigation className="w-3 h-3" /> Get directions
                </span>
              </a>
            </li>

            <li className="flex items-start gap-3">
              <Clock className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <div className="text-foreground/90">
                {BRAND.hours.map((h) => (
                  <div key={h.days} className="flex gap-2">
                    <span className="font-medium">{h.days}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{h.time}</span>
                  </div>
                ))}
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Phone className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <a href={`tel:${BRAND.phone.replace(/\s/g, '')}`} className="text-foreground/90 hover:text-primary">
                {BRAND.phone}
              </a>
            </li>

            <li className="flex items-start gap-3">
              <Mail className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <a href={`mailto:${BRAND.email}`} className="text-foreground/90 hover:text-primary break-all">
                {BRAND.email}
              </a>
            </li>

            <li className="flex items-start gap-3">
              <MessageCircle className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <a
                href={whatsAppLink(`Hi ${BRAND.name}! 👋 I'd like to ask about your treatments.`)}
                target="_blank"
                rel="noreferrer noopener"
                className="text-foreground/90 hover:text-primary"
              >
                Chat on WhatsApp
              </a>
            </li>
          </ul>

          <div className="pt-2 border-t border-border/30">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Follow us</p>
            <SocialIcons variant="icon" />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              to="/consultation"
              className="inline-flex items-center justify-center gap-2 rounded-full
                         bg-primary text-primary-foreground px-5 py-3 text-sm font-medium tracking-wide
                         shadow-[0_8px_24px_-10px_hsl(275_55%_32%_/_0.55)] hover:scale-[1.02] transition"
            >
              <Calendar className="w-4 h-4" /> Free Consultation
            </Link>
            <a
              href={whatsAppLink(`Hi ${BRAND.name}! 👋`)}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center justify-center gap-2 rounded-full
                         border border-primary/25 bg-white/70 text-foreground px-5 py-3 text-sm font-medium
                         backdrop-blur hover:scale-[1.02] hover:bg-white transition"
            >
              <MessageCircle className="w-4 h-4 text-accent" /> WhatsApp Us
            </a>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden border border-border/40 min-h-[320px] relative bg-surface/40">
          {BRAND.googleMapsEmbedUrl ? (
            <iframe
              src={BRAND.googleMapsEmbedUrl}
              title={`${BRAND.name} on Google Maps`}
              className="w-full h-full min-h-[320px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          ) : (
            <a
              href={BRAND.googleMapsLinkUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="absolute inset-0 flex items-center justify-center gradient-hero hover:opacity-90 transition-opacity"
              aria-label={`Open ${BRAND.name} location in Google Maps`}
            >
              <div className="text-center px-6">
                <MapPin className="w-10 h-10 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground/90">{fullAddress}</p>
                <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                  <Navigation className="w-3 h-3" /> Open in Google Maps
                </p>
              </div>
            </a>
          )}
        </div>
      </div>
    </section>
  );
};

export default FindUsBlock;