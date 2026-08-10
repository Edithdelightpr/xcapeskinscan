import { Droplet, Moon, Shield, Sparkles, Sun } from 'lucide-react';

interface Props { homeCare: string | null }

type Slot = 'am' | 'pm' | 'either';
interface Step { title: string; slot: Slot; hint?: string }

const iconFor = (title: string, slot: Slot) => {
  const t = title.toLowerCase();
  if (/spf|sun|sunscreen/.test(t)) return Sun;
  if (/moistur|cream|lotion/.test(t)) return Droplet;
  if (/serum|vit(a|amin)|treat|retin|acid/.test(t)) return Sparkles;
  if (/cleans|wash/.test(t)) return Droplet;
  if (/mask|barrier|repair/.test(t)) return Shield;
  return slot === 'pm' ? Moon : Sun;
};

function parseRoutine(text: string): { am: Step[]; pm: Step[]; other: Step[] } {
  const am: Step[] = [];
  const pm: Step[] = [];
  const other: Step[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let mode: Slot = 'either';
  for (const raw of lines) {
    const lower = raw.toLowerCase();
    if (/^(morning|am\b|a\.m\.)/i.test(lower)) { mode = 'am'; continue; }
    if (/^(evening|night|pm\b|p\.m\.)/i.test(lower)) { mode = 'pm'; continue; }
    const cleaned = raw.replace(/^[-•*\d.)\s]+/, '').trim();
    if (!cleaned || cleaned.length > 120) continue;
    const step: Step = { title: cleaned.replace(/[:—-]\s.*$/, ''), slot: mode };
    (mode === 'am' ? am : mode === 'pm' ? pm : other).push(step);
  }
  return { am, pm, other };
}

const StepChip = ({ step }: { step: Step }) => {
  const Icon = iconFor(step.title, step.slot);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-bronze/15 bg-white/85 backdrop-blur px-4 py-3">
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-bronze/12 text-bronze shrink-0">
        <Icon className="w-4 h-4" strokeWidth={1.6} />
      </span>
      <span className="text-[13.5px] text-cocoa font-medium">{step.title}</span>
    </div>
  );
};

const Column = ({ label, Icon, steps }: { label: string; Icon: typeof Sun; steps: Step[] }) => (
  <div>
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-bronze" strokeWidth={1.8} />
      <div className="text-[11px] uppercase tracking-[0.22em] text-bronze font-semibold">{label}</div>
    </div>
    <div className="space-y-2.5">
      {steps.map((s, i) => <StepChip key={`${label}-${i}-${s.title}`} step={s} />)}
    </div>
  </div>
);

const HomeCareRoutine = ({ homeCare }: Props) => {
  if (!homeCare?.trim()) return null;
  const { am, pm, other } = parseRoutine(homeCare);
  const hasStructured = am.length + pm.length > 0;

  return (
    <section aria-labelledby="home-care-routine">
      <div className="mb-3 sm:mb-5">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-bronze font-semibold">Your daily rhythm</div>
        <h2 id="home-care-routine" className="mt-1 font-display text-xl sm:text-3xl text-cocoa tracking-tight">
          Home care routine
        </h2>
      </div>
      <div className="rounded-3xl border border-bronze/15 bg-cream-warm/40 backdrop-blur p-4 sm:p-8">
        {hasStructured ? (
          <div className="grid gap-5 sm:gap-8 sm:grid-cols-2">
            {am.length > 0 && <Column label="Morning" Icon={Sun} steps={am} />}
            {pm.length > 0 && <Column label="Evening" Icon={Moon} steps={pm} />}
            {other.length > 0 && (
              <div className="sm:col-span-2">
                <div className="text-[11px] uppercase tracking-[0.22em] text-bronze font-semibold mb-3">Anytime</div>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {other.map((s, i) => <StepChip key={`o-${i}`} step={s} />)}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[13px] sm:text-[14px] text-cocoa/80 leading-[1.5] whitespace-pre-wrap">{homeCare}</p>
        )}
      </div>
    </section>
  );
};

export default HomeCareRoutine;