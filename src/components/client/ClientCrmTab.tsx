import { useMemo, useState } from 'react';
import { useClientVisits, INTAKE_VALIDITY_DAYS } from '@/hooks/useClientVisits';
import { useClientTimeline } from '@/hooks/useClientTimeline';
import { useClientFollowUps, useCreateFollowUp, useUpdateFollowUp, useDeleteFollowUp } from '@/hooks/useClientFollowUps';
import { useRealStaff } from '@/hooks/useRealStaff';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Trash2, Plus, ShieldAlert, ShieldCheck, RefreshCw, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';

const naira = (n: number) => `₦${Math.round(n).toLocaleString()}`;
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const fmtDateTime = (d: string | null) =>
  d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

const useClientIntake = (clientId?: string) =>
  useQuery({
    queryKey: ['client-latest-intake', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('client_safety_intakes')
        .select('*')
        .eq('client_id', clientId)
        .order('collected_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as { collected_at: string; allergies: string | null; chronic_conditions: string[] | null; treatment_consent: boolean | null } | null;
    },
  });

const useClientLineItems = (clientId?: string) =>
  useQuery({
    queryKey: ['client-line-items', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: visits } = await (supabase as any)
        .from('client_visit_logs')
        .select('id, sign_in_time')
        .eq('client_id', clientId);
      const ids = (visits ?? []).map((v: { id: string }) => v.id);
      if (ids.length === 0) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: lis } = await (supabase as any)
        .from('visit_line_items')
        .select('*')
        .in('visit_id', ids);
      const map = new Map<string, string>();
      (visits ?? []).forEach((v: { id: string; sign_in_time: string }) => map.set(v.id, v.sign_in_time));
      return (lis ?? []).map((li: { visit_id: string; kind: string; name: string; qty: number; unit_price: number; line_total: number }) => ({
        ...li,
        when: map.get(li.visit_id) ?? null,
      }));
    },
  });

