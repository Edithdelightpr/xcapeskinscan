import { useMemo, useState } from 'react';
import { Link2, Copy, MessageCircle, ExternalLink, Save, Sparkles, TrendingUp, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useRealStaff, useUpdateStaff } from '@/hooks/useRealStaff';
import { useRealClients } from '@/hooks/useRealClients';
import { useMyCommissionTotal, useCommissionSettings } from '@/hooks/useCommissions';
import { formatNaira } from '@/lib/finance';

/**
 * Personal booking-link card shown on every staff dashboard.
 * - If the user hasn't claimed a slug yet → inline "claim your link" form.
 * - Otherwise → copy / WhatsApp / open buttons + a count of leads earned.
 * Attribution flows through public-create-booking edge fn, which writes
 * `attributed_staff_id` on both the new client and appointment.
 */
const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

const MyBookingLinkCard = () => {
  const { user } = useAuth();
  const { data: staff = [] } = useRealStaff();
  const { data: clients = [] } = useRealClients();
  const updateStaff = useUpdateStaff();

  const me = staff.find((s) => s.id === user?.id);
  const suggested = useMemo(() => slugify(me?.full_name ?? me?.email?.split('@')[0] ?? 'me'), [me]);
  const [draft, setDraft] = useState('');

  const slug = me?.booking_slug?.trim() || null;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const fullUrl = slug ? `${origin}/schedule/${slug}` : '';

  // Leads earned via this link (or any attribution to me)
  const myLeadsThisMonth = useMemo(() => {
    if (!user?.id) return 0;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    return clients.filter(
      (c) => c.attributed_staff_id === user.id && (c.created_at ?? '') >= monthStart && !c.archived,
    ).length;
  }, [clients, user?.id]);

  const totalMyLeads = useMemo(
    () => (user?.id ? clients.filter((c) => c.attributed_staff_id === user.id && !c.archived).length : 0),
    [clients, user?.id],
  );

  // Commission earned this month (only shown when engine is active)
  const monthStartIso = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1).toISOString();
  }, []);
  const { data: commissionTotal = 0 } = useMyCommissionTotal(monthStartIso);
  const { data: commissionSettings } = useCommissionSettings();
  const showCommission = !!commissionSettings?.enabled;

  const claimSlug = async () => {
    const value = slugify(draft || suggested);
    if (value.length < 2) {
      toast.error('Pick a longer link name (letters, numbers, dashes).');
      return;
    }
    const taken = staff.some((s) => s.id !== user?.id && s.booking_slug === value);
    if (taken) {
      toast.error('That link is already taken — try another.');
      return;
    }
    try {
      await updateStaff.mutateAsync({ id: user!.id, patch: { booking_slug: value } });
      toast.success('Your booking link is live!');
      setDraft('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save link');
    }
  };

  const copyLink = async () => {
    if (!fullUrl) return;
    try {
      await navigator.clipboard.writeText(fullUrl);
      toast.success('Link copied!');
    } catch {
      toast.info(fullUrl);
    }
  };

  const shareWhatsApp = () => {
    if (!fullUrl) return;
    const msg = `Hi! Book your Tropics MedSpa appointment with me here: ${fullUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const [showQr, setShowQr] = useState(false);
  const qrSrc = fullUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=0&data=${encodeURIComponent(fullUrl)}`
    : '';

  if (!me) return null;

  // ---- Empty state: claim a slug ----
  if (!slug) {
    return (
      <div className="glass rounded-xl p-4 sm:p-5 border border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/15">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-foreground">Claim your personal booking link</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Every lead who books through your unique link is attributed to you for rewards.
            </p>

            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-1 bg-surface/60 rounded-md px-2 border border-border/40 overflow-hidden">
                <span className="text-[11px] text-muted-foreground font-mono whitespace-nowrap shrink-0">/schedule/</span>
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={suggested}
                  className="border-0 bg-transparent h-10 px-1 text-xs font-mono focus-visible:ring-0 min-w-0"
                />
              </div>
              <Button onClick={claimSlug} disabled={updateStaff.isPending} className="glow-primary w-full sm:w-auto h-10">
                <Save className="w-4 h-4 mr-1.5" /> Claim link
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Letters, numbers, and dashes only. Suggested: <span className="font-mono">{suggested}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---- Active state: link + share + stats ----
  return (
    <div className="glass rounded-xl p-4 sm:p-5 border border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/15 shrink-0">
          <Link2 className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-bold text-foreground text-sm sm:text-base">Your booking link</h3>
          <p className="text-[11px] text-muted-foreground leading-snug">Share with leads — every booking is attributed to you.</p>
        </div>
      </div>

      {/* Stats strip — always 2 columns on mobile, inline-right on md+ */}
      <div className="mt-3 grid grid-cols-2 sm:flex sm:justify-end gap-3 sm:gap-6 text-left sm:text-right">
        <div className="rounded-lg bg-surface/40 sm:bg-transparent border border-border/30 sm:border-0 p-2 sm:p-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">This month</p>
          <p className="text-xl font-display font-bold text-emerald-300 leading-none flex items-center gap-1 mt-1 sm:justify-end">
            <TrendingUp className="w-4 h-4" /> {myLeadsThisMonth}
          </p>
        </div>
        <div className="rounded-lg bg-surface/40 sm:bg-transparent border border-border/30 sm:border-0 p-2 sm:p-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">All time</p>
          <p className="text-xl font-display font-bold text-foreground leading-none mt-1">{totalMyLeads}</p>
        </div>
        {showCommission && (
          <div className="rounded-lg bg-accent/10 sm:bg-transparent border border-accent/30 sm:border-0 p-2 sm:p-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Commission · this month</p>
            <p className="text-xl font-display font-bold text-accent leading-none mt-1">{formatNaira(commissionTotal)}</p>
          </div>
        )}
      </div>

      {/* URL field with embedded copy button — never overflows on mobile */}
      <div className="mt-4 relative">
        <Input
          value={fullUrl}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
          className="font-mono text-xs h-11 pr-12 truncate"
          aria-label="Your booking link"
        />
        <button
          type="button"
          onClick={copyLink}
          aria-label="Copy link"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>

      {/* Action grid: 2x2 on phones, inline on sm+ */}
      <div className="mt-3 grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
        <Button size="sm" onClick={copyLink} className="glow-primary h-10 sm:h-9 w-full sm:w-auto">
          <Copy className="w-4 h-4 mr-1.5" /> Copy
        </Button>
        <Button size="sm" variant="outline" onClick={shareWhatsApp} className="h-10 sm:h-9 w-full sm:w-auto">
          <MessageCircle className="w-4 h-4 mr-1.5" /> WhatsApp
        </Button>
        <Button size="sm" variant="outline" asChild className="h-10 sm:h-9 w-full sm:w-auto">
          <a href={fullUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4 mr-1.5" /> Preview
          </a>
        </Button>
        {qrSrc && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowQr((v) => !v)}
            className="h-10 sm:h-9 w-full sm:w-auto"
          >
            <QrCode className="w-4 h-4 mr-1.5" /> {showQr ? 'Hide QR' : 'Show QR'}
          </Button>
        )}
      </div>

      {/* QR — collapsible on mobile, centered */}
      {qrSrc && showQr && (
        <div className="mt-4 flex justify-center">
          <div className="bg-white p-2.5 rounded-lg shrink-0">
            <img src={qrSrc} alt="QR code for your booking link" width={140} height={140} loading="lazy" />
          </div>
        </div>
      )}
    </div>
  );
};

export default MyBookingLinkCard;