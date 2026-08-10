/**
 * Deterministic internal color per practitioner (staff) id.
 * Admin-only — never rendered on public booking surfaces.
 * 10 hand-picked Tailwind hues that read well on the dark glass theme.
 */
const PALETTE = [
  { bar: 'bg-sky-500',     soft: 'bg-sky-500/15 border-sky-500/40 text-sky-200',     dot: 'bg-sky-400' },
  { bar: 'bg-violet-500',  soft: 'bg-violet-500/15 border-violet-500/40 text-violet-200',  dot: 'bg-violet-400' },
  { bar: 'bg-pink-500',    soft: 'bg-pink-500/15 border-pink-500/40 text-pink-200',    dot: 'bg-pink-400' },
  { bar: 'bg-emerald-500', soft: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200', dot: 'bg-emerald-400' },
  { bar: 'bg-amber-500',   soft: 'bg-amber-500/15 border-amber-500/40 text-amber-200',   dot: 'bg-amber-400' },
  { bar: 'bg-cyan-500',    soft: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200',    dot: 'bg-cyan-400' },
  { bar: 'bg-rose-500',    soft: 'bg-rose-500/15 border-rose-500/40 text-rose-200',    dot: 'bg-rose-400' },
  { bar: 'bg-indigo-500',  soft: 'bg-indigo-500/15 border-indigo-500/40 text-indigo-200',  dot: 'bg-indigo-400' },
  { bar: 'bg-teal-500',    soft: 'bg-teal-500/15 border-teal-500/40 text-teal-200',    dot: 'bg-teal-400' },
  { bar: 'bg-fuchsia-500', soft: 'bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-200', dot: 'bg-fuchsia-400' },
] as const;

const UNASSIGNED = {
  bar: 'bg-muted-foreground/40',
  soft: 'bg-muted text-muted-foreground border-border',
  dot: 'bg-muted-foreground/60',
} as const;

const hash = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

export type PractitionerColor = typeof PALETTE[number] | typeof UNASSIGNED;

export const getPractitionerColor = (staffId: string | null | undefined): PractitionerColor => {
  if (!staffId) return UNASSIGNED;
  return PALETTE[hash(staffId) % PALETTE.length];
};
