import { LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import {
  useMyAttendanceToday,
  useStaffSignIn,
  useStaffSignOut,
} from '@/hooks/useStaffAttendance';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useMemo } from 'react';
import { toast } from 'sonner';

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

/**
 * Staff self-service attendance card. Pinned to the signed-in user.
 * Includes the start-of-day & end-of-day forms required by the brief.
 */
const StaffAttendanceCard = () => {
  const { user, profile } = useAuth();
  const { data: today } = useMyAttendanceToday(user?.id);
  const { data: staff = [] } = useRealStaff();
  const signIn = useStaffSignIn();
  const signOut = useStaffSignOut();

  const signedInByName = useMemo(() => {
    if (!today?.signed_in_by || today.signed_in_by === today.staff_user_id) return null;
    const s = staff.find((x) => x.id === today.signed_in_by);
    return s?.full_name || s?.email || 'a teammate';
  }, [today, staff]);

  if (!user) return null;

  const isSignedIn = today?.status === 'signed_in';
  const isSignedOut = today?.status === 'signed_out';
  // "Can sign in" = no row yet OR previously signed out today.
  const canSignIn = !today || isSignedOut;

  const handleSignIn = async () => {
    try {
      await signIn.mutateAsync({
        staff_user_id: user.id,
        location: null,
        start_of_day_notes: null,
        signed_in_by: user.id,
      });
      toast.success('Signed in for today');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to sign in');
    }
  };

  const handleSignOut = async () => {
    if (!today) return;
    try {
      await signOut.mutateAsync({ id: today.id, end_of_day_notes: null, signed_out_by: user.id });
      toast.success('Signed out for today');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to sign out');
    }
  };

  return (
    <div className="glass rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">My attendance — today</p>
          <p className="text-sm font-display font-bold text-foreground mt-0.5">
            {profile?.full_name || profile?.email || 'You'}
          </p>
          {today && today.sign_in_time && (
            <p className="text-xs text-muted-foreground mt-1">
              In: {fmtTime(today.sign_in_time)}
              {today.sign_out_time && ` · Out: ${fmtTime(today.sign_out_time)}`}
              {today.duration_minutes != null && ` · ${today.duration_minutes} min`}
            </p>
          )}
          {signedInByName && (
            <p className="text-[11px] text-primary mt-1">
              Signed in by {signedInByName}. You&apos;re tracked by the outcomes you record today.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {canSignIn && (
            <Button onClick={handleSignIn} disabled={signIn.isPending} className="glow-primary">
              <LogIn className="w-4 h-4 mr-1.5" />
              {signIn.isPending ? 'Signing in…' : isSignedOut ? 'Sign In Again' : 'Sign In'}
            </Button>
          )}
          {isSignedIn && (
            <Button onClick={handleSignOut} disabled={signOut.isPending} variant="outline">
              <LogOut className="w-4 h-4 mr-1.5" /> {signOut.isPending ? 'Signing out…' : 'Sign Out'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffAttendanceCard;