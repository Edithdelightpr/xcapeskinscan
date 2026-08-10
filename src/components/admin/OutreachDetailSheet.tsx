import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LogIn } from 'lucide-react';
import ClientSignInModal from './ClientSignInModal';
import OutreachAnalysisQueue from './OutreachAnalysisQueue';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Copy, Check, ShoppingBag, Clock, CheckCircle2, X, Lock, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { outreachStatusLabel } from '@/lib/outreachStatus';
import { outreachNextAction, TONE_BADGE } from '@/lib/outreachNextAction';
import OutreachStepper from './outreach/OutreachStepper';
import SetupTab from './outreach/SetupTab';
import ReconciliationTab from './outreach/ReconciliationTab';
import FinalReportTab from './outreach/FinalReportTab';
import { useOutreachChecklist } from '@/hooks/useOutreachChecklist';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import {
  useOutreachSession, useOutreachCrew, useOutreachLeads, useOutreachDistributionRuns,
  useOutreachExpenses, useOutreachRewards, useTransitionOutreach,
  useUpsertCrew, useRemoveCrew, useApproveReward, useRejectReward, useRecomputeReward,
  useCaptureOutreachLead, useLogOutreachExpense, OutreachRole,
  usePendingOutreachOrders, useConfirmPendingOutreachOrder, useCancelPendingOutreachOrder,
  useUpdateOutreachSession,
  type PendingOutreachOrder,
  type OutreachStatus,
} from '@/hooks/useOutreachSessions';
import { useDeleteOutreachSession } from '@/hooks/useOutreachSessions';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useProducts } from '@/hooks/useProducts';
import LiveOutreachSaleSheet from './LiveOutreachSaleSheet';

const fmt = (n: number) => `₦${Number(n || 0).toLocaleString()}`;

const roles: OutreachRole[] = ['initiator', 'sales', 'capture', 'logistics', 'driver', 'support', 'medic', 'other'];

const expenseCats = ['transportation', 'fuel', 'setup', 'logistics', 'snacks', 'banners', 'printing', 'staff_support', 'other'];

