import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet, MessageCircle, ExternalLink, Phone, X, Globe, Megaphone, Clock, Package,
  Truck, Store, MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useRealStaff } from '@/hooks/useRealStaff';
import { usePendingProductOrders, type PendingOrderGroup, type PendingOrderStatus } from '@/hooks/usePendingProductOrders';
import { formatNaira } from '@/lib/finance';
import { openWhatsApp } from '@/lib/whatsapp';
import { toast } from 'sonner';
import AttributionTag from '@/components/shared/AttributionTag';
import MarkOrderPaidDialog from './MarkOrderPaidDialog';

type StatusFilter = PendingOrderStatus;
type SourceFilter = 'all' | 'website' | 'outreach';

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'pending', label: 'Awaiting confirmation' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
];

const SOURCE_TABS: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'website', label: 'Website' },
  { value: 'outreach', label: 'Outreach' },
];

const fmtAgo = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

const PendingProductPaymentsQueue = () => {
  const { isAdmin } = useAuth();
  const { groups, isLoading, confirmGroup, cancelGroup } = usePendingProductOrders();
  const { data: staff = [] } = useRealStaff();
  const staffById = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s])), [staff]);

  const [status, setStatus] = useState<StatusFilter>('pending');
  const [source, setSource] = useState<SourceFilter>('all');
  const [confirmTarget, setConfirmTarget] = useState<PendingOrderGroup | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PendingOrderGroup | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  if (!isAdmin) return null;

  const filtered = groups.filter((g) =>
    g.status === status && (source === 'all' || g.source === source),
  );
  const pendingCount = groups.filter((g) => g.status === 'pending').length;

  const handleConfirm = async (method: string, reference: string) => {
    if (!confirmTarget) return;
    try {
      await confirmGroup.mutateAsync({
        group: confirmTarget,
        payment_method: method || null,
        payment_reference: reference || null,
      });
      toast.success(`Order ${confirmTarget.order_ref ?? ''} confirmed — sale finalized.`);
      setConfirmTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not confirm payment');
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelGroup.mutateAsync({
        group: cancelTarget,
        reason: cancelReason.trim() || null,
      });
      toast.success('Order cancelled');
      setCancelTarget(null);
      setCancelReason('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not cancel');
    }
  };

  return (
    <div className="glass rounded-xl p-4 sm:p-6 space-y-4 border border-emerald-500/20">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-emerald-300" />
          </div>
          <div>
            <h2 className="font-display font-bold text-foreground">Payment confirmations</h2>
            <p className="text-[11px] text-muted-foreground">
              Verify product orders before stock and revenue are posted.
            </p>
          </div>
        </div>
        <span className="text-xs text-emerald-300 font-semibold">{pendingCount} awaiting</span>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-1 rounded-lg bg-muted/30 p-1 overflow-x-auto">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setStatus(t.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition ${
                status === t.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >{t.label}</button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg bg-muted/30 p-1">
          {SOURCE_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setSource(t.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition ${
                source === t.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No {status === 'pending' ? 'pending' : status} orders{source !== 'all' ? ` from ${source}` : ''}.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((g) => {
            const soldByName = g.attributed_staff_id ? staffById[g.attributed_staff_id]?.full_name : null;
            const sourceBadge = g.source === 'outreach'
              ? <Badge variant="secondary" className="gap-1"><Megaphone className="w-3 h-3" /> Outreach</Badge>
              : <Badge variant="outline" className="gap-1"><Globe className="w-3 h-3" /> Website</Badge>;

            return (
              <div
                key={g.groupKey}
                className="rounded-lg border border-border/40 bg-card/50 p-3 sm:p-4 space-y-3"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {g.order_ref ?? g.groupKey.slice(0, 8)}
                      </span>
                      {sourceBadge}
                      <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {fmtAgo(g.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {g.customer_client_id ? (
                        <Link
                          to={`/admin/clients/${g.customer_client_id}`}
                          className="font-semibold text-foreground hover:text-primary inline-flex items-center gap-1"
                        >
                          {g.customer_name ?? 'Client'}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      ) : (
                        <span className="font-semibold">{g.customer_name ?? 'Unknown'}</span>
                      )}
                      <a
                        href={`tel:${g.customer_phone}`}
                        className="text-[11px] text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"
                      >
                        <Phone className="w-3 h-3" /> {g.customer_phone}
                      </a>
                    </div>
                    <AttributionTag soldByName={soldByName} />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
                    <p className="text-lg font-bold text-foreground">{formatNaira(g.total)}</p>
                      {g.delivery_method === 'delivery' ? (
                        <Badge variant="outline" className="mt-1 gap-1 text-[10px]">
                          <Truck className="w-3 h-3" />
                          {g.delivery_fee > 0 ? 'Delivery paid' : 'Free delivery'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="mt-1 gap-1 text-[10px]">
                          <Store className="w-3 h-3" /> Pickup
                        </Badge>
                      )}
                  </div>
                </div>

                {/* Items */}
                <div className="rounded-md bg-muted/20 p-2 space-y-1">
                  {g.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1.5 truncate">
                        <Package className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{it.product_name ?? 'Product'}</span>
                        <span className="text-muted-foreground">×{Number(it.quantity)}</span>
                      </span>
                      <span className="font-medium whitespace-nowrap">
                        {formatNaira(Number(it.quantity) * Number(it.unit_price))}
                      </span>
                    </div>
                  ))}
                </div>

                  {/* Totals breakdown */}
                  <div className="rounded-md border border-border/30 bg-background/40 p-2 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span>{formatNaira(g.subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>{g.delivery_method === 'delivery' ? 'Delivery fee' : 'Pickup'}</span>
                      <span>{g.delivery_fee > 0 ? formatNaira(g.delivery_fee) : '₦0'}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border/30 pt-1 font-semibold text-foreground">
                      <span>Grand total</span>
                      <span>{formatNaira(g.total)}</span>
                    </div>
                  </div>

                  {/* Delivery address */}
                  {g.delivery_method === 'delivery' && g.delivery_address && (
                    <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                      <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
                      <span className="text-foreground">{g.delivery_address}</span>
                    </div>
                  )}

                {/* Payment meta */}
                {(g.payment_method || g.payment_reference) && (
                  <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3">
                    {g.payment_method && <span>Method: <span className="text-foreground">{g.payment_method}</span></span>}
                    {g.payment_reference && <span>Ref: <span className="text-foreground font-mono">{g.payment_reference}</span></span>}
                  </div>
                )}

                {/* Actions */}
                {g.status === 'pending' ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      className="gap-1.5 flex-1 sm:flex-initial glow-primary"
                      onClick={() => setConfirmTarget(g)}
                    >
                      Mark paid
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => openWhatsApp(g.customer_phone, `Hello ${g.customer_name ?? ''}, regarding your order ${g.order_ref ?? ''}.`)}
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => setCancelTarget(g)}
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </Button>
                    {g.outreach_id && (
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/outreach/portal?session=${g.outreach_id}`}>
                          View outreach
                        </Link>
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="text-[11px] text-muted-foreground pt-1">
                    {g.status === 'paid' ? 'Confirmed and posted to revenue.' : 'Cancelled.'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <MarkOrderPaidDialog
        group={confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleConfirm}
        loading={confirmGroup.isPending}
      />

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) { setCancelTarget(null); setCancelReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject order?</AlertDialogTitle>
            <AlertDialogDescription>
              This cancels the pending order. No inventory or revenue is affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason (optional)"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelGroup.isPending}>Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleCancel(); }}
              disabled={cancelGroup.isPending}
            >
              Reject order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PendingProductPaymentsQueue;