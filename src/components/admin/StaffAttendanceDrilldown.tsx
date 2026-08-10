import { useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { StaffAttendanceLog } from '@/hooks/useStaffAttendance';
import type { DailyOutcomeRow } from '@/lib/attendanceAnalytics';

interface StaffLite {
  id: string;
  full_name: string | null;
  email: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  staffId: string | null;
  staff: StaffLite[];
  attendance: StaffAttendanceLog[];
  outcomes: DailyOutcomeRow[];
}

const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—';

const StaffAttendanceDrilldown = ({ open, onClose, staffId, staff, attendance, outcomes }: Props) => {
  const staffById = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s])), [staff]);
  const target = staffId ? staffById[staffId] : null;

  const days = useMemo(() => {
    if (!staffId) return [];
    const myAtt = attendance.filter((a) => a.staff_user_id === staffId);
    const myOut = outcomes.filter((o) => o.staff_user_id === staffId);
    const dates = new Set<string>([
      ...myAtt.map((a) => a.attendance_date),
      ...myOut.map((o) => o.outcome_date),
    ]);
    return Array.from(dates)
      .sort((a, b) => b.localeCompare(a))
      .map((date) => ({
        date,
        attendance: myAtt.find((a) => a.attendance_date === date) ?? null,
        outcomes: myOut.filter((o) => o.outcome_date === date),
      }));
  }, [staffId, attendance, outcomes]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{target?.full_name || target?.email || 'Staff'}</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 mt-4">
          {days.length === 0 && (
            <p className="text-sm text-muted-foreground">No activity in the selected window.</p>
          )}
          {days.map(({ date, attendance: a, outcomes: outs }) => {
            const inBy = a?.signed_in_by ? staffById[a.signed_in_by] : null;
            const outBy = a?.signed_out_by ? staffById[a.signed_out_by] : null;
            return (
              <div key={date} className="glass rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-display font-bold text-foreground">
                    {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {a?.duration_minutes != null ? `${(a.duration_minutes / 60).toFixed(1)} h` : a ? 'open' : 'no sign-in'}
                  </span>
                </div>
                {a ? (
                  <p className="text-xs text-muted-foreground">
                    In {fmtTime(a.sign_in_time)}
                    {inBy && a.signed_in_by !== a.staff_user_id && ` (by ${inBy.full_name || inBy.email})`}
                    {' · '}Out {fmtTime(a.sign_out_time)}
                    {outBy && a.signed_out_by !== a.staff_user_id && ` (by ${outBy.full_name || outBy.email})`}
                  </p>
                ) : (
                  <p className="text-xs text-amber-700 font-semibold">Outcomes recorded without an attendance sign-in.</p>
                )}
                {outs.length > 0 && (
                  <ul className="space-y-1 mt-2">
                    {outs.map((o) => (
                      <li key={o.id} className="flex items-center justify-between text-xs gap-2">
                        <span className="text-foreground truncate">{o.title}</span>
                        <span className={`shrink-0 inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          o.status === 'completed' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : o.status === 'skipped' ? 'bg-amber-500/10 text-amber-700 font-semibold border-amber-500/30'
                          : 'bg-muted text-muted-foreground border-border'
                        }`}>{o.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default StaffAttendanceDrilldown;