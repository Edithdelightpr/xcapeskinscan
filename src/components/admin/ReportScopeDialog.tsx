import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReportScope } from '@/lib/clientReportPdf';

const SCOPES: { id: ReportScope; label: string; desc: string }[] = [
  { id: 'current_visit', label: 'Current Visit',     desc: "Today's assessment, accepted services, session 1 of plan." },
  { id: 'progress',      label: 'Progress Update',   desc: 'Latest assessment + sessions completed so far.' },
  { id: 'full_history',  label: 'Full Client History', desc: 'Everything on file — assessments, sessions, follow-ups.' },
  { id: 'final_summary', label: 'Final Summary',     desc: 'Closing report after the plan is completed.' },
  { id: 'assessment_only', label: 'Assessment Only', desc: 'No treatment yet — recommendations on file.' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onGenerate: (args: { scope: ReportScope; includeSensitiveNotes: boolean; sendAfter: boolean }) => Promise<void> | void;
  onPreview?: (args: { scope: ReportScope; includeSensitiveNotes: boolean }) => Promise<void> | void;
  busy?: boolean;
  defaultScope?: ReportScope;
  clientHasPhone?: boolean;
  clientHasEmail?: boolean;
}

const ReportScopeDialog = ({ open, onClose, onGenerate, onPreview, busy, defaultScope = 'current_visit', clientHasPhone, clientHasEmail }: Props) => {
  const [scope, setScope] = useState<ReportScope>(defaultScope);
  const [includeSensitive, setIncludeSensitive] = useState(false);
  const [sendAfter, setSendAfter] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Generate report</DialogTitle>
          <DialogDescription>
            Choose a scope. Each generation creates a versioned snapshot — older reports are never overwritten.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {SCOPES.map((s) => {
            const active = scope === s.id;
            return (
              <button
                key={s.id}
                type="button"
                disabled={busy}
                onClick={() => setScope(s.id)}
                className={cn(
                  'w-full text-left p-3 rounded-lg border transition-all',
                  active ? 'border-primary bg-primary/5' : 'border-border/40 hover:border-border',
                )}
              >
                <p className="text-sm font-semibold">{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </button>
            );
          })}
        </div>

        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={includeSensitive} onCheckedChange={(v) => setIncludeSensitive(!!v)} className="mt-0.5" />
          <span>
            <span className="font-medium">Include internal safety/clinical notes</span>
            <span className="block text-xs text-muted-foreground">Off by default. Only turn on for internal copies.</span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={sendAfter}
            disabled={!clientHasEmail && !clientHasPhone}
            onCheckedChange={(v) => setSendAfter(!!v)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Send to client after generating</span>
            <span className="block text-xs text-muted-foreground">
              {clientHasEmail
                ? 'Sends a real email with a secure 7-day download link.'
                : clientHasPhone
                  ? 'No email on file — WhatsApp delivery (simulated until provider connected).'
                  : 'Client has no email or phone on file — send disabled.'}
            </span>
          </span>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          {onPreview && (
            <Button
              variant="outline"
              onClick={() => onPreview({ scope, includeSensitiveNotes: includeSensitive })}
              disabled={busy}
            >
              <Eye className="w-4 h-4 mr-1.5" />
              Preview
            </Button>
          )}
          <Button
            onClick={() => onGenerate({ scope, includeSensitiveNotes: includeSensitive, sendAfter })}
            disabled={busy}
            className="glow-primary"
          >
            {busy && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            Generate &amp; save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportScopeDialog;