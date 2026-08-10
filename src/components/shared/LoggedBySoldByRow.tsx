import { Lock, UserCheck } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface StaffOption {
  id: string;
  full_name: string;
}

interface Props {
  loggedByName: string | null | undefined;
  soldById: string;
  onSoldByChange: (id: string) => void;
  staffOptions: StaffOption[];
  /** Compact variant (used in tight sheets like LiveOutreach). */
  compact?: boolean;
  disabled?: boolean;
}

/**
 * Shared attribution row for every staff-assisted sale form.
 * Always renders BOTH:
 *   - "Logged by" : current user (read-only, audit only)
 *   - "Sold by"   : selectable attributed staff (drives reporting)
 */
const LoggedBySoldByRow = ({
  loggedByName,
  soldById,
  onSoldByChange,
  staffOptions,
  compact = false,
  disabled = false,
}: Props) => {
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/30 px-3 py-2">
        <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">Logged by</p>
          <p className="text-sm font-medium truncate">{loggedByName ?? '—'}</p>
        </div>
        <span className="ml-auto text-[10px] text-muted-foreground">audit only</span>
      </div>
      <div>
        <Label className="text-xs flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5 text-primary" />
          Sold by <span className="text-muted-foreground font-normal">(attributed staff)</span>
        </Label>
        <select
          value={soldById}
          onChange={(e) => onSoldByChange(e.target.value)}
          disabled={disabled}
          className="w-full mt-1 bg-surface border border-border/60 rounded-md px-3 h-10 text-sm"
        >
          <option value="">— pick staff —</option>
          {staffOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.full_name}</option>
          ))}
        </select>
        <p className="text-[10px] text-muted-foreground mt-1">
          Drives staff performance, commissions and leaderboards.
        </p>
      </div>
    </div>
  );
};

export default LoggedBySoldByRow;