export const ClientCrmTab = ({ clientId }: { clientId: string }) => {
  const { data: visits = [] } = useClientVisits(clientId);
  const qc = useQueryClient();
  const { data: finance = [] } = useQuery({
    queryKey: ['client-finance-entries', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_entries')
        .select('kind, category, amount, payment_status, transaction_intent, visit_id')
        .eq('source_client_id', clientId)
        .eq('status', 'active');
      if (error) throw error;
      return data as Array<{ kind: string; category: string | null; amount: number; payment_status: string | null; transaction_intent: string | null; visit_id: string | null }>;
    },
  });
  const { data: intake } = useClientIntake(clientId);
  const { data: items = [] } = useClientLineItems(clientId);
  const { data: timeline = [] } = useClientTimeline(clientId);
  const { data: followUps = [] } = useClientFollowUps(clientId);
  const { data: staff = [] } = useRealStaff();

  const createFu = useCreateFollowUp();
  const updateFu = useUpdateFollowUp();
  const deleteFu = useDeleteFollowUp();

  const totals = useMemo(() => {
    let treatment = 0, product = 0, pending = 0;
    finance.forEach((f) => {
      const amt = Number(f.amount) || 0;
      if (f.kind !== 'revenue') return;
      const isPending = f.payment_status === 'pending' || f.payment_status === 'awaiting';
      if (isPending) { pending += amt; return; }
      const cat = (f.category ?? '').toLowerCase();
      const intent = (f.transaction_intent ?? '').toLowerCase();
      const isProduct =
        cat === 'product-sales' || cat === 'product_sale' || cat === 'legacy_unstructured_product_revenue' ||
        intent.includes('product');
      if (isProduct) product += amt;
      else treatment += amt;
    });
    return { treatment, product, pending, total: treatment + product, visits: visits.length };
  }, [finance, visits]);

  const intakeValid = useMemo(() => {
    if (!intake?.collected_at) return false;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - INTAKE_VALIDITY_DAYS);
    return new Date(intake.collected_at) > cutoff;
  }, [intake]);

  const treatmentItems = items.filter((i) => i.kind === 'service');
  const productItems = items.filter((i) => i.kind === 'product');

  const staffName = (id: string | null) => id ? staff.find((s) => s.id === id)?.full_name ?? '—' : '—';

  const [newReason, setNewReason] = useState('');

  // Visits with payment_state='paid' that still have no linked revenue row.
  const unreconciledVisitIds = useMemo(() => {
    const linked = new Set((finance ?? []).filter((f) => f.kind === 'revenue').map((f) => f.visit_id).filter(Boolean) as string[]);
    return (visits ?? [])
      .filter((v) => (v as { payment_state?: string }).payment_state === 'paid' && !linked.has(v.id))
      .map((v) => v.id);
  }, [visits, finance]);

  const reconcileMut = useMutation({
    mutationFn: async (visitId: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('reconcile_visit_finance', { p_visit_id: visitId });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      toast.success(n > 0 ? `Reconciled ${n} finance row${n === 1 ? '' : 's'}` : 'Nothing to reconcile');
      qc.invalidateQueries({ queryKey: ['client-finance-entries', clientId] });
      qc.invalidateQueries({ queryKey: ['client-product-purchases', clientId] });
      qc.invalidateQueries({ queryKey: ['converted-client-crm'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Reconcile failed'),
  });

  // Suggest follow-ups after a paid completed treatment when none are scheduled.
  const hasPaidCompletedTreatment = useMemo(
    () =>
      (visits ?? []).some(
        (v) =>
          (v as { payment_state?: string; treatment_completed_at?: string | null }).payment_state === 'paid' &&
          !!(v as { treatment_completed_at?: string | null }).treatment_completed_at,
      ),
    [visits],
  );
  const SUGGESTIONS = [
    'Check skin response (3 days)',
    'Product usage feedback (7 days)',
    'Recommend next facial (2–4 weeks)',
  ];

  return (
    <div className="space-y-6">
      {unreconciledVisitIds.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <strong className="font-semibold">⚠ {unreconciledVisitIds.length} paid visit{unreconciledVisitIds.length === 1 ? '' : 's'} not reconciled to finance.</strong>{' '}
              The receipt items are recorded but no official paid revenue row exists. Reconcile to fix the totals.
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={reconcileMut.isPending}
              onClick={() => {
                unreconciledVisitIds.forEach((id) => reconcileMut.mutate(id));
              }}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${reconcileMut.isPending ? 'animate-spin' : ''}`} />
              Reconcile now
            </Button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Tile label="Total spend" value={naira(totals.total)} />
        <Tile label="Treatment revenue" value={naira(totals.treatment)} />
        <Tile label="Product revenue" value={naira(totals.product)} />
        <Tile label="Pending balance" value={naira(totals.pending)} accent={totals.pending > 0 ? 'warn' : undefined} />
        <Tile label="Visits" value={totals.visits.toLocaleString()} />
      </div>

      {hasPaidCompletedTreatment && followUps.length === 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Lightbulb className="w-4 h-4 text-primary" />
            <strong className="font-semibold">Suggested follow-ups after this treatment</strong>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <Button
                key={s}
                size="sm"
                variant="outline"
                onClick={() => {
                  setNewReason(s);
                }}
              >
                <Plus className="w-3 h-3 mr-1" /> {s}
              </Button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Tap a suggestion to pre-fill the follow-up form below.</p>
        </div>
      )}

      <div className="glass rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-foreground">Intake summary</h3>
          {intakeValid ? (
            <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5" /> Valid
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-amber-500/15 text-amber-300">
              <ShieldAlert className="w-3.5 h-3.5" /> {intake ? 'Expired' : 'Missing'}
            </span>
          )}
        </div>
        {intake ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <KV label="Collected">{fmtDate(intake.collected_at)}</KV>
            <KV label="Allergies">{intake.allergies || 'None reported'}</KV>
            <KV label="Consent">{intake.treatment_consent ? 'Granted' : 'Not granted'}</KV>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No safety intake collected yet.</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5 space-y-3">
          <h3 className="font-display font-bold text-foreground">Treatment history</h3>
          {treatmentItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No treatment recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border/30">
              {treatmentItems.map((it) => (
                <li key={it.id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <div className="text-foreground">{it.name}</div>
                    <div className="text-[11px] text-muted-foreground">{fmtDate(it.when)} · qty {it.qty}</div>
                  </div>
                  <div className="text-foreground font-medium">{naira(it.line_total)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass rounded-xl p-5 space-y-3">
          <h3 className="font-display font-bold text-foreground">Product purchases</h3>
          {productItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No product purchase recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border/30">
              {productItems.map((it) => (
                <li key={it.id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <div className="text-foreground">{it.name}</div>
                    <div className="text-[11px] text-muted-foreground">{fmtDate(it.when)} · qty {it.qty}</div>
                  </div>
                  <div className="text-foreground font-medium">{naira(it.line_total)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="glass rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-foreground">Follow-ups</h3>
        </div>
        <div className="flex gap-2">
          <Input
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            placeholder="New follow-up reason (e.g. Check skin response)"
            className="bg-surface border-border/60"
          />
          <Button
            onClick={async () => {
              if (!newReason.trim()) return;
              await createFu.mutateAsync({ client_id: clientId, reason: newReason.trim() });
              setNewReason('');
            }}
            disabled={createFu.isPending}
            className="glow-primary"
          >
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
        {followUps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No follow-ups scheduled.</p>
        ) : (
          <ul className="divide-y divide-border/30">
            {followUps.map((fu) => (
              <li key={fu.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="text-foreground truncate">{fu.reason ?? 'Follow-up'}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Due {fmtDate(fu.due_date)} · owner {staffName(fu.owner_staff_id)} · {fu.status}
                  </div>
                </div>
                <div className="flex gap-1">
                  {fu.status !== 'completed' && (
                    <Button size="sm" variant="ghost" onClick={() => updateFu.mutate({ id: fu.id, status: 'completed' })}>
                      <CheckCircle2 className="w-4 h-4" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => deleteFu.mutate(fu.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="glass rounded-xl p-5 space-y-3">
        <h3 className="font-display font-bold text-foreground">Timeline</h3>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">No timeline events yet.</p>
        ) : (
          <ul className="space-y-2">
            {timeline.slice(0, 20).map((e) => (
              <li key={e.id} className="text-sm border-l-2 border-primary/40 pl-3">
                <div className="text-foreground">{e.status.replace(/_/g, ' ')}</div>
                <div className="text-[11px] text-muted-foreground">{fmtDateTime(e.occurred_at)} · {staffName(e.by_staff_id)}</div>
                {e.note && <div className="text-xs text-muted-foreground mt-0.5">{e.note}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const Tile = ({ label, value, accent }: { label: string; value: string; accent?: 'warn' }) => (
  <div className="glass rounded-xl p-4">
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className={`text-base font-display font-bold mt-1 ${accent === 'warn' ? 'text-amber-300' : 'text-foreground'}`}>{value}</p>
  </div>
);

const KV = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="text-sm text-foreground mt-0.5">{children}</p>
  </div>
);

export default ClientCrmTab;