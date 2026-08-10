import type { Database } from '@/integrations/supabase/types';

export type PipelineStage = Database['public']['Enums']['pipeline_stage'];

export const PIPELINE_STAGES: { id: PipelineStage; label: string }[] = [
  { id: 'new',         label: 'New' },
  { id: 'contacted',   label: 'Contacted' },
  { id: 'interested',  label: 'Interested' },
  { id: 'booked',      label: 'Booked' },
  { id: 'showed',      label: 'Showed' },
  { id: 'paid',        label: 'Paid' },
  { id: 'lost',        label: 'Lost' },
];

export const stageColor = (s: PipelineStage): string => {
  switch (s) {
    case 'new':        return 'bg-primary/15 text-primary';
    case 'contacted':  return 'bg-blue-500/15 text-blue-300';
    case 'interested': return 'bg-fuchsia-500/15 text-fuchsia-300';
    case 'booked':     return 'bg-amber-500/15 text-amber-700 font-semibold';
    case 'showed':     return 'bg-emerald-500/15 text-emerald-300';
    case 'paid':       return 'bg-green-500/25 text-green-300';
    case 'lost':       return 'bg-destructive/20 text-destructive';
  }
};

export const stageLabel = (s: PipelineStage): string =>
  PIPELINE_STAGES.find((p) => p.id === s)?.label ?? s;

interface Props {
  value: PipelineStage;
  onChange: (next: PipelineStage) => void;
  disabled?: boolean;
  className?: string;
}

const PipelineStageSelect = ({ value, onChange, disabled, className }: Props) => (
  <div className={`flex items-center gap-1.5 ${className ?? ''}`}>
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${stageColor(value)}`}>
      {stageLabel(value)}
    </span>
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as PipelineStage)}
      className="h-7 rounded-md bg-surface border border-border/60 px-1.5 text-[11px] text-foreground"
      title="Change pipeline stage"
    >
      {PIPELINE_STAGES.map((s) => (
        <option key={s.id} value={s.id}>{s.label}</option>
      ))}
    </select>
  </div>
);

export default PipelineStageSelect;
