import { useState, useEffect, useMemo } from 'react';
import { Loader2, ChevronUp, ChevronDown, Lock, ListOrdered, CalendarDays } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  usePlanSessions,
  usePlanScheduleItems,
  useSequencePlan,
  useSyncPlanAppointments,
  type PlanSessionLine,
  type PlanScheduleItem,
} from '@/hooks/useTreatmentPlanSequencing';
import { useRealStaff } from '@/hooks/useRealStaff';

interface Props {
  open: boolean;
  onClose: () => void;
  planId: string;
  title?: string;
  description?: string;
  saveLabel?: string;
}

interface Slot {
  key: string;
  session_id: string;
  service_name: string;
  line_session_number: number;
  planned_date: string | null;
  planned_interval_days: number | null;
  locked: boolean;
  lockedStatus?: PlanScheduleItem['status'];
  cost: number;
}

const fmt = (n: number) => '₦' + n.toLocaleString('en-NG', { maximumFractionDigits: 0 });

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (iso: string, days: number) => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const diffDaysISO = (a: string, b: string) => {
  const da = new Date(a + 'T00:00:00').getTime();
  const db = new Date(b + 'T00:00:00').getTime();
  return Math.round((da - db) / 86400000);
};

function buildInitialSlots(
  lines: PlanSessionLine[],
  existing: PlanScheduleItem[],
  firstDate: string,
  interval: number,
): Slot[] {
  if (existing.length) {
    return [...existing]
      .sort((a, b) => a.plan_sequence_number - b.plan_sequence_number)
      .map((it) => {
        const line = lines.find((l) => l.id === it.treatment_plan_session_id);
        return {
          key: it.id,
          session_id: it.treatment_plan_session_id,
          service_name: line?.service_name ?? 'Session',
          line_session_number: it.line_session_number,
          planned_date: it.planned_date,
          planned_interval_days: it.planned_interval_days,
          locked:
            it.status === 'performed' ||
            it.status === 'skipped' ||
            it.status === 'cancelled',
          lockedStatus: it.status,
          cost: Number(it.planned_unit_cost) || Number(line?.agreed_unit_price) || 0,
        };
      });
  }
  // Seed: one row per session; default rhythm = one per week.
  const slots: Slot[] = [];
  for (const line of lines) {
    for (let i = 1; i <= line.sessions_total; i++) {
      slots.push({
        key: `${line.id}:${i}`,
        session_id: line.id,
        service_name: line.service_name,
        line_session_number: i,
        planned_date: null,
        planned_interval_days: slots.length === 0 ? 0 : interval,
        locked: false,
        cost: Number(line.agreed_unit_price) || 0,
      });
    }
  }
  // Apply default weekly cascade.
  let cursor = firstDate;
  return slots.map((s, i) => {
    const date = i === 0 ? firstDate : addDaysISO(cursor, s.planned_interval_days ?? interval);
    cursor = date;
    return { ...s, planned_date: date };
  });
}

