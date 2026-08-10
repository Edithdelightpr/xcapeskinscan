import { useAppStore } from '@/store/appStore';
import { useAuth, APP_ROLE_LABELS } from '@/hooks/useAuth';
import { useRealStaff } from '@/hooks/useRealStaff';
import logo from '@/assets/tropics-logo.jpeg';
import { ArrowRight, Crown, User, ShieldCheck } from 'lucide-react';

interface Props {
  onSelect: () => void;
}

/**
 * Admin-only safe preview of real staff dashboards.
 *
 * Non-admins never reach this screen — Admin.tsx pins them to their
 * own session. Admins may step into any real staff member's view.
 * No more demo profiles, no more fake cross-user access.
 */
const ProfilePicker = ({ onSelect }: Props) => {
  const { logActivity } = useAppStore();
  const { user, isAdmin: isCloudAdmin, profile } = useAuth();
  // Hook is always called; query is gated via `enabled` so non-admins never fetch the staff list.
  const { data: realStaff = [], isLoading } = useRealStaff();

  // Hard guard: this screen is admin-only. Render nothing for non-admins.
  // Admin.tsx already skips mounting this component for non-admins; this
  // is defense in depth.
  if (!isCloudAdmin) {
    return null;
  }

  const handlePick = (staffId: string, name: string, _isAdminUser: boolean) => {
    // Perspective is determined by the staff's assigned JobRole — never by a
    // separate role string. Just pin the viewed staff id.
    useAppStore.setState({ activeStaffId: staffId });
    logActivity('Opened perspective', name);
    onSelect();
  };

  return (
    <div className="min-h-screen gradient-primary flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl space-y-8 animate-fade-in">
        <div className="flex flex-col items-center text-center space-y-3">
          <img src={logo} alt="Tropics MedSpa" className="w-14 h-14 rounded-full object-cover ring-2 ring-accent/40" />
          <h1 className="text-3xl font-display font-bold text-foreground">Choose Perspective</h1>
          <p className="text-sm text-muted-foreground max-w-md">
            Admin preview — open any real staff member's dashboard read-as. Each staff member otherwise sees only their own workspace.
          </p>
        </div>

        {isLoading ? (
          <p className="text-center text-sm text-muted-foreground">Loading staff…</p>
        ) : realStaff.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center space-y-2">
            <p className="text-sm text-foreground font-medium">No staff yet</p>
            <p className="text-xs text-muted-foreground">
              When new staff sign up at <span className="font-mono text-foreground">/auth</span> they'll appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {realStaff.map((s) => {
              const isAdminUser = s.roles.includes('admin');
              const Icon = isAdminUser ? Crown : User;
              const isMe = s.id === user?.id;
              return (
                <button
                  key={s.id}
                  onClick={() => handlePick(s.id, s.full_name || s.email, isAdminUser)}
                  className="glass rounded-xl p-6 text-left hover:border-primary/50 hover:glow-primary-soft transition-all duration-300 group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-bold text-foreground">{s.full_name || s.email}</h3>
                    {isMe && (
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                        you
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{s.email}</p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {s.roles.length === 0 ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40">
                        No role assigned
                      </span>
                    ) : (
                      s.roles.map((r) => (
                        <span
                          key={r}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 inline-flex items-center gap-1"
                        >
                          <ShieldCheck className="w-2.5 h-2.5" />
                          {APP_ROLE_LABELS[r]}
                        </span>
                      ))
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <p className="text-center text-[10px] text-muted-foreground uppercase tracking-wider">
          Admin preview · staff list comes from real authenticated accounts
        </p>
      </div>
    </div>
  );
};

export default ProfilePicker;
