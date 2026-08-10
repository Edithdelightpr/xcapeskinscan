import { createContext, ReactNode, useCallback, useContext, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ImpersonationSession {
  session_id: string;
  admin_user_id: string;
  effective_staff_id: string;
  reason: string;
  started_at: string;
  expires_at: string;
}

interface Ctx {
  session: ImpersonationSession | null;
  isImpersonating: boolean;
  loading: boolean;
  start: (targetStaffId: string, reason: string) => Promise<void>;
  exit: () => Promise<void>;
  logAction: (action: string, entityTable?: string | null, entityId?: string | null, payload?: unknown) => Promise<void>;
}

const ImpersonationCtx = createContext<Ctx | undefined>(undefined);

const KEY = ['impersonation', 'current'] as const;

export const ImpersonationProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: KEY,
    enabled: !!user,
    queryFn: async (): Promise<ImpersonationSession | null> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('current_impersonation');
      if (error) throw error;
      const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
      return row ?? null;
    },
    staleTime: 30_000,
  });

  const startMut = useMutation({
    mutationFn: async ({ targetStaffId, reason }: { targetStaffId: string; reason: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc('start_impersonation', {
        target_staff_id: targetStaffId,
        reason,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const exitMut = useMutation({
    mutationFn: async (sessionId: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc('end_impersonation', { session_id: sessionId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const start = useCallback(async (targetStaffId: string, reason: string) => {
    await startMut.mutateAsync({ targetStaffId, reason });
  }, [startMut]);

  const exit = useCallback(async () => {
    const s = query.data;
    if (!s) return;
    await exitMut.mutateAsync(s.session_id);
  }, [query.data, exitMut]);

  const logAction = useCallback(async (action: string, entityTable?: string | null, entityId?: string | null, payload?: unknown) => {
    const s = query.data;
    if (!s) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc('log_impersonated_action', {
        p_session_id: s.session_id,
        p_action: action,
        p_entity_table: entityTable ?? null,
        p_entity_id: entityId ?? null,
        p_payload: payload ?? null,
      });
    } catch (e) {
      // Best-effort audit; do not disrupt the primary write.
      // eslint-disable-next-line no-console
      console.warn('[impersonation] audit log failed', e);
    }
  }, [query.data]);

  // Only admins can hold an active session; defensively strip for others.
  const session = isAdmin ? (query.data ?? null) : null;

  const value = useMemo<Ctx>(() => ({
    session,
    isImpersonating: !!session,
    loading: query.isLoading,
    start,
    exit,
    logAction,
  }), [session, query.isLoading, start, exit, logAction]);

  return <ImpersonationCtx.Provider value={value}>{children}</ImpersonationCtx.Provider>;
};

export const useImpersonation = (): Ctx => {
  const ctx = useContext(ImpersonationCtx);
  if (!ctx) throw new Error('useImpersonation must be used within ImpersonationProvider');
  return ctx;
};