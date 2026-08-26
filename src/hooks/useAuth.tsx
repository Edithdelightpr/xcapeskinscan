import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type AppRole =
  | 'admin'
  | 'front_desk'
  | 'medical_aesthetician'
  | 'cleaner'
  | 'outreach'
  | 'team'
  | 'affiliate'
  | 'cdp';

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administrator',
  front_desk: 'Front Desk',
  medical_aesthetician: 'Medical Expert',
  cleaner: 'Cleaner',
  outreach: 'Outreach',
  team: 'Team',
  affiliate: 'Affiliate',
  cdp: 'Certified Distribution Partner',
};

/** The XCAPE account type that drives workspace navigation and commerce. */
export type XcapeAccountType = 'admin' | 'cdp' | 'affiliate' | 'team' | 'staff';

export const resolveAccountType = (roles: AppRole[]): XcapeAccountType => {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('cdp')) return 'cdp';
  if (roles.includes('affiliate')) return 'affiliate';
  if (roles.includes('team')) return 'team';
  return 'staff';
};


interface StaffProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: 'active' | 'inactive' | 'invited';
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: StaffProfile | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  accountType: XcapeAccountType;
  hasRole: (role: AppRole) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string) => {
    const [{ data: profileData }, { data: rolesData }] = await Promise.all([
      supabase.from('staff_users').select('*').eq('id', uid).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', uid),
    ]);
    setProfile(profileData as StaffProfile | null);
    setRoles((rolesData ?? []).map((r) => r.role as AppRole));
  }, []);

  useEffect(() => {
    // CRITICAL ORDER: subscribe first, THEN getSession.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // defer profile load to avoid deadlocks
        setTimeout(() => { loadProfile(newSession.user.id); }, 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        loadProfile(existing.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/xcape`,
        data: { full_name: fullName },
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
  };

  const refresh = async () => {
    if (user) await loadProfile(user.id);
  };

  const isAdmin = roles.includes('admin');
  const accountType = resolveAccountType(roles);
  const hasRole = (role: AppRole) => roles.includes(role);

  return (
    <AuthContext.Provider
      value={{ user, session, profile, roles, loading, isAdmin, accountType, hasRole, signIn, signUp, signOut, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Auth access for surfaces that may render outside the provider (public
 * pages in isolation tests). Returns null instead of throwing.
 */
export const useOptionalAuth = () => useContext(AuthContext) ?? null;

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};