const SequenceTreatmentPlanDialog = ({
  open,
  onClose,
  planId,
  title,
  description,
  saveLabel,
}: Props) => {
  const { toast } = useToast();
  const { data: lines = [] } = usePlanSessions(planId);
  const { data: existing = [] } = usePlanScheduleItems(planId);
  const { data: staff = [] } = useRealStaff();
  const sequence = useSequencePlan();
  const syncAppts = useSyncPlanAppointments();

  const [slots, setSlots] = useState<Slot[]>([]);
  const [firstDate, setFirstDate] = useState<string>(todayISO());
  const [defaultInterval, setDefaultInterval] = useState<number>(7);
  const [defaultTime, setDefaultTime] = useState<string>('10:00');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [practitionerId, setPractitionerId] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const aestheticians = useMemo(
    () =>
      staff.filter(
        (s) =>
          (s.roles || []).includes('medical_aesthetician') ||
          (s.roles || []).includes('admin'),
      ),
    [staff],
  );

  useEffect(() => {
    if (!open) return;
    const firstPlanned = [...existing]
      .sort((a, b) => a.plan_sequence_number - b.plan_sequence_number)
      .find((e) => e.planned_date);
    const seedDate = firstPlanned?.planned_date ?? todayISO();
    setFirstDate(seedDate);
    setSlots(buildInitialSlots(lines, existing, seedDate, defaultInterval));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lines, existing]);

  useEffect(() => {
    if (practitionerId || aestheticians.length === 0) return;
    setPractitionerId(aestheticians[0].id);
  }, [aestheticians, practitionerId]);

  const totalCost = useMemo(() => slots.reduce((s, x) => s + x.cost, 0), [slots]);

  /** Walk from an anchor and re-space every unlocked following slot. */
  const respaceFrom = (arr: Slot[], anchorIdx: number, anchorDate: string): Slot[] => {
    let cursor = anchorDate;
    return arr.map((s, i) => {
      if (i < anchorIdx) return s;
      if (i === anchorIdx) {
        cursor = anchorDate;
        return { ...s, planned_date: anchorDate };
      }
      if (s.locked) {
        if (s.planned_date) cursor = s.planned_date;
        return s;
      }
      const interval = s.planned_interval_days ?? defaultInterval;
      cursor = addDaysISO(cursor, interval);
      return { ...s, planned_date: cursor };
    });
  };

  const applyWeeklyDefaults = () => {
    setSlots((prev) => {
      const seeded = prev.map((s, i) =>
        s.locked ? s : { ...s, planned_interval_days: i === 0 ? 0 : defaultInterval },
      );
      return respaceFrom(seeded, 0, firstDate || todayISO());
    });
  };

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= slots.length) return;
    if (slots[idx].locked || slots[target].locked) return;
    const next = [...slots];
    [next[idx], next[target]] = [next[target], next[idx]];
    const from = Math.min(idx, target);
    const anchor = from === 0 ? firstDate || todayISO() : next[from - 1].planned_date ?? firstDate;
    setSlots(respaceFrom(next, from, anchor));
  };

  const updateSlot = (idx: number, patch: Partial<Slot>) => {
    setSlots((prev) => {
      const merged = prev.map((s, i) => (i === idx ? { ...s, ...patch } : s));
      if (patch.planned_date) {
        return respaceFrom(merged, idx, patch.planned_date);
      }
      if (patch.planned_interval_days !== undefined && idx > 0) {
        const prevDate = merged[idx - 1].planned_date ?? firstDate;
        const newDate = addDaysISO(prevDate, patch.planned_interval_days ?? defaultInterval);
        return respaceFrom(merged, idx, newDate);
      }
      return merged;
    });
  };

  useEffect(() => {
    // When firstDate changes, re-space from index 0.
    setSlots((prev) => (prev.length ? respaceFrom(prev, 0, firstDate || todayISO()) : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstDate]);

  const base = firstDate || todayISO();
  const weekOf = (dateISO: string | null): number | null => {
    if (!dateISO) return null;
    const days = diffDaysISO(dateISO, base);
    if (days < 0) return null;
    return Math.floor(days / 7) + 1;
  };

  const submit = async () => {
    setSubmitError(null);
    try {
      const items = slots.map((s, i) => ({
        treatment_plan_session_id: s.session_id,
        plan_sequence_number: i + 1,
        line_session_number: s.line_session_number,
        planned_interval_days: s.planned_interval_days ?? null,
        planned_date: s.planned_date ?? null,
      }));
      await sequence.mutateAsync({ plan_id: planId, items });
      const res = await syncAppts.mutateAsync({
        plan_id: planId,
        default_time: defaultTime,
        assigned_aesthetician_id: practitionerId || null,
        duration_minutes: durationMinutes,
      });
      toast({
        title: 'Plan sequenced',
        description: `Appointments — ${res.created} created, ${res.updated} updated, ${res.cancelled} cancelled.`,
      });
      onClose();
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Unknown error';
      const friendly =
        raw === 'payment_required_before_sequencing'
          ? 'A payment must be confirmed on this treatment plan before it can be sequenced. Record or confirm a payment in the sign-out / payment claims workflow, then re-open Sequence treatment plan.'
          : raw;
      setSubmitError(friendly);
      toast({ title: 'Could not save sequence', description: friendly, variant: 'destructive' });
    }
  };

  const busy = sequence.isPending || syncAppts.isPending;
  const savingLabel = sequence.isPending
    ? 'Saving sequence…'
    : syncAppts.isPending
    ? 'Creating appointments…'
    : '';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto z-[300]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListOrdered className="w-5 h-5" /> {title ?? 'Sequence treatment plan'}
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          {description ??
            'Every accepted session is listed below in weekly order. The default rhythm is one session per week (7 days apart). Reorder rows, change the first date or an interval — following dates recalculate automatically. Saving will create one appointment per scheduled session.'}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 rounded-lg border p-3 bg-muted/30">
          <div>
            <Label className="text-[11px] text-muted-foreground">First session</Label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={firstDate}
              min={todayISO()}
              onChange={(e) => setFirstDate(e.target.value || todayISO())}
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Default interval (days)</Label>
            <Input
              type="number"
              min={1}
              className="h-8 text-xs"
              value={defaultInterval}
              onChange={(e) => setDefaultInterval(Math.max(1, Number(e.target.value) || 7))}
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Time</Label>
            <Input
              type="time"
              className="h-8 text-xs"
              value={defaultTime}
              onChange={(e) => setDefaultTime(e.target.value || '10:00')}
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Practitioner</Label>
            <Select value={practitionerId} onValueChange={setPractitionerId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select practitioner" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-[400]">
                {aestheticians.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name ?? s.email ?? s.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 md:col-span-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              Duration
              <Input
                type="number"
                min={15}
                step={15}
                className="h-6 text-xs w-20"
                value={durationMinutes}
                onChange={(e) =>
                  setDurationMinutes(Math.max(15, Number(e.target.value) || 60))
                }
              />
              min per session
            </div>
            <Button size="sm" variant="secondary" onClick={applyWeeklyDefaults} disabled={busy}>
              <CalendarDays className="w-3.5 h-3.5 mr-1" /> Apply weekly rhythm
            </Button>
          </div>
        </div>

        <div className="space-y-2 mt-3">
          {slots.map((slot, idx) => (
            <div
              key={slot.key}
              className={`rounded-lg border p-3 flex items-center gap-3 ${
                slot.locked ? 'bg-muted/50' : 'bg-background'
              }`}
            >
              <div className="w-16 text-center shrink-0">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Week
                </div>
                <div className="font-mono text-base font-semibold leading-tight">
                  {weekOf(slot.planned_date) ?? '—'}
                </div>
                <div className="text-[10px] text-muted-foreground">#{idx + 1}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{slot.service_name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    Session {slot.line_session_number}
                  </span>
                  {slot.locked && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Lock className="w-3 h-3" /> {slot.lockedStatus}
                    </Badge>
                  )}
                  <span className="text-[11px] text-muted-foreground">{fmt(slot.cost)}</span>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <Label className="text-[11px] text-muted-foreground">Date</Label>
                    <Input
                      type="date"
                      className="h-7 text-xs w-40"
                      value={slot.planned_date ?? ''}
                      min={todayISO()}
                      disabled={slot.locked}
                      onChange={(e) => updateSlot(idx, { planned_date: e.target.value || null })}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Label className="text-[11px] text-muted-foreground">
                      Interval from prev (days)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      className="h-7 text-xs w-20"
                      value={slot.planned_interval_days ?? (idx === 0 ? 0 : defaultInterval)}
                      disabled={slot.locked || idx === 0}
                      onChange={(e) =>
                        updateSlot(idx, {
                          planned_interval_days: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => move(idx, -1)}
                  disabled={slot.locked || idx === 0 || slots[idx - 1]?.locked}
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => move(idx, 1)}
                  disabled={slot.locked || idx === slots.length - 1 || slots[idx + 1]?.locked}
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          {slots.length === 0 && (
            <p className="text-xs text-muted-foreground">No sessions available to sequence.</p>
          )}
        </div>

        <div className="text-xs text-muted-foreground mt-2">
          Total sessions: {slots.length} · Plan cost: {fmt(totalCost)}
        </div>

        {submitError && (
          <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {submitError}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={
              busy ||
              slots.length === 0 ||
              slots.some((s) => !s.locked && !s.planned_date)
            }
            className="glow-primary"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> {savingLabel}
              </>
            ) : (
              saveLabel ?? 'Save sequence & create appointments'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SequenceTreatmentPlanDialog;
