import { ReactNode, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface TodaySectionProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  statusChip?: ReactNode;
  defaultOpen?: boolean;
  accent?: 'primary' | 'accent';
  children: ReactNode;
}

const TodaySection = ({
  icon: Icon,
  title,
  subtitle,
  statusChip,
  defaultOpen = false,
  accent = 'primary',
  children,
}: TodaySectionProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const accentText = accent === 'primary' ? 'text-primary' : 'text-accent';
  const accentBorder = accent === 'primary' ? 'border-primary/40' : 'border-accent/40';

  return (
    <section
      className={`glass rounded-xl border-l-2 ${accentBorder} overflow-hidden transition-shadow ${open ? 'shadow-lg shadow-primary/5' : ''}`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-surface-hover/40 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`shrink-0 w-9 h-9 rounded-lg bg-surface flex items-center justify-center ${accentText}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-bold text-foreground leading-tight truncate">{title}</h3>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {statusChip}
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 animate-fade-in border-t border-border/30">
          {children}
        </div>
      )}
    </section>
  );
};

export default TodaySection;