import { useState } from 'react';
import { Calendar as CalendarIcon, Plus, MapPin, User, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useClientAppointments,
  useUpdateAppointmentStatus,
  type AppointmentStatus,
  type RealAppointment,
} from '@/hooks/useRealAppointments';
import { useRealStaff } from '@/hooks/useRealStaff';
import AppointmentModal from '@/components/admin/AppointmentModal';
import PaymentStatusChip from '@/components/admin/PaymentStatusChip';
import type { RealClient } from '@/hooks/useRealClients';
import { toast } from 'sonner';

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  scheduled: 'bg-primary/15 text-primary border-primary/30',
  arrived: 'bg-accent/20 text-accent border-accent/40',
  completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  cancelled: 'bg-muted text-muted-foreground border-border',
  no_show: 'bg-destructive/15 text-destructive border-destructive/30',
};

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  arrived: 'Arrived',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

const ClientBookingsTab = ({ client }: { client: RealClient }) => {
  const { data: appts = [], isLoading } = useClientAppointments(client.id);
  const { data: staff = [] } = useRealStaff();
  const updateStatus = useUpdateAppointmentStatus();
  const [modalOpen, setModalOpen] = useState(false);
  const [walkIn, setWalkIn] = useState(false);
  const [editTarget, setEditTarget] = useState<RealAppointment | null>(null);

  const staffName = (id?: string | null) => staff.find((s) => s.id === id)?.full_name ?? 'Unassigned';

  const setStatus = async (id: string, status: AppointmentStatus) => {
    try {
      await updateStatus.mutateAsync({ id, status });
      toast.success(`Marked ${STATUS_LABEL[status].toLowerCase()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  const openEdit = (a: RealAppointment) => {
    setEditTarget(a);
    setWalkIn(false);
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setEditTarget(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-foreground flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-primary" /> Bookings
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Past visits and upcoming appointments.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setWalkIn(true); setModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-1.5" /> Walk-In
          </Button>
          <Button onClick={() => { setWalkIn(false); setModalOpen(true); }} className="glow-primary">
            <Plus className="w-4 h-4 mr-1.5" /> Schedule
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && appts.length === 0 && (
        <div className="glass rounded-xl p-10 text-center text-sm text-muted-foreground">
          No appointments yet. Schedule the first visit above.
        </div>
      )}

      <div className="space-y-2">
        {appts.map((a) => {
          const status = ((a as unknown as { status?: AppointmentStatus }).status ?? 'scheduled') as AppointmentStatus;
          const isWalk = !!(a as unknown as { is_walk_in?: boolean }).is_walk_in;
          return (
            <div key={a.id} className="glass rounded-xl p-4 space-y-3 hover:border-primary/40 border border-transparent transition-colors">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => openEdit(a)}
                  className="text-left flex-1 min-w-0 group"
                  title="Click to edit / reschedule"
                >
                  <p className="text-sm font-semibold text-foreground">{a.treatment}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {a.date} · {a.time}</span>
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> {staffName(a.attributed_staff_id)}</span>
                    {a.source && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {a.source}</span>}
                    <span className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-primary transition-opacity">
                      <Pencil className="w-3 h-3" /> Edit
                    </span>
                  </p>
                </button>
                <div className="flex flex-col items-end gap-1">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${STATUS_STYLES[status]}`}>
                    {STATUS_LABEL[status]}
                  </span>
                  {isWalk && <span className="text-[9px] uppercase tracking-wider text-accent">Walk-in</span>}
                  <PaymentStatusChip status={(a as { payment_status?: string }).payment_status} />
                </div>
              </div>
              {a.notes && <p className="text-xs text-muted-foreground italic">{a.notes}</p>}
              <div className="flex flex-wrap gap-1.5 pt-1 items-center">
                <button
                  onClick={() => openEdit(a)}
                  className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/15 text-primary hover:bg-primary/25 transition-colors inline-flex items-center gap-1"
                >
                  <Pencil className="w-3 h-3" /> Edit / Reschedule
                </button>
                {(['scheduled', 'arrived', 'completed', 'cancelled', 'no_show'] as AppointmentStatus[])
                  .filter((s) => s !== status)
                  .map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(a.id, s)}
                      className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
                    >
                      → {STATUS_LABEL[s]}
                    </button>
                  ))}
              </div>
            </div>
          );
        })}
      </div>

      <AppointmentModal
        open={modalOpen}
        onClose={closeModal}
        defaultClient={client}
        isWalkIn={walkIn}
        editAppointment={editTarget}
      />
    </div>
  );
};

export default ClientBookingsTab;