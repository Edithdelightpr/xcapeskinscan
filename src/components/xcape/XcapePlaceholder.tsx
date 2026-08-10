import { Helmet } from 'react-helmet-async';
import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
}

/**
 * Non-destructive placeholder for XCAPE capabilities that are planned
 * but not yet implemented. Clearly labelled — no fake working modules.
 */
const XcapePlaceholder = ({ icon: Icon, title, description }: Props) => (
  <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
    <Helmet>
      <title>{title} — XCAPE</title>
    </Helmet>
    <div className="glass rounded-2xl p-10 text-center">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/15 ring-1 ring-accent/30 flex items-center justify-center mb-5">
        <Icon className="w-7 h-7 text-primary" />
      </div>
      <h1 className="text-xl font-display font-bold text-foreground mb-2">{title}</h1>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">{description}</p>
      <span className="inline-block mt-6 text-[10px] uppercase tracking-[0.22em] px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold">
        Planned capability — not yet active
      </span>
    </div>
  </div>
);

export default XcapePlaceholder;
