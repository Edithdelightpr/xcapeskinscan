import { useMemo, useState } from 'react';
import { useTodaysAttendance, useStaffSignOut, useStaffSignIn } from '@/hooks/useStaffAttendance';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty, CommandGroup } from '@/components/ui/command';
import { CheckCircle2, Circle, MinusCircle, LogOut, LogIn, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import ProxyStaffSignOutReportModal from './ProxyStaffSignOutReportModal';

const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—';

/**
 * Today's staff roster — visible to admins / front desk.
 * Lists every staff member with their attendance state.
 */
const StaffAttendanceToday = () => {
  const { data: attendance = [] } = useTodaysAttendance();
  const { data: staff = [] } = useRealStaff();
  const { user } = useAuth();
  const signOut = useStaffSignOut();
  const signIn = useStaffSignIn();
  // Anyone signed in to the workspace can manage attendance for the team.
  // Permissions are enforced at the database (RLS) layer.
  const canManage = !!user;
  const [bulkBusy, setBulkBusy] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ attendanceId: string; staffUserId: string; staffName: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const byStaff = useMemo(
    () => Object.fromEntries(attendance.map((a) => [a.staff_user_id, a])),
    [attendance],
  );
  const staffNameById = useMemo(
    () => Object.fromEntries(staff.map((s) => [s.id, s.full_name || s.email])),
    [staff],
  );

  const activeStaff = staff.filter((s) => s.status === 'active');

  const counts = {
    in: attendance.filter((a) => a.status === 'signed_in').length,
    out: attendance.filter((a) => a.status === 'signed_out').length,
    absent: activeStaff.filter((s) => !byStaff[s.id]).length,
  };

  /**
   * Opening the report gate is what initiates a teammate sign-out. The
   * actual attendance update only fires after the wrap-up report is saved.
   */
  const beginProxySignOut = (attendanceId: string, staffUserId: string, staffName: string) => {
    if (!user) return;
    setReportTarget({ attendanceId, staffUserId, staffName });
  };

  const completeProxySignOut = async (payload: { notes: string }) => {
    if (!user || !reportTarget) return;
    try {
      await signOut.mutateAsync({
        id: reportTarget.attendanceId,
        end_of_day_notes: payload.notes ? { completed: payload.notes } : null,
        signed_out_by: user.id,
      });
      toast.success(`${reportTarget.staffName} signed out`);
      setReportTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to sign out');
      throw e;
    }
  };

  const handleProxySignIn = async (staffUserId: string) => {
    if (!user) return;
    try {
      await signIn.mutateAsync({ staff_user_id: staffUserId, signed_in_by: user.id });
      toast.success('Staff signed in');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to sign in');
    }
  };

  const absentStaff = activeStaff.filter((s) => !byStaff[s.id]);
  const signedInRows = attendance.filter((a) => a.status === 'signed_in');

  const handleSignInAll = async () => {
    // "Absent" here means "no row yet today OR already signed out today".
    const targets = activeStaff.filter((s) => {
      const a = byStaff[s.id];
      return !a || a.status !== 'signed_in';
    });
    if (!user || targets.length === 0) return;
    if (!window.confirm(`Sign in ${targets.length} teammate${targets.length === 1 ? '' : 's'}?`)) return;
    setBulkBusy(true);
    const results = await Promise.allSettled(
      targets.map((s) => signIn.mutateAsync({ staff_user_id: s.id, signed_in_by: user.id })),
    );
    setBulkBusy(false);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    toast.success(`Signed in ${ok} teammate${ok === 1 ? '' : 's'}${failed ? ` · ${failed} failed` : ''}`);
  };

  const selectedStaff = selectedId ? activeStaff.find((s) => s.id === selectedId) ?? null : null;
  const selectedAttendance = selectedId ? byStaff[selectedId] ?? null : null;
  const selectedStatus: 'absent' | 'signed_in' | 'signed_out' =
    selectedAttendance?.status === 'signed_in'
      ? 'signed_in'
      : selectedAttendance?.status === 'signed_out'
        ? 'signed_out'
        : 'absent';

  const statusPill = (status: 'absent' | 'signed_in' | 'signed_out') => {
    const cls = status === 'signed_in'
      ? 'bg-primary/15 text-primary border-primary/30'
      : status === 'signed_out'
        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
        : 'bg-muted text-muted-foreground border-border';
    return (
      <span className={`inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${cls}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="glass rounded-xl p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-display font-bold text-foreground">Staff attendance — today</h2>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1 text-primary"><CheckCircle2 className="w-3.5 h-3.5" />{counts.in} in</span>
          <span className="inline-flex items-center gap-1 text-emerald-300"><Circle className="w-3.5 h-3.5" />{counts.out} signed out</span>
          <span className="inline-flex items-center gap-1 text-muted-foreground"><MinusCircle className="w-3.5 h-3.5" />{counts.absent} absent</span>
        </div>
      </div>

      {canManage && (
        <p className="text-xs text-muted-foreground">
          Search any teammate to sign them in or out — actions are recorded with your name.
        </p>
      )}

      {activeStaff.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No active staff configured.</p>
      ) : (
        <div className="space-y-3">
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={pickerOpen}
                className="w-full justify-between h-11 font-normal"
              >
                {selectedStaff ? (
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="truncate text-foreground">{selectedStaff.full_name || selectedStaff.email}</span>
                    {statusPill(selectedStatus)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Search staff to sign in or out…</span>
                )}
                <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="p-0 w-[var(--radix-popover-trigger-width)] bg-popover"
              align="start"
            >
              <Command>
                <CommandInput placeholder="Type a name…" />
                <CommandList>
                  <CommandEmpty>No staff found.</CommandEmpty>
                  <CommandGroup>
                    {activeStaff.map((s) => {
                      const a = byStaff[s.id];
                      const status = (a?.status ?? 'absent') as 'absent' | 'signed_in' | 'signed_out';
                      const meta = status === 'signed_in'
                        ? `since ${fmtTime(a?.sign_in_time ?? null)}`
                        : status === 'signed_out'
                          ? `${fmtTime(a?.sign_in_time ?? null)} → ${fmtTime(a?.sign_out_time ?? null)}`
                          : 'not signed in';
                      const label = s.full_name || s.email || '';
                      return (
                        <CommandItem
                          key={s.id}
                          value={`${label} ${s.email ?? ''}`}
                          onSelect={() => {
                            setSelectedId(s.id);
                            setPickerOpen(false);
                          }}
                          className="flex items-center justify-between gap-3"
                        >
                          <span className="flex flex-col min-w-0">
                            <span className="text-sm text-foreground truncate">{label}</span>
                            <span className="text-[11px] text-muted-foreground truncate">{meta}</span>
                          </span>
                          {statusPill(status)}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {selectedStaff && canManage && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg bg-surface/50 border border-border/30 p-3">
              <div className="text-xs text-muted-foreground min-w-0">
                {selectedStatus === 'signed_in' && (
                  <>Signed in at <span className="text-foreground">{fmtTime(selectedAttendance?.sign_in_time ?? null)}</span></>
                )}
                {selectedStatus === 'signed_out' && (
                  <>
                    Worked <span className="text-foreground">{selectedAttendance?.duration_minutes != null ? `${(selectedAttendance.duration_minutes / 60).toFixed(1)} h` : '—'}</span>
                    {' · out at '}<span className="text-foreground">{fmtTime(selectedAttendance?.sign_out_time ?? null)}</span>
                  </>
                )}
                {selectedStatus === 'absent' && <>Not signed in yet today.</>}
              </div>
              {selectedStatus === 'signed_in' && selectedAttendance ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={signOut.isPending || bulkBusy}
                  onClick={() => beginProxySignOut(selectedAttendance.id, selectedStaff.id, selectedStaff.full_name || selectedStaff.email || 'teammate')}
                  className="h-10"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1" /> Sign out {selectedStaff.full_name?.split(' ')[0] || 'teammate'}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={signIn.isPending || bulkBusy}
                  onClick={() => handleProxySignIn(selectedStaff.id)}
                  className="h-10"
                >
                  <LogIn className="w-3.5 h-3.5 mr-1" />
                  {selectedStatus === 'signed_out' ? 'Sign in again' : 'Sign in'} {selectedStaff.full_name?.split(' ')[0] || 'teammate'}
                </Button>
              )}
            </div>
          )}

          {canManage && counts.absent > 0 && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                disabled={bulkBusy}
                onClick={handleSignInAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <LogIn className="w-3.5 h-3.5 mr-1" /> Sign in everyone not in
              </Button>
            </div>
          )}
        </div>
      )}

      <ProxyStaffSignOutReportModal
        open={!!reportTarget}
        staffUserId={reportTarget?.staffUserId ?? null}
        staffName={reportTarget?.staffName ?? ''}
        onCancel={() => setReportTarget(null)}
        onConfirm={completeProxySignOut}
      />
    </div>
  );
};

export default StaffAttendanceToday;