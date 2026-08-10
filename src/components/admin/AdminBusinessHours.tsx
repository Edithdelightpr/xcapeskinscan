import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { toast } from 'sonner';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface HourRow {
  day_of_week: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
  is_24h: boolean;
}

interface SettingsRow {
  id: boolean;
  slot_minutes: number;
  max_days_ahead: number;
}

const trim = (t: string) => (t ? t.slice(0, 5) : '09:00');

const AdminBusinessHours = () => {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const perms = useEffectivePermissions();
  const canEdit = isAdmin || perms.sections.has('admin-hours');

  const hoursQ = useQuery({
    queryKey: ['business_hours'],
    queryFn: async (): Promise<HourRow[]> => {
      const { data, error } = await supabase
        .from('business_hours')
        .select('day_of_week,is_open,open_time,close_time,is_24h')
        .order('day_of_week');
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, open_time: trim(r.open_time), close_time: trim(r.close_time) }));
    },
  });

  const settingsQ = useQuery({
    queryKey: ['booking_settings'],
    queryFn: async (): Promise<SettingsRow | null> => {
      const { data, error } = await supabase
        .from('booking_settings')
        .select('id,slot_minutes,max_days_ahead')
        .eq('id', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [draft, setDraft] = useState<HourRow[]>([]);
  const [slotMin, setSlotMin] = useState<number>(60);
  const [maxDays, setMaxDays] = useState<number>(90);

  useEffect(() => {
    if (hoursQ.data) setDraft(hoursQ.data);
  }, [hoursQ.data]);
  useEffect(() => {
    if (settingsQ.data) {
      setSlotMin(settingsQ.data.slot_minutes);
      setMaxDays(settingsQ.data.max_days_ahead);
    }
  }, [settingsQ.data]);

  const saveHours = useMutation({
    mutationFn: async () => {
      // Upsert-equivalent: per-row update.
      for (const r of draft) {
        const { error } = await supabase
          .from('business_hours')
          .update({
            is_open: r.is_open,
            open_time: r.is_24h ? '00:00' : r.open_time,
            close_time: r.is_24h ? '23:59' : r.close_time,
            is_24h: r.is_24h,
          })
          .eq('day_of_week', r.day_of_week);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Hours saved');
      qc.invalidateQueries({ queryKey: ['business_hours'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not save hours'),
  });

  const saveSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('booking_settings')
        .update({ slot_minutes: slotMin, max_days_ahead: maxDays })
        .eq('id', true);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Settings saved');
      qc.invalidateQueries({ queryKey: ['booking_settings'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not save settings'),
  });

  if (!canEdit) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <p className="text-sm text-muted-foreground">You don't have access to this tab.</p>
      </div>
    );
  }

  const updateRow = (idx: number, patch: Partial<HourRow>) => {
    setDraft((d) => d.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Business Hours</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Control when clients can self-book through your public booking link. Closed days & 24-hour mode supported.
        </p>
      </div>

      {/* Session settings */}
      <section className="glass rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <h2 className="font-display font-bold text-foreground">Booking Settings</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Session length</label>
            <select
              value={slotMin}
              onChange={(e) => setSlotMin(Number(e.target.value))}
              className="w-full mt-1 bg-surface border border-border/60 rounded-md px-3 py-2 text-sm text-foreground"
            >
              <option value={60}>60 minutes (recommended minimum)</option>
              <option value={75}>75 minutes</option>
              <option value={90}>90 minutes</option>
              <option value={120}>120 minutes</option>
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Each client gets at least this much time. Slots are spaced by this length.
            </p>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Booking window (days ahead)</label>
            <input
              type="number"
              min={1}
              max={365}
              value={maxDays}
              onChange={(e) => setMaxDays(Number(e.target.value) || 90)}
              className="w-full mt-1 bg-surface border border-border/60 rounded-md px-3 py-2 text-sm text-foreground"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => saveSettings.mutate()}
            disabled={saveSettings.isPending}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {saveSettings.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save settings
          </button>
        </div>
      </section>

      {/* Per-day hours */}
      <section className="glass rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <h2 className="font-display font-bold text-foreground">Weekly Schedule</h2>
        </div>
        {hoursQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-2">
            {draft.map((r, i) => (
              <div
                key={r.day_of_week}
                className="grid grid-cols-12 gap-2 items-center p-3 rounded-lg bg-surface/40"
              >
                <div className="col-span-3 text-sm font-medium text-foreground">{DAY_LABELS[r.day_of_week]}</div>
                <label className="col-span-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={r.is_open}
                    onChange={(e) => updateRow(i, { is_open: e.target.checked })}
                    className="rounded"
                  />
                  Open
                </label>
                <label className="col-span-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={r.is_24h}
                    onChange={(e) => updateRow(i, { is_24h: e.target.checked })}
                    disabled={!r.is_open}
                    className="rounded"
                  />
                  24 hours
                </label>
                <input
                  type="time"
                  value={r.open_time}
                  disabled={!r.is_open || r.is_24h}
                  onChange={(e) => updateRow(i, { open_time: e.target.value })}
                  className="col-span-2 bg-background border border-border/60 rounded-md px-2 py-1.5 text-sm text-foreground disabled:opacity-50"
                />
                <input
                  type="time"
                  value={r.close_time}
                  disabled={!r.is_open || r.is_24h}
                  onChange={(e) => updateRow(i, { close_time: e.target.value })}
                  className="col-span-2 bg-background border border-border/60 rounded-md px-2 py-1.5 text-sm text-foreground disabled:opacity-50"
                />
                <div className="col-span-1 text-right text-[11px] text-muted-foreground">
                  {!r.is_open ? 'Closed' : r.is_24h ? '24h' : `${r.open_time}–${r.close_time}`}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end pt-2">
          <button
            onClick={() => saveHours.mutate()}
            disabled={saveHours.isPending}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {saveHours.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save schedule
          </button>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Tip: capacity is automatically calculated from the number of active medical aestheticians on your team.
        If only one aesthetician is active, only one client can book each slot.
      </p>
    </div>
  );
};

export default AdminBusinessHours;