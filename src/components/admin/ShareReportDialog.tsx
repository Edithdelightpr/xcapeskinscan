import { useEffect, useMemo, useState } from 'react';
import {
  Link2,
  Copy,
  MessageCircle,
  Mail,
  XCircle,
  Loader2,
  ShieldAlert,
  CheckCircle2,
  Eye,
  MousePointerClick,
  Download,
  ChevronDown,
  ChevronUp,
  CalendarCheck,
  Sparkles,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import type { RealClient } from '@/hooks/useRealClients';
import type { VisitAssessment } from '@/hooks/useVisitAssessments';
import {
  useAssessmentReportLinks,
  useReportEventsForLinks,
  useCreateReportLink,
  useRevokeReportLink,
  useRecoverReportLinkUrl,
  activeLinkOf,
} from '@/hooks/useReportLinks';
import { openWhatsApp } from '@/lib/whatsapp';
import { supabase } from '@/integrations/supabase/client';
import { resolveClientFirstName } from '@/lib/clientName';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useAuth } from '@/hooks/useAuth';
import { BRAND } from '@/lib/brand';
import { buildReportShareMessage } from '@/lib/reportShareMessage';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  open: boolean;
  onClose: () => void;
  client: RealClient;
  assessment: VisitAssessment;
  practitionerName?: string | null;
}

const buildOrigin = () =>
  typeof window !== 'undefined' ? window.location.origin : '';

/**
 * Sunday-ready WhatsApp share message. Always includes the secure report
 * link + clinic location; appends the practitioner's promo code + discount
 * + personal booking link when they have a promo profile.
 */
export const buildShareMessage = (opts: {
  first: string;
  reportUrl: string;
  promoCode: string | null;
  promoPct: number | string | null;
  referralLink: string | null;
}) =>
  // Thin adapter over the shared builder so staff WhatsApp text and the
  // public scanner's issued link produce byte-identical messages.
  buildReportShareMessage({
    firstName: opts.first,
    reportUrl: opts.reportUrl,
    clinicAddress: `${BRAND.address.line1}, ${BRAND.address.city}`,
    clinicPhone: BRAND.phone,
    promoCode: opts.promoCode,
    promoPct: opts.promoPct,
    referralLink: opts.referralLink,
  });

const EVENT_LABEL: Record<string, string> = {
  link_viewed: 'Viewed the report',
  book_clicked: 'Clicked to book a treatment',
  product_interest: 'Showed interest in a product',
  question_clicked: 'Opened WhatsApp to ask a question',
  pdf_downloaded: 'Downloaded the PDF',
  explore_treatments: 'Explored the full menu',
  appointment_booked: 'Booked an appointment',
};

const EventIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'link_viewed': return <Eye className="w-3.5 h-3.5" />;
    case 'book_clicked': return <MousePointerClick className="w-3.5 h-3.5" />;
    case 'product_interest': return <Sparkles className="w-3.5 h-3.5" />;
    case 'question_clicked': return <MessageCircle className="w-3.5 h-3.5" />;
    case 'pdf_downloaded': return <Download className="w-3.5 h-3.5" />;
    case 'appointment_booked': return <CalendarCheck className="w-3.5 h-3.5" />;
    default: return <MousePointerClick className="w-3.5 h-3.5" />;
  }
};