const OutreachDetailSheet = ({ outreachId, onClose }: { outreachId: string; onClose: () => void }) => {
  const { data: session } = useOutreachSession(outreachId);
  const { data: crew = [] } = useOutreachCrew(outreachId);
  const { data: leads = [] } = useOutreachLeads(outreachId);
  const { data: runs = [] } = useOutreachDistributionRuns(outreachId);
  const { data: entries = [] } = useOutreachExpenses(outreachId);
  const { data: rewards = [] } = useOutreachRewards(outreachId);
  const { data: staff = [] } = useRealStaff();
  const { data: pendingOrders = [] } = usePendingOutreachOrders(outreachId, 'pending');
  const { data: missing = [] } = useOutreachChecklist(outreachId);
  const { isAdmin } = useEffectivePermissions();

  const transition = useTransitionOutreach();
  const recompute = useRecomputeReward();
  const deleteOutreach = useDeleteOutreachSession();
  const [saleOpen, setSaleOpen] = useState(false);
  const [tab, setTab] = useState<'setup' | 'live' | 'recon' | 'report'>('setup');

  if (!session) return null;

  const staffById = new Map(staff.map((s) => [s.id, s.full_name]));
  const next = outreachNextAction(session.status);
  const checklistOk = missing.length === 0;
  const canLive = ['ready_to_start','active','completed','reconciliation_pending','reconciled','closed'].includes(session.status);
  const canRecon = ['completed','reconciliation_pending','reconciled','closed'].includes(session.status);
  const canReport = ['reconciled','closed'].includes(session.status);
  const setupLocked = canLive; // setup is read-only once outreach is live or beyond

  const grossMargin = session.total_revenue - session.total_cogs;
  const expenseRows = entries.filter((e: any) => e.kind === 'spend');
  const totalExpenseRows = expenseRows.length;

  const PrimaryAction = () => {
    const s = session.status;
    if (s === 'draft' || s === 'planned') {
      return (
        <Button size="sm" disabled={!checklistOk} onClick={() => transition.mutate({ id: outreachId, to: 'submitted_for_approval' })} title={checklistOk ? '' : `Missing: ${missing.join(', ')}`}>
          Submit for Approval
        </Button>
      );
    }
    if (s === 'submitted_for_approval') {
      if (isAdmin) return <Button size="sm" onClick={() => transition.mutate({ id: outreachId, to: 'approved' })}>Approve</Button>;
      return <span className="text-xs text-muted-foreground">Awaiting admin approval</span>;
    }
    if (s === 'approved') return <Button size="sm" onClick={() => transition.mutate({ id: outreachId, to: 'ready_to_start' })}>Mark Ready to Start</Button>;
    if (s === 'ready_to_start') return <Button size="sm" onClick={() => transition.mutate({ id: outreachId, to: 'active' })}>Start Outreach</Button>;
    if (s === 'active') return (
      <div className="flex gap-2">
        <Button size="sm" className="gap-1" onClick={() => setSaleOpen(true)}><ShoppingBag className="w-3.5 h-3.5" /> Record sale</Button>
        <Button size="sm" variant="outline" onClick={() => transition.mutate({ id: outreachId, to: 'completed' })}>Complete Outreach</Button>
      </div>
    );
    if (s === 'completed') return <Button size="sm" onClick={() => transition.mutate({ id: outreachId, to: 'reconciliation_pending' })}>Open Reconciliation</Button>;
    if (s === 'reconciliation_pending') return <span className="text-xs text-muted-foreground">Sign off all sections in <strong>Reconcile</strong> tab</span>;
    if (s === 'reconciled') {
      if (isAdmin) return (
        <div className="flex gap-2">
          <Button size="sm" className="gap-1" onClick={() => transition.mutate({ id: outreachId, to: 'closed' })}><Lock className="w-3.5 h-3.5" /> Close Outreach</Button>
          <Button size="sm" variant="outline" onClick={() => recompute.mutate(outreachId)}>Recompute reward</Button>
        </div>
      );
      return <span className="text-xs text-muted-foreground">Awaiting GOP closure</span>;
    }
    return null;
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display flex items-center justify-between gap-2">
            <span>{session.name}</span>
            <Badge className="uppercase text-[10px] tracking-wider">{outreachStatusLabel(session.status)}</Badge>
          </SheetTitle>
          <p className="text-xs text-muted-foreground">{session.outreach_date} · {session.location ?? '—'} · {session.outreach_type}</p>
        </SheetHeader>

        {/* Next Action / Owner banner */}
        <div className={cn('mt-3 rounded-md border px-3 py-2 flex flex-wrap items-center justify-between gap-2', TONE_BADGE[next.tone])}>
          <div className="text-xs">
            <div className="font-semibold">Next Action: {next.action}</div>
            <div className="opacity-80">Owner: {next.owner}</div>
          </div>
          <PrimaryAction />
        </div>

        {/* Two-column body */}
        <div className="mt-4 grid grid-cols-12 gap-4">
          <aside className="col-span-12 sm:col-span-3 lg:col-span-3">
            <Card className="p-3 sticky top-2">
              <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Lifecycle</h4>
              <OutreachStepper status={session.status} />
            </Card>
          </aside>

          <main className="col-span-12 sm:col-span-9 lg:col-span-9 space-y-3">
            {/* Totals strip */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <Tile label="Leads" value={String(session.total_leads)} />
              <Tile label="Revenue" value={fmt(session.total_revenue)} />
              <Tile label="COGS" value={fmt(session.total_cogs)} />
              <Tile label="Op Expense" value={fmt(session.total_op_expense)} />
              <Tile label="Net" value={fmt(session.net_profit)} valueClass={session.net_profit >= 0 ? 'text-emerald-400' : 'text-destructive'} />
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1">
              Net = Revenue − COGS − Op Expenses · Gross Margin: {fmt(grossMargin)} · Reward pool {session.status === 'reconciled' || session.status === 'closed' ? '' : '🔒 '}
              <strong>{fmt(session.reward_amount)}</strong>
            </p>

            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="setup">Setup</TabsTrigger>
                <TabsTrigger value="live" disabled={!canLive} title={!canLive ? 'Opens once outreach is Ready to Start' : ''}>
                  Live Ops {!canLive && <Lock className="w-2.5 h-2.5 ml-1" />}
                </TabsTrigger>
                <TabsTrigger value="recon" disabled={!canRecon} title={!canRecon ? 'Opens after outreach is Completed' : ''}>
                  Reconcile {!canRecon && <Lock className="w-2.5 h-2.5 ml-1" />}
                </TabsTrigger>
                <TabsTrigger value="report" disabled={!canReport} title={!canReport ? 'Opens after Reconciled' : ''}>
                  Report {!canReport && <Lock className="w-2.5 h-2.5 ml-1" />}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="setup" className="mt-3">
                <SetupTab session={session} locked={setupLocked} />
                {!['cancelled','closed','reconciled'].includes(session.status) && (
                  <div className="pt-3 mt-3 border-t border-border/30">
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => transition.mutate({ id: outreachId, to: 'cancelled' })}>
                      Cancel outreach
                    </Button>
                  </div>
                )}
                {isAdmin && (
                  <div className="pt-3 mt-3 border-t border-border/30 flex items-center justify-between gap-3">
                    <div className="text-[11px] text-muted-foreground">
                      Permanently remove this outreach. Only allowed when it has no captured leads and no booked revenue —
                      cancel it first if it is already in flight.
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive/40 hover:bg-destructive/10"
                          disabled={
                            (session.total_leads ?? 0) > 0 ||
                            Number(session.total_revenue ?? 0) > 0 ||
                            ['reconciled', 'closed'].includes(session.status)
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete outreach
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete “{session.name}”?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This removes the outreach row entirely. Historical clients, finance entries and interactions
                            captured under it are preserved but will lose their outreach link. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep it</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90"
                            onClick={async () => {
                              await deleteOutreach.mutateAsync({ id: outreachId });
                              onClose();
                            }}
                          >
                            Delete permanently
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="live" className="mt-3 space-y-4">
                <LiveOpsSubTabs
                  session={session}
                  outreachId={outreachId}
                  crew={crew}
                  leads={leads}
                  runs={runs}
                  pendingOrders={pendingOrders}
                  expenseRows={expenseRows}
                  rewards={rewards}
                  staffById={staffById}
                />
              </TabsContent>

              <TabsContent value="recon" className="mt-3">
                <ReconciliationTab session={session} />
              </TabsContent>

              <TabsContent value="report" className="mt-3">
                <FinalReportTab session={session} />
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </SheetContent>
      {saleOpen && (
        <LiveOutreachSaleSheet
          outreachId={outreachId}
          outreachName={session.name}
          open={saleOpen}
          onClose={() => setSaleOpen(false)}
        />
      )}
    </Sheet>
  );
};

/** Inner sub-tabs for Live Ops — wraps the existing crew/leads/expenses/pending/rewards panels. */
const LiveOpsSubTabs = ({
  session, outreachId, crew, leads, runs, pendingOrders, expenseRows, rewards, staffById,
}: any) => {
  const isActive = session.status === 'ready_to_start' || session.status === 'active';
  return (
    <Tabs defaultValue={isActive ? 'workspace' : 'capture'}>
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="workspace">Live Workspace</TabsTrigger>
        <TabsTrigger value="capture">Capture Links</TabsTrigger>
        <TabsTrigger value="crew">Crew ({crew.length})</TabsTrigger>
        <TabsTrigger value="runs">Runs ({runs.length})</TabsTrigger>
        <TabsTrigger value="leads">Leads ({leads.length})</TabsTrigger>
        <TabsTrigger value="pending">
          Pending {pendingOrders.length > 0 && (
            <Badge variant="outline" className="ml-1.5 text-[9px] px-1.5 py-0 border-amber-500/50 text-amber-700 font-semibold">{pendingOrders.length}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="expenses">Expenses ({expenseRows.length})</TabsTrigger>
        <TabsTrigger value="rewards">Rewards ({rewards.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="workspace" className="mt-3 space-y-3">
        <LiveWorkspaceTab session={session} outreachId={outreachId} />
      </TabsContent>

      <TabsContent value="capture" className="mt-3 space-y-3">
        <Card className="p-4 space-y-2">
          <h4 className="font-semibold text-sm">Capture links</h4>
          <CaptureLinks slug={session.intake_slug} initiatorStaffId={session.initiator_staff_id} />
          <PublicIntakeToggle outreachId={outreachId} enabled={session.public_intake_enabled} />
          <p className="text-[11px] text-muted-foreground">Slug links lock every lead to this outreach + the staff who shared it.</p>
        </Card>
      </TabsContent>

      <TabsContent value="crew" className="mt-3">
        <CrewTab outreachId={outreachId} crew={crew} staffMap={staffById} />
      </TabsContent>

      <TabsContent value="runs" className="mt-3 space-y-3">
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No distribution runs linked yet. Create one from <strong>Distribution & Stock</strong>.</p>
        ) : runs.map((r: any) => (
          <Card key={r.id} className="p-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm">{r.name}</div>
              <div className="text-xs text-muted-foreground">{r.event_date} · status: {r.status}</div>
            </div>
            <div className="text-right text-xs">
              <div>Out: {fmt(r.total_value_out)}</div>
              <div>Rev: {fmt(r.total_revenue)}</div>
              <div>Loss: {fmt(r.total_loss_value)}</div>
            </div>
          </Card>
        ))}
      </TabsContent>

      <TabsContent value="leads" className="mt-3 space-y-3">
        <QuickCapture outreachId={outreachId} disabled={session.status !== 'active'} />
        {leads.length === 0 ? <p className="text-sm text-muted-foreground">No leads captured yet.</p> : (
          <div className="space-y-2">
            {leads.map((c: any) => (
              <Card key={c.id} className="p-3 flex items-center justify-between text-sm">
                <div>
                  <div className="font-semibold">{c.full_name}</div>
                  <div className="text-xs text-muted-foreground">{c.phone ?? '—'} · via {c.captured_via ?? '—'}</div>
                </div>
                <div className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</div>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="pending" className="mt-3">
        <PendingOrdersTab outreachId={outreachId} orders={pendingOrders} staffMap={staffById} />
      </TabsContent>

      <TabsContent value="expenses" className="mt-3 space-y-3">
        <ExpenseLogger outreachId={outreachId} />
        {expenseRows.length === 0 ? <p className="text-sm text-muted-foreground">No expenses logged.</p> : (
          <div className="space-y-2">
            {expenseRows.map((e: any) => (
              <Card key={e.id} className="p-3 flex items-center justify-between text-sm">
                <div>
                  <div className="font-semibold capitalize">{e.category.replace('_', ' ')}</div>
                  {e.notes && <div className="text-xs text-muted-foreground">{e.notes}</div>}
                </div>
                <div className="text-right">
                  <div className="font-semibold">{fmt(e.amount)}</div>
                  <div className="text-[10px] text-muted-foreground">{e.date}</div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="rewards" className="mt-3">
        <RewardsTab outreachId={outreachId} rewards={rewards} staffMap={staffById} />
      </TabsContent>
    </Tabs>
  );
};

const Tile = ({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) => (
  <div className="rounded-md bg-muted/30 p-2 text-center">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className={'text-sm font-semibold mt-0.5 ' + (valueClass ?? '')}>{value}</div>
  </div>
);

/** Live Workspace — the single screen a practitioner uses during an outreach:
 *  Sign In → Analysis → Share Report → auto re-open Sign In for the next
 *  client. All attribution flows through existing columns
 *  (`client_visit_logs.logged_by_staff_id`, `.source_id`, and
 *  `client_visit_assessments.assessed_by_staff_id`). No schema changes. */
const LiveWorkspaceTab = ({ session, outreachId }: { session: any; outreachId: string }) => {
  const [signInOpen, setSignInOpen] = useState(false);
  const canOperate = session.status === 'ready_to_start' || session.status === 'active';

  const { data: counters, refetch: refetchCounters } = useQuery({
    queryKey: ['outreach-live-counters', outreachId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data: visits } = await client
        .from('client_visit_logs')
        .select('id, sign_out_time')
        .eq('source_type', 'outreach')
        .eq('source_id', outreachId);
      const visitIds = (visits ?? []).map((v: any) => v.id);
      let assessments = 0;
      let reports = 0;
      if (visitIds.length > 0) {
        const { data: assessRows } = await client
          .from('client_visit_assessments')
          .select('id')
          .in('visit_id', visitIds);
        const assessIds = (assessRows ?? []).map((a: any) => a.id);
        assessments = assessIds.length;
        if (assessIds.length > 0) {
          const { count: rCount } = await client
            .from('client_report_links')
            .select('id', { count: 'exact', head: true })
            .in('assessment_id', assessIds)
            .is('revoked_at', null);
          reports = rCount ?? 0;
        }
      }
      const signedIn = (visits ?? []).length;
      const closed = (visits ?? []).filter((v: any) => v.sign_out_time).length;
      return {
        signedIn,
        assessments,
        reports,
        pending: Math.max(0, signedIn - assessments),
        closed,
      };
    },
    refetchInterval: 20000,
  });

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-display font-bold text-base">Live workspace</h4>
          <p className="text-[11px] text-muted-foreground">
            Sign in each client, run their analysis, share their report — then loop straight back to the next sign-in.
          </p>
        </div>
        <Button
          size="lg"
          className="gap-2 glow-primary"
          disabled={!canOperate}
          onClick={() => setSignInOpen(true)}
          title={canOperate ? '' : 'Available once outreach is Ready to Start or Active'}
        >
          <LogIn className="w-4 h-4" /> Sign in next client
        </Button>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Tile label="Signed in" value={String(counters?.signedIn ?? 0)} />
        <Tile label="Analyses done" value={String(counters?.assessments ?? 0)} />
        <Tile label="Reports shared" value={String(counters?.reports ?? 0)} />
        <Tile label="Waiting for analysis" value={String(counters?.pending ?? 0)} valueClass={(counters?.pending ?? 0) > 0 ? 'text-amber-600' : ''} />
      </div>

      <OutreachAnalysisQueue
        title="This outreach — waiting for analysis"
        outreachId={outreachId}
        onVisitCompleted={() => {
          refetchCounters();
          // Auto-open sign-in for the next client per spec.
          if (canOperate) setSignInOpen(true);
        }}
      />

      {signInOpen && (
        <ClientSignInModal
          open={signInOpen}
          onClose={() => { setSignInOpen(false); refetchCounters(); }}
          lockedSourceType="outreach"
          lockedSourceId={outreachId}
        />
      )}
    </div>
  );
};

const CaptureLinks = ({ slug, initiatorStaffId }: { slug: string | null; initiatorStaffId: string | null }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  if (!slug) return <p className="text-xs text-muted-foreground">Slug pending — refresh after a moment.</p>;
  const base = `${window.location.origin}/outreach/intake/${slug}`;
  const staffUrl = initiatorStaffId ? `${base}?staff=${initiatorStaffId}` : null;
  const copy = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };
  const Row = ({ label, value, k }: { label: string; value: string; k: string }) => (
    <div className="space-y-1">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <Input readOnly value={value} className="text-xs" />
        <Button size="sm" variant="outline" onClick={() => copy(k, value)} className="gap-1">
          {copiedKey === k ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copiedKey === k ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
  return (
    <div className="space-y-2">
      <Row label="Public intake URL (QR)" value={base} k="public" />
      {staffUrl && <Row label="Initiator-attributed URL" value={staffUrl} k="staff" />}
    </div>
  );
};

const PublicIntakeToggle = ({ outreachId, enabled }: { outreachId: string; enabled: boolean }) => {
  const update = useUpdateOutreachSession();
  return (
    <label className="flex items-center gap-2 text-xs cursor-pointer pt-1">
      <input
        type="checkbox"
        className="h-4 w-4"
        checked={enabled}
        onChange={(e) => update.mutate({ id: outreachId, patch: { public_intake_enabled: e.target.checked } as any })}
      />
      <span>Public intake enabled (turn off to pause QR submissions without cancelling)</span>
    </label>
  );
};

const CrewTab = ({ outreachId, crew, staffMap }: { outreachId: string; crew: any[]; staffMap: Map<string, string> }) => {
  const { data: staff = [] } = useRealStaff();
  const upsert = useUpsertCrew();
  const remove = useRemoveCrew();

  const [staffId, setStaffId] = useState('');
  const [role, setRole] = useState<OutreachRole>('support');
  const [share, setShare] = useState('0');

  const totalShare = useMemo(() => crew.reduce((a, c) => a + Number(c.reward_share_percent || 0), 0), [crew]);

  const add = async () => {
    if (!staffId) return;
    await upsert.mutateAsync({
      outreach_id: outreachId,
      staff_user_id: staffId,
      role_in_outreach: role,
      reward_share_percent: Number(share) || 0,
    });
    setStaffId(''); setShare('0');
  };

  return (
    <div className="space-y-3">
      <Card className="p-3 space-y-3">
        <h4 className="text-sm font-semibold">Add crew member</h4>
        <div className="grid grid-cols-12 gap-2">
          <Select value={staffId} onValueChange={setStaffId}>
            <SelectTrigger className="col-span-5"><SelectValue placeholder="Select staff" /></SelectTrigger>
            <SelectContent>
              {staff.filter((s) => !crew.find((c) => c.staff_user_id === s.id)).map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={role} onValueChange={(v) => setRole(v as OutreachRole)}>
            <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
            <SelectContent>
              {roles.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input className="col-span-2" type="number" min={0} max={100} value={share} onChange={(e) => setShare(e.target.value)} placeholder="%" />
          <Button className="col-span-2 gap-1" onClick={add} disabled={!staffId}><Plus className="w-3 h-3" />Add</Button>
        </div>
      </Card>

      <div className="space-y-2">
        {crew.map((c: any) => (
          <Card key={c.id} className="p-3 flex items-center justify-between text-sm">
            <div>
              <div className="font-semibold">{staffMap.get(c.staff_user_id) ?? c.staff_user_id}</div>
              <div className="text-xs text-muted-foreground capitalize">{c.role_in_outreach}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">{Number(c.reward_share_percent).toFixed(2)}%</span>
              <Button size="icon" variant="ghost" onClick={() => remove.mutate({ id: c.id, outreach_id: outreachId })}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <p className={'text-xs ' + (Math.abs(totalShare - 100) < 0.01 ? 'text-emerald-400' : 'text-amber-400')}>
        Total reward share: {totalShare.toFixed(2)}% {Math.abs(totalShare - 100) >= 0.01 && '(should equal 100% before reward computation)'}
      </p>
    </div>
  );
};

const QuickCapture = ({ outreachId, disabled }: { outreachId: string; disabled: boolean }) => {
  const capture = useCaptureOutreachLead();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const submit = async () => {
    if (!name.trim()) return;
    await capture.mutateAsync({ outreach_id: outreachId, full_name: name, phone: phone || undefined, notes: notes || undefined });
    setName(''); setPhone(''); setNotes('');
  };

  return (
    <Card className="p-3 space-y-2">
      <h4 className="text-sm font-semibold">Quick Capture {disabled && <span className="text-xs text-muted-foreground">(activate outreach first)</span>}</h4>
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Full name *" value={name} onChange={(e) => setName(e.target.value)} disabled={disabled} />
        <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={disabled} />
      </div>
      <Textarea rows={1} placeholder="Notes (interest, etc.)" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={disabled} />
      <Button size="sm" className="w-full" onClick={submit} disabled={disabled || !name.trim() || capture.isPending}>
        {capture.isPending ? 'Capturing…' : 'Capture lead'}
      </Button>
    </Card>
  );
};

const ExpenseLogger = ({ outreachId }: { outreachId: string }) => {
  const log = useLogOutreachExpense();
  const [cat, setCat] = useState('transportation');
  const [amt, setAmt] = useState('');
  const [notes, setNotes] = useState('');
  const submit = async () => {
    const n = Number(amt);
    if (!(n > 0)) return;
    await log.mutateAsync({ outreach_id: outreachId, category: cat, amount: n, notes: notes || undefined });
    setAmt(''); setNotes('');
  };
  return (
    <Card className="p-3 space-y-2">
      <h4 className="text-sm font-semibold">Log outreach expense</h4>
      <div className="grid grid-cols-12 gap-2">
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="col-span-4"><SelectValue /></SelectTrigger>
          <SelectContent>
            {expenseCats.map((c) => <SelectItem key={c} value={c} className="capitalize">{c.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input className="col-span-4" type="number" min={0} placeholder="Amount ₦" value={amt} onChange={(e) => setAmt(e.target.value)} />
        <Input className="col-span-4" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button size="sm" className="w-full" onClick={submit} disabled={!amt || log.isPending}>
        {log.isPending ? 'Logging…' : 'Log expense'}
      </Button>
    </Card>
  );
};

const RewardsTab = ({ outreachId, rewards, staffMap }: { outreachId: string; rewards: any[]; staffMap: Map<string, string> }) => {
  const approve = useApproveReward();
  const reject = useRejectReward();

  if (rewards.length === 0) {
    return <p className="text-sm text-muted-foreground">No rewards computed. Reconcile the outreach to compute pending rewards.</p>;
  }

  return (
    <div className="space-y-2">
      {rewards.map((r) => (
        <Card key={r.id} className="p-3 flex items-center justify-between text-sm">
          <div>
            <div className="font-semibold">{staffMap.get(r.beneficiary_staff_id) ?? r.beneficiary_staff_id}</div>
            <div className="text-xs text-muted-foreground">
              {Number(r.percent).toFixed(2)}% of net (basis {fmt(r.basis_amount)})
              {r.notes && ` · ${r.notes}`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="font-semibold">{fmt(r.amount)}</div>
              <Badge variant="outline" className="text-[10px] uppercase">{r.status}</Badge>
            </div>
            {r.status === 'pending' && (
              <div className="flex flex-col gap-1">
                <Button size="sm" onClick={() => approve.mutate({ id: r.id, outreach_id: outreachId })}>Approve</Button>
                <Button size="sm" variant="ghost" onClick={() => reject.mutate({ id: r.id, outreach_id: outreachId })}>Reject</Button>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
};

export default OutreachDetailSheet;

// ============= Pending Orders Tab =============

const PendingOrdersTab = ({
  outreachId,
  orders,
  staffMap,
}: {
  outreachId: string;
  orders: PendingOutreachOrder[];
  staffMap: Map<string, string>;
}) => {
  const { data: products = [] } = useProducts();
  const productMap = new Map((products as any[]).map((p) => [p.id, p]));
  const confirm = useConfirmPendingOutreachOrder();
  const cancel = useCancelPendingOutreachOrder();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [method, setMethod] = useState<'cash' | 'bank_transfer' | 'pos' | 'online'>('bank_transfer');
  const [reference, setReference] = useState('');

  const openConfirm = (o: PendingOutreachOrder) => {
    setConfirmingId(o.id);
    setMethod((o.payment_method as any) ?? 'bank_transfer');
    setReference(o.payment_reference ?? '');
  };

  const submitConfirm = async () => {
    if (!confirmingId) return;
    await confirm.mutateAsync({
      id: confirmingId,
      outreach_id: outreachId,
      payment_method: method,
      payment_reference: reference.trim() || undefined,
    });
    setConfirmingId(null);
    setReference('');
  };

  const onCancel = async (o: PendingOutreachOrder) => {
    const reason = window.prompt('Cancel pending order — reason (optional):') ?? undefined;
    if (reason === null) return;
    await cancel.mutateAsync({ id: o.id, outreach_id: outreachId, reason });
  };

  if (orders.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No pending orders. Use <strong>Record sale</strong> and toggle <em>Pending</em> to capture transfer/POS receivables before payment lands.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {orders.map((o) => {
        const product = productMap.get(o.product_id);
        const total = Number(o.quantity) * Number(o.unit_price);
        const isOpen = confirmingId === o.id;
        return (
          <Card key={o.id} className="p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm">
                <div className="font-semibold flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  {product?.name ?? 'Product'} × {Number(o.quantity)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {o.customer_name ?? 'Customer'} · {o.customer_phone}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {o.attributed_staff_id && (
                    <span>
                      <span className="text-muted-foreground/70">Sold by</span>{' '}
                      <span className="text-foreground font-medium">
                        {staffMap.get(o.attributed_staff_id) ?? '—'}
                      </span>
                    </span>
                  )}
                  {o.payment_method && ` · ${o.payment_method.replace('_', ' ')}`}
                  {o.payment_reference && ` · ref ${o.payment_reference}`}
                </div>
                {o.notes && <div className="text-[11px] text-muted-foreground italic mt-1">{o.notes}</div>}
              </div>
              <div className="text-right">
                <div className="font-semibold">{fmt(total)}</div>
                <div className="text-[10px] text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
              </div>
            </div>

            {!isOpen ? (
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="gap-1" onClick={() => openConfirm(o)}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Mark paid
                </Button>
                <Button size="sm" variant="ghost" className="gap-1" onClick={() => onCancel(o)}>
                  <X className="w-3.5 h-3.5" /> Cancel
                </Button>
              </div>
            ) : (
              <div className="rounded-md border border-border/40 bg-muted/20 p-2 space-y-2">
                <div className="grid grid-cols-4 gap-1 text-[10px]">
                  {(['cash', 'bank_transfer', 'pos', 'online'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={
                        'rounded py-1.5 capitalize transition ' +
                        (method === m
                          ? 'bg-primary/20 text-primary border border-primary/40'
                          : 'bg-muted/30 text-muted-foreground border border-transparent')
                      }
                    >
                      {m.replace('_', ' ')}
                    </button>
                  ))}
                </div>
                {method !== 'cash' && (
                  <Input
                    placeholder="Reference (optional)"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="h-9 text-xs"
                  />
                )}
                <div className="flex gap-2">
                  <Button size="sm" onClick={submitConfirm} disabled={confirm.isPending} className="flex-1">
                    {confirm.isPending ? 'Posting…' : 'Confirm payment'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmingId(null)}>Back</Button>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};