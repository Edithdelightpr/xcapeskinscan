import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { RANGE_PRESETS, ReportRangeKey } from '@/lib/reportRanges';

interface Props {
  rangeKey: ReportRangeKey;
  customStart?: Date;
  customEnd?: Date;
  onChange: (key: ReportRangeKey, custom?: { start: Date; end: Date }) => void;
}

export const ReportRangePicker = ({ rangeKey, customStart, customEnd, onChange }: Props) => {
  const [start, setStart] = useState<Date | undefined>(customStart);
  const [end, setEnd] = useState<Date | undefined>(customEnd);
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {RANGE_PRESETS.map((p) => (
        <Button
          key={p.key}
          size="sm"
          variant={rangeKey === p.key ? 'default' : 'outline'}
          onClick={() => onChange(p.key)}
        >
          {p.label}
        </Button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant={rangeKey === 'custom' ? 'default' : 'outline'} className="gap-2">
            <CalendarIcon className="w-4 h-4" />
            {rangeKey === 'custom' && start && end
              ? `${format(start, 'MMM d')} → ${format(end, 'MMM d')}`
              : 'Custom range'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3 space-y-2" align="end">
          <div className="text-xs font-medium">Start</div>
          <Calendar mode="single" selected={start} onSelect={setStart} className={cn('p-0 pointer-events-auto')} />
          <div className="text-xs font-medium pt-2">End</div>
          <Calendar mode="single" selected={end} onSelect={setEnd} className={cn('p-0 pointer-events-auto')} />
          <Button
            size="sm"
            className="w-full"
            disabled={!start || !end}
            onClick={() => {
              if (start && end) {
                onChange('custom', { start, end });
                setOpen(false);
              }
            }}
          >
            Apply
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
};