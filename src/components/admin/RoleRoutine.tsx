import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, RotateCcw, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const todayISO = () => new Date().toISOString().slice(0, 10);

type TemplateRow = {
  id: string;
  title: string;
  description: string | null;
  step_order: number;
};
type InstanceRow = {
  id: string;
  template_id: string | null;
  status: 'pending' | 'completed' | 'skipped';
  completed_at: string | null;
  skipped_at: string | null;
  skip_reason: string | null;
};

const RoleRoutine = () => {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  const today = todayISO();
  const [skipDialogId, setSkipDialogId] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState('');

  // Idempotently materialize today's instances for the signed-in user.
  useEffect(() => {
    if (!user?.id) return;
    supabase.rpc('ensure_routines_for_today', { _staff_id: user.id }).then(({ error }) => {
      if (!error) {
        qc.invalidateQueries({ queryKey: ['my-routines', user.id] });
      }
    });
  }, [user?.id, qc]);

  const { data, isLoading } = useQuery({
    queryKey: ['my-routines', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<{ templates: TemplateRow[]; instances: InstanceRow[] }> => {
      const [{ data: tpls, error: e1 }, { data: insts, error: e2 }] = await Promise.all([
        supabase
          .from('routine_templates')
          .select('id,title,description,step_order')
          .eq('staff_user_id', user!.id)
          .eq('active', true)
          .order('step_order', { ascending: true }),
        supabase
          .from('routine_instances')
          .select('id,template_id,status,completed_at,skipped_at,skip_reason')
          .eq('staff_user_id', user!.id)
          .eq('routine_date', today),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return { templates: (tpls ?? []) as TemplateRow[], instances: (insts ?? []) as InstanceRow[] };
    },
  });

  const setStatus = useMutation({
    mutationFn: async (payload: { id: string; status: 'pending' | 'completed' | 'skipped'; skip_reason?: string }) => {
      const patch: Partial<InstanceRow> = {
        status: payload.status,
        completed_at: payload.status === 'completed' ? new Date().toISOString() : null,
        skipped_at: payload.status === 'skipped' ? new Date().toISOString() : null,
        skip_reason: payload.status === 'skipped' ? (payload.skip_reason ?? null) : null,
      };
      const { error } = await supabase
        .from('routine_instances')
        .update(patch)
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-routines', user?.id] }),
  });

  const handleSkip = (instanceId: string) => {
    setStatus.mutate({ id: instanceId, status: 'skipped', skip_reason: skipReason || 'No reason provided' });
    setSkipDialogId(null);
    setSkipReason('');
  };

  const templates = data?.templates ?? [];
  const instances = data?.instances ?? [];
  const getInstance = (templateId: string) => instances.find((i) => i.template_id === templateId);

  const completed = instances.filter((i) => i.status === 'completed').length;
  const skipped = instances.filter((i) => i.status === 'skipped').length;
  const pending = instances.filter((i) => i.status === 'pending').length;
  const total = templates.length || 1;
  const pct = Math.round((completed / total) * 100);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-display font-bold text-foreground">Tailored Routine</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary uppercase tracking-wider font-semibold">
              Assigned by admin
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {profile?.full_name || profile?.email} · {today}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-green-400">{completed} done</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{pending} pending</span>
          {skipped > 0 && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-destructive">{skipped} skipped</span>
            </>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-2 text-xs">
          <span className="text-muted-foreground">Daily progress</span>
          <span className="text-foreground font-medium">{pct}%</span>
        </div>
        <div className="h-1.5 bg-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Routine list */}
      <div className="space-y-3">
        {isLoading && (
          <div className="glass rounded-xl p-8 text-center">
            <p className="text-sm text-muted-foreground">Loading your routine…</p>
          </div>
        )}
        {templates.map((tpl) => {
          const inst = getInstance(tpl.id);
          const status = inst?.status || 'pending';
          const isSkipping = skipDialogId === inst?.id;

          return (
            <div
              key={tpl.id}
              className={`glass rounded-xl p-5 transition-all ${
                status === 'completed' ? 'border-green-500/30 opacity-80' :
                status === 'skipped' ? 'border-destructive/30 opacity-70' :
                'border-border/50'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Step {tpl.step_order || '·'}</span>
                    {status === 'completed' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 uppercase tracking-wider font-semibold">
                        Completed
                      </span>
                    )}
                    {status === 'skipped' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive uppercase tracking-wider font-semibold">
                        Skipped
                      </span>
                    )}
                  </div>
                  <h3 className={`font-semibold text-foreground mt-1 ${status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                    {tpl.title}
                  </h3>
                  {tpl.description && <p className="text-xs text-muted-foreground mt-0.5">{tpl.description}</p>}
                  {status === 'skipped' && inst?.skip_reason && (
                    <p className="text-xs text-destructive/80 mt-2 italic">
                      Reason: {inst.skip_reason}
                    </p>
                  )}
                  {(inst?.completed_at || inst?.skipped_at) && (
                    <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(inst.completed_at || inst.skipped_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>

                {inst && status === 'pending' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setStatus.mutate({ id: inst.id, status: 'completed' })}
                      className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1.5 hover:bg-primary/90 transition-colors"
                    >
                      <Check className="w-3 h-3" /> Complete
                    </button>
                    <button
                      onClick={() => setSkipDialogId(inst.id)}
                      className="px-3 py-1.5 rounded-lg bg-surface text-muted-foreground text-xs font-medium flex items-center gap-1.5 hover:text-destructive hover:bg-surface-hover transition-colors"
                    >
                      <X className="w-3 h-3" /> Skip
                    </button>
                  </div>
                )}

                {inst && status !== 'pending' && (
                  <button
                    onClick={() => setStatus.mutate({ id: inst.id, status: 'pending' })}
                    className="px-3 py-1.5 rounded-lg bg-surface text-muted-foreground text-xs font-medium flex items-center gap-1.5 hover:text-foreground transition-colors shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                )}
              </div>

              {isSkipping && (
                <div className="mt-4 pt-4 border-t border-border/40 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Reason for skipping (optional)</p>
                  <textarea
                    value={skipReason}
                    onChange={(e) => setSkipReason(e.target.value)}
                    placeholder="e.g. Out of supplies, not applicable today..."
                    className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none"
                    rows={2}
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setSkipDialogId(null); setSkipReason(''); }}
                      className="px-3 py-1.5 rounded-lg bg-surface text-muted-foreground text-xs hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSkip(inst!.id)}
                      className="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 transition-colors"
                    >
                      Confirm Skip
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {!isLoading && templates.length === 0 && (
          <div className="glass rounded-xl p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No routines assigned yet. An administrator can add daily steps from Staff Configuration.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleRoutine;
