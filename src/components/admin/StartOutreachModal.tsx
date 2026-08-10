import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateOutreachSession, OutreachType } from '@/hooks/useOutreachSessions';

const types: { value: OutreachType; label: string }[] = [
  { value: 'community', label: 'Community' },
  { value: 'event', label: 'Event' },
  { value: 'market', label: 'Market' },
  { value: 'clinic', label: 'Clinic visit' },
  { value: 'partner', label: 'Partner site' },
  { value: 'other', label: 'Other' },
];

const StartOutreachModal = ({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) => {
  const create = useCreateOutreachSession();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<OutreachType>('community');

  const submit = async () => {
    if (!name.trim() || !location.trim()) return;
    const id = await create.mutateAsync({
      name: name.trim(),
      location: location.trim(),
      outreach_date: date,
      outreach_type: type,
    });
    onCreated(id);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Start Outreach</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lekki Phase 1 Outreach" />
          </div>
          <div className="space-y-1.5">
            <Label>Location *</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Address or area" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <Select value={type} onValueChange={(v) => setType(v as OutreachType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {types.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Created as <strong>Draft</strong>. Complete the protocol checklist (roles, resources, expected outcomes) inside the outreach to submit for approval.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!name.trim() || !location.trim() || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create outreach'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StartOutreachModal;