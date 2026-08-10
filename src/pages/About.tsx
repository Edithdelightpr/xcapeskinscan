import { useState } from 'react';
import PublicTopNav from '@/components/PublicTopNav';
import PublicFooter from '@/components/public/PublicFooter';
import Seo from '@/components/Seo';
import PageReveal from '@/components/public/PageReveal';
import AboutVideoBlock from '@/components/public/AboutVideoBlock';
import MediaPlaceholderCard from '@/components/public/MediaPlaceholderCard';
import EditorialQuoteBand from '@/components/public/EditorialQuoteBand';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import Autoplay from 'embla-carousel-autoplay';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  MessageCircle,
  ArrowRight,
  Mail,
  Sparkles,
  Droplets,
  Activity,
  CircleDot,
  HeartHandshake,
  Microscope,
  Factory,
  Eye,
  Play,
  BookOpen,
  Check,
} from 'lucide-react';
import aboutTdrtiTraining from '@/assets/about-tdrti-training.jpg';
import aboutCommunitySkinAnalysis from '@/assets/about-community-skin-analysis.jpg';
import aboutFarmToFormulation from '@/assets/about-farm-to-formulation.jpg';
import aboutFinishedProducts from '@/assets/about-finished-products.jpg';
import aboutOutreach1 from '@/assets/about-outreach-1.png';
import aboutOutreach2 from '@/assets/about-outreach-2.png';
import aboutOutreach3 from '@/assets/about-outreach-3.png';
import aboutOutreach4 from '@/assets/about-outreach-4.png';

/**
 * Drop YouTube URLs in here (any format: youtu.be/xxx, watch?v=xxx, shorts/xxx).
 * Empty string → renders a "Video coming soon" placeholder card.
 */
const aboutVideos = {
  openingStory: 'https://youtu.be/5egrKGAYv9M',
  researchFindings: '',
  outreachPrograms: '',
  tdriRmrdcValueChain: '',
  partnerInvitation: '',
};

/**
 * Outreach Experience Library — 1 featured + 6 tiles.
 * Drop a YouTube URL into `youtubeUrl` or an imported image into `imageSrc`
 * to replace any placeholder. Order here = render order on the page.
 */
const outreachFeatured = {
  label: '\u200bCollaboration with Holy Family Catholic Church \nLifecamp Abuja',
  recommendation: 'Recommended: short clip of our outreach team setting up the free skin scan station.',
  youtubeUrl: 'https://youtu.be/L3Q33JXPKbU',
  imageSrc: '',
};

const outreachMedia: Array<{
  label: string;
  recommendation?: string;
  kind: 'video' | 'image';
  youtubeUrl?: string;
  imageSrc?: string;
}> = [
  { label: 'Community engagement at outreach', kind: 'image', imageSrc: aboutOutreach1 },
  { label: 'Skin analysis in progress', kind: 'image', imageSrc: aboutOutreach2 },
  { label: 'Client consultation moment', kind: 'image', imageSrc: aboutOutreach3 },
  { label: 'Guided skin scan session', kind: 'image', imageSrc: aboutOutreach4 },
];

// Partnership contact (UAE WhatsApp per partnership brief).
const PARTNER_WHATSAPP_DIGITS = '2348037696910';
const PARTNER_MESSAGE =
  "Hello, I'd like to explore a Tropics MedSpa outreach partnership for my community.";
const PARTNER_WHATSAPP_URL = `https://wa.me/${PARTNER_WHATSAPP_DIGITS}?text=${encodeURIComponent(PARTNER_MESSAGE)}`;
const PARTNER_EMAIL = 'Info@tropicsmedspa.com';

const researchConcerns = [
  {
    icon: CircleDot,
    title: 'Hyperpigmentation',
    body: 'Uneven tone, dark spots, and discoloration remain one of the most common concerns.',
  },
  {
    icon: Droplets,
    title: 'Surface Dehydration',
    body: 'Many people experience dryness and barrier weakness, even in humid environments.',
  },
  {
    icon: Activity,
    title: 'Weak Elasticity',
    body: 'Loss of firmness and poor skin resilience appear across different age groups and lifestyles.',
  },
  {
    icon: Sparkles,
    title: 'Sebum Imbalance & Clogged Pores',
    body: 'Excess oil production can lead to congestion, clogged pores, and recurring breakouts.',
  },
];

