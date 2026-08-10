import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useAuth } from '@/hooks/useAuth';
import {
  useReassignPractitioner,
  hasClinicalWorkStarted,
} from '@/hooks/useVisitAssignment';
import type { ClientVisitLog } from '@/hooks/useClientVisits';

interface Props {
  open: boolean;
  onClose: () => void;
  visit: ClientVisitLog;
}

/**
 * Reassign the practitioner on an active visit. If clinical work has
 * already begun, an admin override with a written reason is required
 * (enforced both here and by the RPC).
 */
const ReassignPractitionerDialog = ({ open, onClose, visit }: Props) => {
  const { isAdmin } = useAuth();
  const { data: staff = [] } = useRealStaff();
  const reassign = useReassignPractitioner();

  const practitioners = useMemo(
    () => staff.filter((s) => s.roles?.includes('medical_aesthetician')),
    [staff],
  );

  const clinicalStarted = hasClinicalWorkStarted(visit);
  const canProceed = !clinicalStarted || isAdmin;

  const [target, setTarget] = useState<string>(
    visit.assigned_medical_expert_id ?? '',
  );
  const [reason, setReason] = useState('');

  const submit = async () => {
    if (clinicalStarted && !isAdmin) {
      toast.error('Only an admin can reassign after clinical work has begun.');
      return;
    }
    if (clinicalStarted && !reason.trim()) {
      toast.error('A written reason is required.');
      return;
    }
    try {
      await reassign.mutateAsync({
        visit_id: visit.id,
        practitioner_id: target || null,
        reason: clinicalStarted ? reason.trim() : null,
      });
      toast.success('Practitioner reassigned');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reassign');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign practitioner</DialogTitle>
          <DialogDescription>
            {clinicalStarted
              ? 'Clinical work has already started on this visit. Reassignment requires an admin override with a written reason.'
              : 'Choose a new practitioner. Reassignment is free while no clinical work has been recorded.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Practitioner
            </Label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-sm text-foreground"
              disabled={!canProceed || reassign.isPending}
            >
              <option value="">Unassigned</option>
              {practitioners.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name || s.email}
                </option>
              ))}
            </select>
          </div>

          {clinicalStarted && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Admin override reason
              </Label>
              <Textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is reassignment necessary after clinical work started?"
                disabled={!canProceed || reassign.isPending}
              />
              {!isAdmin && (
                <p className="text-[11px] text-amber-500">
                  Ask an admin to complete this reassignment.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={reassign.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canProceed || reassign.isPending}>
            {reassign.isPending ? 'Reassigning…' : 'Reassign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReassignPractitionerDialog;