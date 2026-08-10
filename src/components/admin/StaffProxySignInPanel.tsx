import { useMemo, useState } from 'react';
import { LogIn, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useTodaysAttendance, useStaffSignIn } from '@/hooks/useStaffAttendance';
import { toast } from 'sonner';

/**
 * Allows admin / front desk to sign another staff member in for the day.
 * The sign-in time is captured as `now()` and the actor is recorded
 * via `signed_in_by` for the audit trail.
 */
const StaffProxySignInPanel = () => {
  const { user, isAdmin, hasRole } = useAuth();
  const { data: staff = [] } = useRealStaff();
  const { data: attendance = [] } = useTodaysAttendance();
  const signIn = useStaffSignIn();
  const [selected, setSelected] = useState<string>('');
  const [location, setLocation] = useState('');

  const canManage = isAdmin || hasRole('front_desk');

  const signedInIds = useMemo(
    () => new Set(attendance.filter((a) => a.status === 'signed_in').map((a) => a.staff_user_id)),
    [attendance],
  );
  const eligibleStaff = useMemo(
    () =>
      staff.filter(
        (s) => s.status === 'active' && !signedInIds.has(s.id),
      ),
    [staff, signedInIds],
  );

  if (!canManage) return null;

  const handleSubmit = async () => {
    if (!user || !selected) {
      toast.error('Pick a staff member first');
      return;
    }
    try {
      await signIn.mutateAsync({
        staff_user_id: selected,
        location: location.trim() || null,
        start_of_day_notes: null,
        signed_in_by: user.id,
      });
      const name = staff.find((s) => s.id === selected)?.full_name ?? 'Staff';
      toast.success(`${name} signed in for today`);
      setSelected('');
      setLocation('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to sign staff in');
    }
  };

  return (
    <div className="glass rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <UserCheck className="w-4 h-4 text-primary" />
        <h3 className="font-display font-bold text-foreground">Sign in a staff member</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Front desk attestation — date &amp; time are captured automatically. The team member
        is then tracked by the outcomes they record during the day.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger>
            <SelectValue placeholder={eligibleStaff.length ? 'Select staff…' : 'Everyone is signed in'} />
          </SelectTrigger>
          <SelectContent>
            {eligibleStaff.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.full_name || s.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Location / notes (optional)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <Button
          onClick={handleSubmit}
          disabled={!selected || signIn.isPending}
          className="glow-primary"
        >
          <LogIn className="w-4 h-4 mr-1.5" />
          {signIn.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </div>
    </div>
  );
};

export default StaffProxySignInPanel;