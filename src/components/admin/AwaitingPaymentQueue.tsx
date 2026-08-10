import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Check, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useRealAppointments } from '@/hooks/useRealAppointments';
import { useRealClients } from '@/hooks/useRealClients';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import ConfirmDepositDialog from './ConfirmDepositDialog';

const fmtNGN = (n: number | null | undefined) =>
  n != null ? `₦${Number(n).toLocaleString()}` : '—';

/**
 * Admin-only queue of bookings waiting for payment confirmation. Each
 * booking-group (single submission) is rolled into one row so a multi-service
 * cart confirms together with one click.
 */
const AwaitingPaymentQueue = () => {
  const { isAdmin } = useAuth();
  const { data: appts = [] } = useRealAppointments();
  const { data: clients = [] } = useRealClients();
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<{
    key: string;
    items: typeof appts;
    total: number;
    label: string;
  } | null>(null);

  // Read the configurable global deposit floor; default to 20% if unset
  // or the row hasn't been migrated yet for some reason.
  const { data: settings } = useQuery({
    queryKey: ['booking-settings-deposit'],
    queryFn: async () => {
      const { data } = await supabase
        .from('booking_settings')
        .select('min_deposit_percent')
        .eq('id', true)
        .maybeSingle();
      return (data as { min_deposit_percent?: number } | null) ?? null;
    },
    staleTime: 60_000,
  });
  const minDepositPercent = Number(settings?.min_deposit_percent ?? 20) || 20;

  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);

  // Group awaiting appointments by booking_group_id (or appointment id when no group).
  const groups = useMemo(() => {
    const pending = appts.filter(
      (a) => (a as { payment_status?: string }).payment_status === 'awaiting_confirmation'
        && a.status !== 'cancelled' && a.status !== 'no_show',
    );
    const map = new Map<string, typeof pending>();
    for (const a of pending) {
      const key = (a as { booking_group_id?: string | null }).booking_group_id ?? a.id;
      const arr = map.get(key) ?? [];
      arr.push(a);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .map(([key, items]) => {
        const sorted = [...items].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
        const first = sorted[0];
        const total = items.reduce(
          (s, it) => s + (Number((it as { total_amount?: number | null }).total_amount) || 0),
          0,
        );
        return { key, items: sorted, first, total };
      })
      .sort((a, b) =>
        `${a.first.date}T${a.first.time}`.localeCompare(`${b.first.date}T${b.first.time}`),
      );
  }, [appts]);

  if (!isAdmin) return null;

  /**
   * Splits the recorded deposit proportionally across every appointment in
   * the booking group, then flips them all to `confirmed`. The per-row
   * `amount_paid` is what the DB trigger validates against.
   */
  const confirmGroupWithDeposit = async (
    key: string,
    items: typeof groups[number]['items'],
    amountReceived: number,
  ) => {
    setConfirming(key);
    try {
      const totals = items.map(
        (it) => Number((it as { total_amount?: number | null }).total_amount) || 0,
      );
      const sumTotal = totals.reduce((a, b) => a + b, 0);
      // Allocate proportionally; if every row is zero-priced (rare), spread evenly.
      const allocations = totals.map((t, i) => {
        if (sumTotal > 0) return Math.round((amountReceived * t) / sumTotal);
        return Math.round(amountReceived / items.length);
      });

      // Update one-by-one so the trigger sees `amount_paid` and the new
      // `payment_status` in a single row update — the BEFORE trigger
      // validates against NEW.amount_paid + NEW.payment_status together.
      for (let i = 0; i < items.length; i++) {
        const { error } = await supabase
          .from('appointments')
          .update({
            amount_paid: allocations[i],
            payment_status: 'confirmed',
          })
          .eq('id', items[i].id);
        if (error) throw error;
      }
      toast.success(items.length > 1 ? `Confirmed ${items.length} appointments` : 'Payment confirmed');
      await qc.invalidateQueries({ queryKey: ['real-appointments'] });
      setActiveGroup(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not confirm payment');
    } finally {
      setConfirming(null);
    }
  };

  return (
    <div className="glass rounded-xl p-4 sm:p-6 space-y-4 border border-amber-500/20">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-amber-700 font-semibold" />
          </div>
          <div>
            <h2 className="font-display font-bold text-foreground">Awaiting payment</h2>
            <p className="text-[11px] text-muted-foreground">
              Confirm transfers from clients. Only admins can mark a booking as paid.
            </p>
          </div>
        </div>
        <span className="text-xs text-amber-700 font-semibold font-semibold">{groups.length} pending</span>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No bookings awaiting confirmation. 
        </p>
      ) : (
        <div className="space-y-2">
          {groups.map(({ key, items, first, total }) => {
            const c = clientById[first.client_id];
            const treatmentLine = items.map((i) => i.treatment).join(' + ');
            return (
              <div
                key={key}
                className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/admin/clients/${first.client_id}`}
                      className="font-semibold text-foreground hover:text-primary inline-flex items-center gap-1"
                    >
                      {c?.full_name ?? 'Unknown client'}
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                    {c?.client_code && (
                      <span className="text-[10px] text-muted-foreground">{c.client_code}</span>
                    )}
                  </div>
                  <p className="text-xs text-foreground">{treatmentLine}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {first.date} · {first.time}
                    {items.length > 1 && ` · ${items.length} services back-to-back`}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</p>
                    <p className="text-sm font-semibold text-foreground">{fmtNGN(total)}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      const c = clientById[first.client_id];
                      const treatmentLine = items.map((i) => i.treatment).join(' + ');
                      setActiveGroup({
                        key,
                        items,
                        total,
                        label: `${c?.full_name ?? 'Client'} — ${treatmentLine}`,
                      });
                    }}
                    disabled={confirming === key}
                    className="glow-primary"
                  >
                    {confirming === key ? (
                      <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Confirming…</>
                    ) : (
                      <><Check className="w-3.5 h-3.5 mr-1.5" /> Confirm payment</>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDepositDialog
        open={!!activeGroup}
        onClose={() => setActiveGroup(null)}
        totalAmount={activeGroup?.total ?? 0}
        minDepositPercent={minDepositPercent}
        bookingLabel={activeGroup?.label ?? ''}
        onConfirm={async (amt) => {
          if (!activeGroup) return;
          await confirmGroupWithDeposit(activeGroup.key, activeGroup.items, amt);
        }}
      />
    </div>
  );
};

export default AwaitingPaymentQueue;
