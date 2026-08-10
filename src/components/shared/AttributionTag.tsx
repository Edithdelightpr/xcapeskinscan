import { UserCheck, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  soldByName?: string | null;
  loggedByName?: string | null;
  /** Show the "Logged by" half — useful on pending rows where the two often differ. */
  showLoggedBy?: boolean;
  className?: string;
}

/**
 * Inline attribution chip showing "Sold by …" (and optionally "Logged by …").
 * Use on every place a sale row is displayed.
 */
const AttributionTag = ({ soldByName, loggedByName, showLoggedBy, className }: Props) => {
  if (!soldByName && !loggedByName) return null;
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground', className)}>
      {soldByName && (
        <span className="inline-flex items-center gap-1">
          <UserCheck className="w-3 h-3 text-primary/80" />
          <span>Sold by <span className="text-foreground font-medium">{soldByName}</span></span>
        </span>
      )}
      {showLoggedBy && loggedByName && loggedByName !== soldByName && (
        <span className="inline-flex items-center gap-1">
          <PenLine className="w-3 h-3" />
          <span>Logged by {loggedByName}</span>
        </span>
      )}
    </span>
  );
};

export default AttributionTag;