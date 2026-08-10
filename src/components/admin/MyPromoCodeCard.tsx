import { useEffect, useMemo, useState } from 'react';
import { Ticket, Copy, Save, Sparkles, TrendingUp, RefreshCw, MessageCircle, Link2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRealStaff, useUpdateStaff, type StaffWithRoles } from '@/hooks/useRealStaff';
import { formatNaira } from '@/lib/finance';
import { useQuery } from '@tanstack/react-query';
import { buildShareMessage } from './ShareReportDialog';
import { BRAND } from '@/lib/brand';

/**
 * "Your promo code" card. One code per practitioner, auto-embedded into every
 * report they share. Attribution + redemption tracking runs off the code.
 */
const codify = (s: string) =>
  s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);

interface PromoStats {
  reports_shared: number;
  redemptions: number;
  unique_visitors: number;
  conversions: number;
  revenue_attributed: number;
}

const MyPromoCodeCard = () => {
  const { user } = useAuth();
  const { data: staff = [] } = useRealStaff();
  const updateStaff = useUpdateStaff();

  const me = staff.find((s) => s.id === user?.id) as StaffWithRoles | undefined;
  const suggested = useMemo(
    () => codify((me?.full_name ?? me?.email?.split('@')[0] ?? 'me') + '10'),
    [me],
  );

  const [draftCode, setDraftCode] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing && me) {
      setDraftCode(me.promo_code ?? '');
    }
  }, [me, editing]);

  const monthStart = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1).toISOString();
  }, []);

  const { data: monthStats } = useQuery({
    queryKey: ['my-promo-stats', user?.id, 'month', monthStart],
    enabled: !!user?.id,
    queryFn: async (): Promise<PromoStats> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('rpc_my_promo_stats', {
        _from: monthStart,
        _to: null,
      });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = Array.isArray(data) ? (data[0] as any) : (data as any);
      return {
        reports_shared: Number(row?.reports_shared ?? 0),
        redemptions: Number(row?.redemptions ?? 0),
        unique_visitors: Number(row?.unique_visitors ?? 0),
        conversions: Number(row?.conversions ?? 0),
        revenue_attributed: Number(row?.revenue_attributed ?? 0),
      };
    },
  });

  if (!me) return null;

  const activeCode = me.promo_code?.trim() ?? null;

  const save = async () => {
    const code = codify(draftCode || suggested);
    if (code.length < 3) {
      toast.error('Promo codes need at least 3 letters/numbers.');
      return;
    }
    const taken = staff.some(
      (s) => s.id !== me.id && (s.promo_code ?? '').toLowerCase() === code.toLowerCase(),
    );
    if (taken) {
      toast.error('That code is already taken — try another.');
      return;
    }
    try {
      await updateStaff.mutateAsync({
        id: me.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        patch: {
          promo_code: code,
          promo_code_updated_at: new Date().toISOString(),
        } as any,
      });
      toast.success('Promo code saved');
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    }
  };

  const copyCode = async () => {
    if (!activeCode) return;
    try {
      await navigator.clipboard.writeText(activeCode);
      toast.success('Code copied!');
    } catch {
      toast.info(activeCode);
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const referralLink = me.booking_slug ? `${origin}/book/${me.booking_slug}` : null;

  const previewMessage = buildShareMessage({
    first: 'Amina',
    reportUrl: `${origin}/report/…secure-link…`,
    promoCode: activeCode,
    promoPct: me.promo_discount_pct ?? null,
    referralLink,
  });

  const copyReferral = async () => {
    if (!referralLink) {
      toast.error('Set your booking slug in "Your booking link" first.');
      return;
    }
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success('Referral link copied');
    } catch {
      toast.info(referralLink);
    }
  };

  const copyPreview = async () => {
    try {
      await navigator.clipboard.writeText(previewMessage);
      toast.success('Message copied — paste into WhatsApp');
    } catch {
      toast.info('Copy failed');
    }
  };

  return (
    <div className="glass rounded-xl p-4 sm:p-5 border border-accent/30 bg-gradient-to-br from-accent/5 to-primary/5">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-accent/15 shrink-0">
          <Ticket className="w-5 h-5 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-bold text-foreground text-sm sm:text-base">
            Your promo code
          </h3>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Auto-embedded in every report you share. Clients redeem in-clinic — attribution + revenue tracked automatically.
          </p>
        </div>
        {activeCode && !editing && (
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                me.promo_active
                  ? 'text-emerald-300 border-emerald-400/40 bg-emerald-400/10'
                  : 'text-muted-foreground border-border/40 bg-surface/40'
              }`}
            >
              {me.promo_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        )}
      </div>

      {(!activeCode || editing) ? (
        <div className="mt-3 space-y-2">
          <Input
            value={draftCode}
            onChange={(e) => setDraftCode(codify(e.target.value))}
            placeholder={suggested}
            className="font-mono text-sm tracking-wider h-10"
            maxLength={16}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={updateStaff.isPending} className="glow-primary h-10">
              <Save className="w-4 h-4 mr-1.5" /> Save code
            </Button>
            {activeCode && (
              <Button variant="outline" className="h-10" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
            <Lock className="w-3 h-3" /> Letters and numbers only, 3–16 characters. Your discount % is set by admin.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 shadow-md">
              <Sparkles className="w-4 h-4" />
              <span className="font-display font-bold tracking-widest text-base sm:text-lg">
                {activeCode}
              </span>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-accent">
              <Lock className="w-3 h-3 opacity-70" />
              {me.promo_discount_pct != null
                ? `${Number(me.promo_discount_pct)}% off`
                : 'Discount not set'}
            </span>
            <Button size="sm" variant="outline" onClick={copyCode} className="h-9">
              <Copy className="w-4 h-4 mr-1.5" /> Copy
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="h-9">
              <RefreshCw className="w-4 h-4 mr-1.5" /> Edit
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 inline-flex items-center gap-1">
            <Lock className="w-3 h-3" /> Discount % and active status are set by admin.
          </p>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Stat label="Reports shared" value={String(monthStats?.reports_shared ?? 0)} />
            <Stat label="Redemptions" value={String(monthStats?.redemptions ?? 0)} />
            <Stat label="Unique clients" value={String(monthStats?.unique_visitors ?? 0)} />
            <Stat label="Conversions" value={String(monthStats?.conversions ?? 0)} />
            <Stat
              label="Revenue"
              value={formatNaira(monthStats?.revenue_attributed ?? 0)}
              highlight
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 inline-flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Stats reset each month.
          </p>

          {/* Referral link + WhatsApp preview — one card, no extra clicks */}
          <div className="mt-4 rounded-lg border border-border/40 bg-surface/50 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                <Link2 className="w-3 h-3" /> Your referral / booking link
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={copyReferral}
                className="h-8"
                disabled={!referralLink}
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy link
              </Button>
            </div>
            <p className="text-xs font-mono text-foreground/90 break-all">
              {referralLink ?? 'Claim your booking slug in "Your booking link" above.'}
            </p>
          </div>

          <div className="mt-3 rounded-lg border border-border/40 bg-surface/50 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                <MessageCircle className="w-3 h-3" /> WhatsApp share preview
              </p>
              <Button size="sm" variant="outline" onClick={copyPreview} className="h-8">
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy message
              </Button>
            </div>
            <pre className="text-[11px] leading-snug text-foreground/85 whitespace-pre-wrap font-sans">
{previewMessage}
            </pre>
            <p className="text-[10px] text-muted-foreground">
              Reception at {BRAND.phone}. This preview is what clients see when you share a report.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

const Stat = ({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) => (
  <div className="rounded-lg bg-surface/40 border border-border/30 p-2 text-center">
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p
      className={`font-display font-bold mt-0.5 leading-none ${
        highlight ? 'text-accent text-sm sm:text-base' : 'text-foreground text-base sm:text-lg'
      }`}
    >
      {value}
    </p>
  </div>
);

export default MyPromoCodeCard;