const valueChain = [
  'Community',
  'Research',
  'Raw Materials',
  'Formulation',
  'Training',
  'Product',
  'Market',
];

const benefits = [
  {
    icon: HeartHandshake,
    title: 'Community value',
    body: 'Free skin scans and education for residents, guests, and members.',
  },
  {
    icon: Microscope,
    title: 'Research impact',
    body: 'Your community contributes to African skin research.',
  },
  {
    icon: Factory,
    title: 'Local industry growth',
    body: 'Supporting raw materials, formulation, and manufacturing.',
  },
  {
    icon: Eye,
    title: 'Brand visibility',
    body: 'Partners join a visible, meaningful wellness initiative.',
  },
];

const partnerBenefits = [
  'Free skin scan campaign for your community',
  'Wellness education and skin awareness',
  'Marketing and brand positioning value',
  'Community engagement',
  'Financial terms discussed and agreed before activation',
  'Professional setup and reporting after the outreach',
];

const About = () => {
  const [playSignal, setPlaySignal] = useState(0);

  const handleWatchStory = () => {
    const el = document.getElementById('opening-story');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setPlaySignal((n) => n + 1);
  };

  const scrollToId = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <PageReveal>
      <div className="theme-luxe min-h-screen gradient-primary">
        <Seo
          title="About Tropics MedSpa | A Research Movement for African Skin"
          description="Tropics MedSpa and TDRTI are building a research-led African skincare value chain — community skin analysis, local raw materials, training, and manufacturing. Partner with us."
          path="/about"
        />
        <PublicTopNav />

        <main className="pt-16">
          {/* ─────────────── 1. HERO — video-led opening ─────────────── */}
          <section className="relative overflow-hidden">
            <div className="absolute inset-0 -z-10">
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(180deg, #f7f1e8 0%, #efe4d3 100%)' }}
              />
              <div
                className="absolute inset-0 opacity-[0.5]"
                style={{
                  background:
                    'radial-gradient(80% 60% at 50% 0%, hsl(35 60% 88% / 0.55) 0%, transparent 70%)',
                }}
              />
            </div>

            {/* Opening video — first thing users see */}
            <div className="max-w-4xl mx-auto px-5 sm:px-6 pt-10 md:pt-14 animate-fade-in">
              <div className="text-center mb-6 sm:mb-8">
                <div className="inline-flex items-center gap-3 text-[10.5px] tracking-[0.3em] uppercase text-primary/80 font-semibold">
                  <span className="h-px w-8 bg-primary/40" />
                  <span>Tropics MedSpa × TDRTI</span>
                  <span className="h-px w-8 bg-primary/40" />
                </div>
              </div>

              {aboutVideos.openingStory ? (
                <AboutVideoBlock
                  id="opening-story"
                  title="A Message From Dr. Edith"
                  description="Who we are, the research we are doing across Nigeria, and why African skin in tropical environments deserves dedicated study."
                  youtubeUrl={aboutVideos.openingStory}
                  autoplay
                  playSignal={playSignal}
                />
              ) : (
                <figure id="opening-story" className="relative scroll-mt-24">
                  <div className="relative rounded-[1.5rem] overflow-hidden ring-1 ring-primary/15
                                  shadow-[0_30px_60px_-25px_hsl(275_45%_18%_/_0.35)] aspect-video">
                    <img
                      src={aboutTdrtiTraining}
                      alt="TDRTI dermatology research and training session in Abuja"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/70 via-primary/20 to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/95 text-primary flex items-center justify-center
                                       shadow-[0_10px_30px_-8px_rgba(0,0,0,0.4)]">
                        <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current ml-1" />
                      </span>
                    </div>
                    <div className="absolute left-5 bottom-5 right-5 flex items-center justify-between text-white">
                      <span className="text-[10.5px] tracking-[0.3em] uppercase font-semibold opacity-90">
                        Opening film · Coming soon
                      </span>
                    </div>
                  </div>
                </figure>
              )}
            </div>

          </section>

          {/* Tagline + Watch/Read choice — moved above Chapter 01 */}
          <section className="px-5 sm:px-6 pt-10 md:pt-12 pb-10 md:pb-14">
            <div className="max-w-3xl mx-auto text-center animate-fade-in">
              <h1 className="font-editorial font-medium tracking-tight text-foreground
                             text-2xl sm:text-5xl lg:text-[3.75rem] leading-[1.1] mb-2 sm:mb-3">
                Not Just Skincare.
                <br />
                <span className="italic text-primary">A Movement for African Skin.</span>
              </h1>

              <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                <button
                  type="button"
                  onClick={handleWatchStory}
                  className="group inline-flex items-center justify-center gap-2 rounded-full
                             bg-primary text-primary-foreground px-7 py-4 text-[15px] md:text-sm font-medium tracking-wide
                             shadow-[0_10px_30px_-10px_hsl(275_55%_32%_/_0.55)]
                             transition-all duration-500 ease-out
                             hover:scale-[1.03] hover:shadow-[0_18px_50px_-12px_hsl(320_65%_55%_/_0.55)]"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Watch the Story
                </button>
                <button
                  type="button"
                  onClick={() => scrollToId('why-this-work-exists')}
                  className="group inline-flex items-center justify-center gap-2 rounded-full
                             border border-primary/30 bg-white/60 text-foreground px-7 py-4 text-[15px] md:text-sm font-medium tracking-wide
                             transition-all duration-500 ease-out
                             hover:bg-white hover:border-primary/50"
                >
                  <BookOpen className="w-4 h-4" />
                  Read About Us
                </button>
              </div>
            </div>
          </section>

          {/* Section break */}
          <div className="max-w-xs mx-auto h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />

          {/* ─────────────── 2. WHY THIS WORK EXISTS ─────────────── */}
          <section id="why-this-work-exists" className="pt-10 sm:pt-16 md:pt-20 pb-12 sm:pb-16 md:pb-24 px-5 sm:px-6 scroll-mt-20">
            <div className="max-w-6xl mx-auto grid gap-8 md:gap-14 md:grid-cols-2 md:items-center">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-accent font-semibold">Chapter 01</p>
                <h2 className="mt-3 font-editorial text-[1.75rem] sm:text-3xl md:text-4xl lg:text-5xl text-foreground leading-[1.15]">
                  Why this work <span className="italic">exists</span>
                </h2>
                <div className="mt-5 space-y-2.5 text-[15px] sm:text-base md:text-lg text-foreground/75 leading-relaxed">
                  <p>Africa has the raw materials.</p>
                  <p>Africa has the people.</p>
                  <p>Africa has the demand.</p>
                </div>
                <p className="mt-4 text-[14.5px] md:text-base text-foreground/70 leading-relaxed max-w-md">
                  We're building the bridge between research, community, raw materials,
                  manufacturing, and market access.
                </p>
                <p className="mt-5 font-editorial italic text-foreground text-lg sm:text-xl md:text-2xl leading-snug max-w-md">
                  The first step is not selling a product — it's understanding the people.
                </p>
              </div>
              <div>
                <MediaPlaceholderCard
                  variant="featured"
                  kind="image"
                  label="Community skin analysis / research moment"
                  imageSrc={aboutCommunitySkinAnalysis}
                />
              </div>
            </div>
          </section>

          {/* ─────────────── 3. WHAT OUR RESEARCH IS REVEALING ─────────────── */}
          <section className="section-bleed-cream py-14 sm:py-20 md:py-28 px-5 sm:px-6">
            <div className="max-w-6xl mx-auto">
              <div className="max-w-3xl">
                <p className="text-[11px] uppercase tracking-[0.3em] text-accent font-semibold">Chapter 02</p>
                <h2 className="mt-3 font-editorial text-[1.75rem] sm:text-3xl md:text-4xl lg:text-5xl text-foreground leading-[1.15]">
                  What our research is <span className="italic">revealing</span>
                </h2>
                <p className="mt-4 max-w-prose text-[15px] sm:text-base md:text-lg text-foreground/70 leading-relaxed">
                  Recurring concerns across melanin-rich skin in tropical environments.
                </p>
              </div>

              <div className="mt-10 grid gap-3.5 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {researchConcerns.map(({ icon: Icon, title, body }, i) => (
                  <div
                    key={title}
                    className="group relative rounded-2xl bg-card/95 border border-primary/10 p-4 sm:p-6
                               shadow-[0_15px_40px_-25px_hsl(275_45%_18%_/_0.4)]
                               hover:-translate-y-1 hover:border-primary/25 transition-all duration-500"
                  >
                    <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center">
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    </div>
                    <div className="mt-3 sm:mt-4 flex items-baseline gap-2 flex-wrap">
                      <span className="text-[10.5px] tracking-[0.28em] uppercase text-accent font-semibold">
                        0{i + 1}
                      </span>
                      <h3 className="font-display font-semibold text-foreground text-[14px] sm:text-[15.5px] leading-snug">{title}</h3>
                    </div>
                    <p className="mt-2 text-[12.5px] sm:text-[13.5px] text-foreground/65 leading-relaxed">{body}</p>
                  </div>
                ))}
              </div>

            </div>
          </section>

          {/* ─────────────── 4. FROM COMMUNITY TO INDUSTRY ─────────────── */}
          <section className="py-14 sm:py-20 md:py-28 px-5 sm:px-6">
            <div className="max-w-6xl mx-auto grid gap-10 md:gap-14 md:grid-cols-2 md:items-start">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-accent font-semibold">Chapter 03</p>
                <h2 className="mt-3 font-editorial text-[1.75rem] sm:text-3xl md:text-4xl lg:text-5xl text-foreground leading-[1.15]">
                  From community to <span className="italic">industry</span>
                </h2>
                <div className="mt-5 space-y-3.5 text-[15px] sm:text-base md:text-lg text-foreground/75 leading-relaxed max-w-prose">
                  <p>Our work doesn't end with skin scans.</p>
                  <p className="font-editorial italic text-foreground text-lg sm:text-xl md:text-2xl leading-snug pt-2">
                    Africa should manufacture more of what it needs — not export its future raw.
                  </p>
                </div>
              </div>
              <div>
                <Chapter3Carousel />
              </div>
            </div>
          </section>

          {/* ─────────────── 5. OUR OUTREACH EXPERIENCE — media library ─────────────── */}
          <section className="section-bleed-cream py-14 sm:py-20 md:py-28 px-5 sm:px-6">
            <div className="max-w-6xl mx-auto">
              <div className="max-w-3xl">
                <p className="text-[11px] uppercase tracking-[0.3em] text-accent font-semibold">Chapter 04</p>
                <h2 className="mt-3 font-editorial text-[1.75rem] sm:text-3xl md:text-4xl lg:text-5xl text-foreground leading-[1.15]">
                  Our community <span className="italic">Outreach</span>
                </h2>
                <p className="mt-4 text-[15px] sm:text-base md:text-lg text-foreground/70 leading-relaxed">
                  See how we bring free skin scans, education, and guided skincare support into
                  real communities.
                </p>
              </div>

              {/* Outreach media swipe carousel — autoplay every 6s, user can swipe */}
              <div className="mt-8 sm:mt-10">
                <OutreachCarousel />

                <div className="mt-10 flex justify-center">
                  <a
                    href="#partner"
                    onClick={(e) => { e.preventDefault(); scrollToId('partner'); }}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 sm:px-9 py-3.5 sm:py-4
                               text-[13px] sm:text-sm font-semibold uppercase tracking-[0.18em] text-primary-foreground
                               shadow-[0_18px_40px_-15px_hsl(275_45%_18%_/_0.55)] ring-1 ring-accent/40
                               transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_22px_50px_-15px_hsl(275_45%_18%_/_0.65)]"
                  >
                    Partner With Us
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* Editorial pull-quote band — breaks text rhythm before Chapter 05 */}
          <EditorialQuoteBand
            eyebrow="The Tropics Standard"
            quote="Research before recommendation. Community before commerce."
          />

          {/* ─────────────── 6. WHY YOUR COMMUNITY SHOULD BE PART OF THIS ─────────────── */}
          <section className="py-12 sm:py-16 md:py-24 px-5 sm:px-6">
            <div className="max-w-6xl mx-auto">
              <div className="max-w-3xl">
                <p className="text-[11px] uppercase tracking-[0.3em] text-accent font-semibold">Chapter 05</p>
                <h2 className="mt-3 font-editorial text-[1.75rem] sm:text-3xl md:text-4xl lg:text-5xl text-foreground leading-[1.15]">
                  Why your community should be <span className="italic">part of this</span>
                </h2>
                <p className="mt-5 max-w-prose text-[15px] sm:text-base md:text-lg text-foreground/75 leading-relaxed">
                  Hosting us means giving your community free skin analysis,
                  education, and a research-led movement built from the ground up.
                </p>
              </div>

              <div className="mt-10 grid gap-3.5 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {benefits.map(({ icon: Icon, title, body }, i) => (
                  <div
                    key={title}
                    className="group relative rounded-2xl bg-card/95 border border-primary/10 p-4 sm:p-6
                               shadow-[0_15px_40px_-25px_hsl(275_45%_18%_/_0.4)]
                               hover:-translate-y-1 hover:border-primary/25 transition-all duration-500"
                  >
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center">
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    </div>
                    <div className="mt-3 sm:mt-4 flex items-baseline gap-2 flex-wrap">
                      <span className="text-[10.5px] tracking-[0.28em] uppercase text-accent font-semibold">
                        0{i + 1}
                      </span>
                      <h3 className="font-display font-semibold text-foreground text-[14px] sm:text-[15.5px] leading-snug">{title}</h3>
                    </div>
                    <p className="mt-2 text-[12.5px] sm:text-[13.5px] text-foreground/65 leading-relaxed">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─────────────── 7. PARTNER WITH US — distinct conversion block ─────────────── */}
          <section
            id="partner"
            className="relative py-14 sm:py-20 md:py-28 px-5 sm:px-6 scroll-mt-20 overflow-hidden"
            style={{
              background:
                'linear-gradient(135deg, hsl(275 55% 18%) 0%, hsl(285 50% 22%) 45%, hsl(320 55% 28%) 100%)',
            }}
          >
            <div className="absolute -top-32 -right-32 w-[32rem] h-[32rem] rounded-full bg-accent/15 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -left-32 w-[30rem] h-[30rem] rounded-full bg-white/5 blur-3xl pointer-events-none" />

            <div className="relative max-w-5xl mx-auto text-primary-foreground">
              <p className="text-[11px] uppercase tracking-[0.3em] text-accent font-semibold">Partnership</p>
              <h2 className="mt-3 font-editorial text-[1.875rem] sm:text-3xl md:text-5xl lg:text-[3.5rem] leading-[1.1] max-w-3xl">
                We're Looking for <span className="italic">Access to Communities</span>
              </h2>
              <p className="mt-4 sm:mt-5 text-[15.5px] sm:text-lg md:text-xl text-accent/90 font-medium max-w-3xl leading-snug">
                For a 30-day free skin scan and skin health education pilot.
              </p>

              <div className="mt-6 space-y-3.5 text-[14.5px] sm:text-[15px] md:text-lg text-primary-foreground/85 leading-relaxed max-w-3xl">
                <p>
                  We're looking to collaborate with churches, lounges, malls, estates, hotels,
                  institutions, and high-footfall spaces across Nigeria.
                </p>
                <p>
                  The goal is to reach as many communities as possible with free skin scans,
                  skincare education, and research-backed guidance for melanin-rich skin in
                  tropical environments.
                </p>
              </div>

              <div className="mt-8 sm:mt-10">
                <p className="text-[10.5px] uppercase tracking-[0.3em] text-accent font-semibold">
                  What partners get
                </p>
                <ul className="mt-4 grid gap-2.5 sm:gap-3 sm:grid-cols-2 max-w-3xl">
                  {partnerBenefits.map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-3 rounded-2xl bg-white/[0.06] border border-white/10 px-3.5 py-2.5 sm:px-4 sm:py-3"
                    >
                      <span className="mt-0.5 w-6 h-6 shrink-0 rounded-full bg-accent/20 ring-1 ring-accent/40 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-accent" />
                      </span>
                      <span className="text-[13.5px] sm:text-[14.5px] leading-snug text-primary-foreground/90">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4">
                <a
                  href={PARTNER_WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center justify-center gap-2.5 rounded-full
                             bg-accent text-primary px-6 sm:px-8 py-4 text-[15px] sm:text-[15px] font-semibold tracking-wide
                             shadow-[0_20px_50px_-12px_rgba(0,0,0,0.55)]
                             transition-all duration-500 ease-out hover:scale-[1.03] w-full sm:w-auto"
                >
                  <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  <span className="whitespace-normal text-center">Partner With Us on WhatsApp</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-0.5" />
                </a>
                <a
                  href={`mailto:${PARTNER_EMAIL}`}
                  className="inline-flex items-center justify-center gap-2 rounded-full
                             border border-white/30 bg-white/5 text-primary-foreground px-5 sm:px-7 py-4 text-[13.5px] sm:text-[15px] font-medium tracking-wide
                             hover:bg-white/10 transition-all w-full sm:w-auto"
                >
                  <Mail className="w-4 h-4 text-accent shrink-0" />
                  <span className="truncate">{PARTNER_EMAIL}</span>
                </a>
              </div>

              <p className="mt-4 sm:mt-5 text-[12px] sm:text-[12.5px] text-primary-foreground/60">
                Direct line: +971 55 367 8114
              </p>
            </div>
          </section>
        </main>

        <PublicFooter />
      </div>
    </PageReveal>
  );
};