const ShareReportDialog = ({
  open,
  onClose,
  client,
  assessment,
  practitionerName,
}: Props) => {
  const { data: links = [], isLoading } = useAssessmentReportLinks(assessment.id);
  const active = activeLinkOf(links);
  const linkIds = useMemo(() => links.map((l) => l.id), [links]);
  const { data: events = [] } = useReportEventsForLinks(linkIds);

  // Resolve the practitioner who OWNS this share — prefer the link creator
  // (who ran the analysis) rather than whoever's device is sharing it right
  // now. Falls back to current user so the message never goes out empty.
  const { user } = useAuth();
  const { data: staff = [] } = useRealStaff();
  const ownerId = active?.created_by ?? user?.id ?? null;
  const owner = staff.find((s) => s.id === ownerId) ?? null;
  const promoCode = owner?.promo_active && owner?.promo_code ? owner.promo_code : null;
  const promoPct = owner?.promo_discount_pct ?? null;
  const referralLink = owner?.booking_slug
    ? `${buildOrigin()}/book/${owner.booking_slug}`
    : null;

  const createMut = useCreateReportLink();
  const revokeMut = useRevokeReportLink();
  const recoverMut = useRecoverReportLinkUrl();

  // The URL for the current active link. On open, we recover it from the
  // server (HMAC re-derivation) so staff never have to remember it. Cleared
  // when the dialog closes. Legacy random-token rows cannot be recovered —
  // we surface that as a "Regenerate to heal" affordance instead of silently
  // revoking them.
  const [freshUrl, setFreshUrl] = useState<string | null>(null);
  const [legacyUnrecoverable, setLegacyUnrecoverable] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  useEffect(() => {
    if (!open) {
      setFreshUrl(null);
      setLegacyUnrecoverable(false);
      setConfirmRegenerate(false);
      return;
    }
    // Try to recover the URL for the current active link on open.
    if (!active) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await recoverMut.mutateAsync({
          client_id: client.id,
          assessment_id: assessment.id,
          link_id: active.id,
        });
        if (cancelled) return;
        if (res && res.ok) {
          setFreshUrl(res.url);
          setLegacyUnrecoverable(false);
        } else if (res && res.ok === false) {
          setFreshUrl(null);
          setLegacyUnrecoverable(true);
        }
      } catch {
        /* silent — staff can still Regenerate */
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active?.id, client.id, assessment.id]);

  const displayUrl = freshUrl;
  const canShareUrl = !!freshUrl;

  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events) counts[e.event_type] = (counts[e.event_type] ?? 0) + 1;
    const lastViewed = events.find((e) => e.event_type === 'link_viewed');
    return { counts, lastViewed };
  }, [events]);

  const handleCreate = async (opts: { revoke_previous?: boolean } = {}) => {
    try {
      const res = await createMut.mutateAsync({
        client_id: client.id,
        assessment_id: assessment.id,
        revoke_previous: opts.revoke_previous,
      });
      setFreshUrl(res.url);
      setLegacyUnrecoverable(false);
      toast.success(
        opts.revoke_previous
          ? 'New link created — previous link revoked'
          : res.recovered
          ? 'Existing link recovered'
          : 'Report link created',
      );
    } catch (err) {
      // deno-lint-ignore no-explicit-any
      const e = err as any;
      if (e?.legacy) {
        setLegacyUnrecoverable(true);
        toast.error('This link was minted before secure recovery. Regenerate to heal it.');
        return;
      }
      toast.error(err instanceof Error ? err.message : 'Could not create link');
    }
  };

  const handleCopy = async () => {
    if (!displayUrl) return;
    try {
      await navigator.clipboard.writeText(displayUrl);
      toast.success('Link copied');
    } catch {
      toast.error('Copy failed — long-press the link to copy manually');
    }
  };

  const handleWhatsApp = () => {
    if (!displayUrl) return;
    const first =
      resolveClientFirstName(
        // deno-lint-ignore no-explicit-any
        (client as any).first_name ?? null,
        client.full_name ?? null,
      ) ?? 'there';
    const msg = buildShareMessage({
      first,
      reportUrl: displayUrl,
      promoCode,
      promoPct,
      referralLink,
    });
    openWhatsApp(client.phone, msg);
    toast.success('Opening WhatsApp…');
  };

  const handleEmail = async () => {
    if (!displayUrl) return;
    if (!client.email) {
      toast.error('Client has no email on file');
      return;
    }
    setSendingEmail(true);
    const t = toast.loading('Emailing secure report link…');
    try {
      const { error } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'client-report',
          recipientEmail: client.email,
          idempotencyKey: `report-link-${assessment.id}-${Date.now()}`,
          templateData: {
            clientName:
              resolveClientFirstName(
                // deno-lint-ignore no-explicit-any
                (client as any).first_name ?? null,
                client.full_name ?? null,
              ) ?? undefined,
            reportLabel: 'Personal report',
            practitionerName: practitionerName ?? undefined,
            reportPageUrl: displayUrl,
            // No automatic expiry — omit the field so templates that render
            // "expires in X days" simply drop the sentence.
          },
        },
      });
      if (error) throw error;
      toast.success('Email queued for delivery', { id: t });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Email failed', { id: t });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleRevoke = async () => {
    if (!active) return;
    try {
      await revokeMut.mutateAsync({
        link_id: active.id,
        client_id: client.id,
        assessment_id: assessment.id,
      });
      setFreshUrl(null);
      setLegacyUnrecoverable(false);
      toast.success('Link revoked');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Revoke failed');
    }
  };

  const origin = buildOrigin();

  // "Link created" is only truthful when a link exists. We intentionally do
  // NOT show a "Shared" status here because the system has no ground-truth
  // signal that WhatsApp / email actually reached the client — engagement
  // events below are the real evidence of client activity.
  const activityShared = events.some(
    (e) => e.event_type === 'link_viewed' || e.event_type === 'pdf_downloaded',
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" /> Share personal report
          </DialogTitle>
          <DialogDescription>
            Create a secure, per-client link to this assessment. The client sees
            their live report page — nothing else.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-6 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading links…
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active link status */}
            <div className="glass rounded-lg p-3 text-xs space-y-1">
              {active ? (
                <>
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Link created
                    {activityShared && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-emerald-500/90">
                        · viewed by client
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground">
                    Prefix <code className="font-mono">{active.token_prefix}…</code>
                    {' · '}
                    {active.expires_at
                      ? `expires ${new Date(active.expires_at).toLocaleDateString()}`
                      : 'persistent — expires only when revoked'}
                  </p>
                  {/* Persisted open counters — recorded server-side on every
                      report fetch, so they survive refreshes and devices. */}
                  <p className="text-muted-foreground">
                    Opened {Number(active.open_count ?? 0)}{' '}
                    {Number(active.open_count ?? 0) === 1 ? 'time' : 'times'}
                    {active.last_opened_at
                      ? ` · last ${new Date(active.last_opened_at).toLocaleString()}`
                      : ' · not opened yet'}
                  </p>
                  {legacyUnrecoverable && (
                    <p className="text-amber-600 dark:text-amber-400">
                      This link was minted before secure recovery was added.
                      The URL can no longer be recovered without the client's
                      copy. Use <b>Regenerate</b> to issue a new one — this
                      will revoke the previous link.
                    </p>
                  )}
                  {!freshUrl && !legacyUnrecoverable && (
                    <p className="text-muted-foreground/80 italic">
                      Recovering secure link…
                    </p>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  No active link yet.
                </p>
              )}
            </div>

            {/* URL row (only when freshly minted) */}
            {freshUrl && (
              <div className="space-y-2">
                <Input
                  readOnly
                  value={freshUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Preview host: <code className="font-mono">{origin}</code>
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              {!active ? (
                <Button
                  onClick={() => handleCreate()}
                  disabled={createMut.isPending}
                  className="glow-primary"
                >
                  {createMut.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Working…</>
                  ) : (
                    <><Link2 className="w-4 h-4 mr-1.5" /> Create link</>
                  )}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setConfirmRegenerate(true)}
                  disabled={createMut.isPending}
                  title="Issue a new link and revoke the current one"
                >
                  <Link2 className="w-4 h-4 mr-1.5" /> Regenerate link
                </Button>
              )}
              <Button variant="outline" onClick={handleCopy} disabled={!canShareUrl}>
                <Copy className="w-4 h-4 mr-1.5" /> Copy
              </Button>
              <Button
                variant="outline"
                onClick={handleWhatsApp}
                disabled={!canShareUrl}
                title={client.phone ? 'Open WhatsApp with the link pre-filled' : 'No phone on file — will still open WhatsApp'}
              >
                <MessageCircle className="w-4 h-4 mr-1.5" /> WhatsApp
              </Button>
              <Button
                variant="outline"
                onClick={handleEmail}
                disabled={!canShareUrl || sendingEmail}
                title={client.email ?? 'No email on file'}
              >
                {sendingEmail ? (
                  <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Emailing…</>
                ) : (
                  <><Mail className="w-4 h-4 mr-1.5" /> Email</>
                )}
              </Button>
              {active && (
                <Button
                  variant="ghost"
                  onClick={handleRevoke}
                  disabled={revokeMut.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <XCircle className="w-4 h-4 mr-1.5" /> Revoke
                </Button>
              )}
            </div>

            <AlertDialog open={confirmRegenerate} onOpenChange={setConfirmRegenerate}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Regenerate personal-report link?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The previous link will stop working immediately. Anyone
                    who already has the old link — including the client — will
                    no longer be able to open the report until you share the
                    new URL.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep existing link</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      setConfirmRegenerate(false);
                      void handleCreate({ revoke_previous: true });
                    }}
                  >
                    Regenerate and revoke old link
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Engagement summary */}
            <div className="glass rounded-lg p-3 text-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-foreground">Engagement</p>
                {events.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowActivity((v) => !v)}
                    className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    {showActivity ? <>Hide activity <ChevronUp className="w-3 h-3" /></> : <>Show recent activity <ChevronDown className="w-3 h-3" /></>}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-3 text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" /> Views {summary.counts.link_viewed ?? 0}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MousePointerClick className="w-3.5 h-3.5" /> Book clicks {summary.counts.book_clicked ?? 0}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MousePointerClick className="w-3.5 h-3.5" /> Product interest {summary.counts.product_interest ?? 0}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5" /> Questions {summary.counts.question_clicked ?? 0}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" /> PDF {summary.counts.pdf_downloaded ?? 0}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarCheck className="w-3.5 h-3.5" /> Bookings {summary.counts.appointment_booked ?? 0}
                </span>
              </div>
              {summary.lastViewed && (
                <p className="text-muted-foreground/80">
                  Last viewed {new Date(summary.lastViewed.created_at).toLocaleString()}
                </p>
              )}
              {showActivity && events.length > 0 && (
                <ul className="mt-2 space-y-1.5 max-h-56 overflow-auto pr-1 border-t border-border/40 pt-2">
                  {events.slice(0, 40).map((e) => (
                    <li key={e.id} className="flex items-start gap-2 text-[11.5px] text-muted-foreground">
                      <span className="mt-0.5 text-foreground/80"><EventIcon type={e.event_type} /></span>
                      <span className="flex-1 min-w-0">
                        <span className="text-foreground/90">{EVENT_LABEL[e.event_type] ?? e.event_type}</span>
                        {typeof e.payload === 'object' && e.payload && 'name' in e.payload && (
                          <> · <span className="italic">{String((e.payload as Record<string, unknown>).name)}</span></>
                        )}
                        {typeof e.payload === 'object' && e.payload && 'service_name' in e.payload && (
                          <> · <span className="italic">{String((e.payload as Record<string, unknown>).service_name)}</span></>
                        )}
                        <span className="text-muted-foreground/70"> — {new Date(e.created_at).toLocaleString()}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ShareReportDialog;