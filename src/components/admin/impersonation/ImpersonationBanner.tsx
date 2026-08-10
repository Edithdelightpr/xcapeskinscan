import { useMemo } from 'react';
import { LogOut, ShieldAlert } from 'lucide-react';
import { useImpersonation } from '@/hooks/useImpersonation';
import { useAuth } from '@/hooks/useAuth';
import { useRealStaff } from '@/hooks/useRealStaff';
import { toast } from 'sonner';

const ImpersonationBanner = () => {
  const { session, exit } = useImpersonation();
  const { profile } = useAuth();
  const { data: staff = [] } = useRealStaff();

  const effective = useMemo(
    () => staff.find((s) => s.id === session?.effective_staff_id),
    [staff, session?.effective_staff_id],
  );

  if (!session) return null;

  const effectiveName = effective?.full_name || effective?.email || 'staff member';
  const adminName = profile?.full_name || profile?.email || 'Admin';

  const handleExit = async () => {
    try {
      await exit();
      toast.success('Exited impersonation');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to exit');
    }
  };

  return (
    <div className="sticky top-0 z-[90] w-full bg-accent text-accent-foreground border-b border-accent/60 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center gap-3 px-3 md:px-6 py-2">
        <ShieldAlert className="w-4 h-4 shrink-0" />
        <div className="flex-1 min-w-0 text-xs md:text-sm">
          <span className="font-semibold">Acting as {effectiveName}</span>
          <span className="opacity-80"> — Admin: {adminName}</span>
          <span className="hidden md:inline opacity-70"> · every action is audit-logged</span>
        </div>
        <button
          onClick={handleExit}
          className="inline-flex items-center gap-1.5 rounded-md bg-background/20 hover:bg-background/30 px-2.5 py-1 text-xs font-medium transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Exit
        </button>
      </div>
    </div>
  );
};

export default ImpersonationBanner;