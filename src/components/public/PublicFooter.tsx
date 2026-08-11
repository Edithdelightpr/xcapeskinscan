import { Link } from 'react-router-dom';
import { MapPin, Mail, Phone, MessageCircle } from 'lucide-react';
import tropicsLogo from '@/assets/tropics-logo.jpeg';
import { BRAND, whatsAppLink } from '@/lib/brand';
import SocialIcons from './SocialIcons';
import { usePublicBusinessHours } from '@/hooks/usePublicBusinessHours';

const PublicFooter = () => {
  const { data: hours = BRAND.hours } = usePublicBusinessHours();
  return (
    <footer className="border-t border-border/40 bg-cream-warm mt-24">
      <div className="max-w-7xl mx-auto px-6 py-16 grid gap-10 sm:grid-cols-2 md:grid-cols-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <img src={tropicsLogo} alt={BRAND.name} className="h-9 w-9 rounded object-cover" />
            <span className="font-display font-semibold text-foreground tracking-tight">{BRAND.name}</span>
          </div>
          <p className="text-[12.5px] text-muted-foreground leading-relaxed max-w-[15rem]">
            Medical-grade skin intelligence. Personalized care plans built around you.
          </p>
          <SocialIcons variant="icon" className="pt-2" />
        </div>

        <div>
          <h4 className="text-[10.5px] uppercase tracking-[0.24em] text-bronze font-semibold mb-4">Explore</h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link to="/medspa" className="text-foreground/80 hover:text-primary">Home</Link></li>
            <li><Link to="/about" className="text-foreground/80 hover:text-primary">About</Link></li>
            <li><Link to="/treatments" className="text-foreground/80 hover:text-primary">Treatments</Link></li>
            <li><Link to="/tropixa" className="text-foreground/80 hover:text-primary">Tropixa</Link></li>
            <li><Link to="/consultation" className="text-foreground/80 hover:text-primary">Book a consultation</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-[10.5px] uppercase tracking-[0.24em] text-bronze font-semibold mb-4">Visit us</h4>
          <ul className="space-y-3 text-sm text-foreground/80">
            <li className="flex items-start gap-2">
              <MapPin className="w-4 h-4 mt-0.5 text-bronze shrink-0" strokeWidth={1.5} />
              <a href={BRAND.googleMapsLinkUrl} target="_blank" rel="noreferrer noopener" className="hover:text-primary">
                {BRAND.address.line1}{BRAND.address.line2 ? `, ${BRAND.address.line2}` : ''}<br />
                <span className="text-muted-foreground text-xs">{BRAND.address.city}, {BRAND.address.country}</span>
              </a>
            </li>
            <li className="flex items-start gap-2">
              <Phone className="w-4 h-4 mt-0.5 text-bronze shrink-0" strokeWidth={1.5} />
              <a href={`tel:${BRAND.phone.replace(/\s/g, '')}`} className="hover:text-primary">{BRAND.phone}</a>
            </li>
            <li className="flex items-start gap-2">
              <Mail className="w-4 h-4 mt-0.5 text-bronze shrink-0" strokeWidth={1.5} />
              <a href={`mailto:${BRAND.email}`} className="hover:text-primary break-all">{BRAND.email}</a>
            </li>
            <li className="flex items-start gap-2">
              <MessageCircle className="w-4 h-4 mt-0.5 text-bronze shrink-0" strokeWidth={1.5} />
              <a
                href={whatsAppLink(`Hi ${BRAND.name}! 👋`)}
                target="_blank"
                rel="noreferrer noopener"
                className="hover:text-primary"
              >
                WhatsApp us
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-[10.5px] uppercase tracking-[0.24em] text-bronze font-semibold mb-4">Hours</h4>
          <ul className="space-y-2.5 text-sm text-foreground/80">
            {(hours.length > 0 ? hours : BRAND.hours).map((h) => (
              <li key={h.days} className="flex justify-between gap-3">
                <span className="font-medium">{h.days}</span>
                <span className="text-muted-foreground">{h.time}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-border/30 py-5 text-center text-[11px] tracking-[0.12em] text-muted-foreground">
        © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
      </div>
    </footer>
  );
};

export default PublicFooter;