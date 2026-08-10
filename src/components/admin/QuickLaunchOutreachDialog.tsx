import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Zap } from 'lucide-react';
import { useQuickLaunchOutreach } from '@/hooks/useOutreachSessions';

/**
 * Admin-only shortcut: type a name, hit Enter, the outreach is created
 * and immediately transitioned to `active` so the crew can start capturing
 * intake. Everything else (date, type, crew) uses safe defaults and can
 * be edited later from the detail sheet.
 */
const QuickLaunchOutreachDialog = ({
  onClose,
  onLaunched,
}: {
  onClose: () => void;
  onLaunched: (id: string) => void;
}) => {
  const [name, setName] = useState('');
  const launch = useQuickLaunchOutreach();

  const submit = async () => {
    if (!name.trim() || launch.isPending) return;
    const id = await launch.mutateAsync({ name });
    onLaunched(id);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" /> Quick Launch Outreach
          </DialogTitle>
          <DialogDescription>
            Creates an outreach for today and sets it to <strong>Active</strong> immediately.
            You can edit location, crew and details afterwards.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-2">
          <Label>Outreach name *</Label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="e.g. Ikeja Pop-up"
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!name.trim() || launch.isPending} className="gap-2">
            <Zap className="w-4 h-4" />
            {launch.isPending ? 'Launching…' : 'Launch live'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuickLaunchOutreachDialog;