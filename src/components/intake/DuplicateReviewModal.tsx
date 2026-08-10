import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, UserCheck, UserPlus, Mail, Phone, Hash } from 'lucide-react';
import { format } from 'date-fns';
import { type DupeMatch, reasonLabel } from '@/lib/clientDedupe';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  matches: DupeMatch[];
  /** What the user just typed — shown for context. */
  attempted: { full_name: string; phone?: string | null; email?: string | null };
  /** User confirmed "yes this is them" → reuse this client_id. */
  onReuse: (clientId: string) => void;
  /** User confirmed all matches are different people → proceed with new insert. */
  onCreateNew: () => void;
}

const DuplicateReviewModal = ({ open, onOpenChange, matches, attempted, onReuse, onCreateNew }: Props) => {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = matches.filter((m) => !dismissed.has(m.client.id));
  const allDismissed = visible.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border/60">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <AlertTriangle className="w-5 h-5 text-primary" />
            Possible duplicate found
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            We already have {matches.length === 1 ? 'a record' : `${matches.length} records`} that
            could be the same person. Is this them, or is this a fresh entry?
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg bg-surface/60 border border-border/40 p-3 text-xs space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">You're saving</p>
          <p className="text-foreground font-medium">{attempted.full_name || '—'}</p>
          <p className="text-muted-foreground">
            {attempted.phone || '—'} · {attempted.email || '—'}
          </p>
        </div>

        {allDismissed ? (
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm text-foreground">
            All matches dismissed. You can now create this as a brand-new client.
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {visible.map(({ client, reasons }) => (
              <div
                key={client.id}
                className="rounded-lg border border-border/50 bg-surface/40 p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{client.full_name}</p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                      <Hash className="w-3 h-3" /> {client.client_code}
                      <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] uppercase tracking-wider">
                        {client.membership_type}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {reasons.map((r) => (
                      <span
                        key={r}
                        className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          r === 'name_match'
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-destructive/15 text-destructive'
                        }`}
                      >
                        {reasonLabel(r)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground space-y-0.5">
                  {client.phone && (
                    <p className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {client.phone}</p>
                  )}
                  {client.email && (
                    <p className="flex items-center gap-1.5"><Mail className="w-3 h-3" /> {client.email}</p>
                  )}
                  {client.last_contact_date && (
                    <p>Last contact {format(new Date(client.last_contact_date), 'MMM d, yyyy')}</p>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1 glow-primary"
                    onClick={() => onReuse(client.id)}
                  >
                    <UserCheck className="w-3.5 h-3.5 mr-1.5" /> Yes, this is them
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDismissed((s) => new Set(s).add(client.id))}
                  >
                    Different person
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant={allDismissed ? 'default' : 'outline'}
            disabled={!allDismissed}
            onClick={onCreateNew}
            className={allDismissed ? 'glow-primary' : ''}
            title={allDismissed ? 'Create as new client' : 'Resolve each match above first'}
          >
            <UserPlus className="w-4 h-4 mr-1.5" /> Create as new client
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DuplicateReviewModal;