export default About;

function OutreachCarousel() {
  const autoplay = useRef(
    Autoplay({ delay: 2000, stopOnInteraction: false, stopOnMouseEnter: true }),
  );
  const slides = [
    {
      label: outreachFeatured.label,
      recommendation: outreachFeatured.recommendation,
      kind: 'video' as const,
      youtubeUrl: outreachFeatured.youtubeUrl,
      imageSrc: outreachFeatured.imageSrc,
    },
    ...outreachMedia,
  ];

  return (
    <Carousel
      opts={{ loop: true, align: 'start' }}
      plugins={[autoplay.current]}
      className="relative w-full"
    >
      <CarouselContent>
        {slides.map((s, i) => (
          <CarouselItem key={`${s.label}-${i}`} className="basis-full">
            <MediaPlaceholderCard
              variant="featured"
              kind={s.kind}
              label={s.label}
              recommendation={s.recommendation}
              youtubeUrl={s.youtubeUrl}
              imageSrc={s.imageSrc}
              imageFit="cover"
              imagePosition="center top"
            />
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="hidden sm:flex -left-4 lg:-left-12" />
      <CarouselNext className="hidden sm:flex -right-4 lg:-right-12" />
    </Carousel>
  );
}

function Chapter3Carousel() {
  const autoplay = useRef(
    Autoplay({ delay: 2000, stopOnInteraction: false, stopOnMouseEnter: true }),
  );
  const slides = [
    {
      label: 'Training & research',
      kind: 'video' as const,
      youtubeUrl: 'https://youtu.be/56DX5fPXfJg',
    },
    {
      label: 'Farm to formulation',
      kind: 'image' as const,
      imageSrc: aboutFarmToFormulation,
    },
    {
      label: 'Finished products',
      kind: 'image' as const,
      imageSrc: aboutFinishedProducts,
    },
  ];

  return (
    <Carousel
      opts={{ loop: true, align: 'start' }}
      plugins={[autoplay.current]}
      className="relative w-full"
    >
      <CarouselContent>
        {slides.map((s, i) => (
          <CarouselItem key={`${s.label}-${i}`} className="basis-full">
            <MediaPlaceholderCard
              variant="featured"
              kind={s.kind}
              label={s.label}
              youtubeUrl={s.youtubeUrl}
              imageSrc={s.imageSrc}
              imageFit="cover"
              imagePosition="center top"
            />
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="hidden sm:flex -left-4 lg:-left-12" />
      <CarouselNext className="hidden sm:flex -right-4 lg:-right-12" />
    </Carousel>
  );
}