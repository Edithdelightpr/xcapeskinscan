import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { QrCode, MessageCircle, Calendar, ArrowRight, MapPin, Clock, Copy, ExternalLink } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';
import PublicTopNav from '@/components/PublicTopNav';
import PublicFooter from '@/components/public/PublicFooter';
import Seo from '@/components/Seo';
import OutreachIntakeQrCard from '@/components/public/OutreachIntakeQrCard';
import PageReveal from '@/components/public/PageReveal';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const steps = [
  { icon: QrCode, title: 'Scan or tap', body: 'Met us in the field? Scan the QR our team showed you, or tap the button below.' },
  { icon: MessageCircle, title: 'Tell us about you', body: 'Quick intake — name, contact, and a couple of questions. Takes under a minute.' },
  { icon: Calendar, title: 'Book your free consultation', body: "You'll get a WhatsApp from us with a link to pick a 20-minute slot. The consultation is on us." },
];

const Outreach = () => {
  const [active, setActive] = useState<any[]>([]);
  const [socialCopied, setSocialCopied] = useState(false);
  const socialUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/social-media-intake`;
  }, []);

  const copySocialLink = async () => {
    try {
      await navigator.clipboard.writeText(socialUrl);
      setSocialCopied(true);
      toast.success('Social media intake link copied');
      setTimeout(() => setSocialCopied(false), 1500);
    } catch {
      toast.error('Could not copy. Long-press the link to copy manually.');
    }
  };
  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await (supabase as any)
        .from('outreach_sessions')
        .select('id, name, location, outreach_date, start_time, end_time, status, public_intake_enabled, intake_slug')
        .in('status', ['planned', 'active'])
        .eq('public_intake_enabled', true)
        .gte('outreach_date', today)
        .order('outreach_date', { ascending: true })
        .limit(6);
      setActive((data ?? []).filter((o: any) => o.intake_slug));
    })();
  }, []);
  return (
    <PageReveal>
    <div className="min-h-screen gradient-primary">
      <Seo
        title="Tropics Med Spa Outreach | Free Skin Consultations in Abuja"
        description="Met the Tropics team at an outreach event? Complete your quick intake and book your free consultation in Abuja."
        path="/outreach"
      />
      <PublicTopNav />
      <main className="pt-24 pb-16">
        <header className="max-w-3xl mx-auto px-6 text-center mb-12">
          <p className="text-[11px] uppercase tracking-[0.3em] text-accent font-semibold">Outreach</p>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mt-3">
            Met us out there? Welcome in.
          </h1>
          <p className="text-muted-foreground mt-4 leading-relaxed">
            Tropics MedSpa runs outreach so the people who need our care never have to
            chase it down. If a member of our team handed you a card or showed you a QR,
            you're in the right place — start your intake below.
          </p>
        </header>

        {active.length > 0 && (
          <section className="max-w-3xl mx-auto px-6 mb-12">
            <h2 className="text-sm uppercase tracking-wider text-accent font-semibold mb-3">Live & upcoming outreaches</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {active.map((o) => (
                <Link key={o.id} to={`/outreach/intake/${o.intake_slug}`} className="glass rounded-xl p-4 hover:border-primary/40 transition">
                  <div className="font-display font-bold text-foreground">{o.name}</div>
                  <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground mt-1">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{o.outreach_date}</span>
                    {o.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{o.location}</span>}
                    {(o.start_time || o.end_time) && (
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />
                        {o.start_time?.slice(0, 5) ?? '—'}→{o.end_time?.slice(0, 5) ?? '—'}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="max-w-5xl mx-auto px-6 grid gap-6 md:grid-cols-3 mb-12">
          {steps.map(({ icon: Icon, title, body }) => (
            <div key={title} className="glass rounded-2xl p-6 space-y-3">
              <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display font-bold text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </section>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">Scan the QR our team showed you to start the right intake.</p>
        </div>

        <section className="max-w-3xl mx-auto px-6 mt-12">
          <OutreachIntakeQrCard />
        </section>

        <section className="max-w-3xl mx-auto px-6 mt-12">
          <div className="glass rounded-2xl p-6 sm:p-8 border border-accent/30 relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-primary/15 blur-3xl pointer-events-none" />

            <div className="relative flex flex-col md:flex-row items-center gap-6 md:gap-8">
              <div className="bg-white p-4 rounded-2xl shadow-2xl ring-2 ring-accent/40 flex-shrink-0">
                <QRCodeSVG
                  id="social-media-intake-qr-svg"
                  value={socialUrl}
                  size={168}
                  bgColor="#ffffff"
                  fgColor="#2a1a5e"
                  level="M"
                />
              </div>

              <div className="flex-1 min-w-0 text-center md:text-left space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/15 border border-accent/30">
                  <span className="text-[10px] uppercase tracking-[0.25em] text-accent font-semibold">
                    Social campaign
                  </span>
                </div>
                <h3 className="font-display text-xl sm:text-2xl font-bold text-foreground">
                  Acne Treatment Case Review
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Running a campaign on social media? Share this dedicated link so leads
                  can upload their photos and register for a free case review without
                  joining the outreach queue.
                </p>
                <p className="text-xs font-mono text-accent break-all">{socialUrl}</p>
                <div className="flex flex-wrap gap-2 justify-center md:justify-start pt-1">
                  <Button size="sm" variant="outline" onClick={copySocialLink}>
                    <Copy className="w-3.5 h-3.5 mr-1.5" /> {socialCopied ? 'Copied' : 'Copy link'}
                  </Button>
                  <Button size="sm" asChild className="glow-primary">
                    <a href="/social-media-intake" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open form
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
    </PageReveal>
  );
};

export default Outreach;