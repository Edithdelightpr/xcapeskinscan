import { useEffect, useState } from 'react';
import {
  Copy, Link2, Link2Off, Loader2, RefreshCw, Share2, ShieldCheck, Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useAssessmentReportLinks,
  useCreateReportLink,
  useRecoverReportLinkUrl,
  useRevokeReportLink,
  activeLinkOf,
  type ReportLink,
} from '@/hooks/useReportLinks';

const fmtDate = (d: string | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

const fmtDateTime = (d: string | null | undefined) =>
  d
    ? new Date(d).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : null;

export type ShareLinkStatus = 'none' | 'active' | 'expired' | 'revoked';

/** Pure status resolution — the newest link decides what the operator sees. */
export const resolveShareStatus = (
  links: Pick<ReportLink, 'revoked_at' | 'expires_at'>[] | undefined,
  now: number = Date.now(),
): ShareLinkStatus => {
  if (!links || links.length === 0) return 'none';
  const live = links.find(
    (l) => !l.revoked_at && (l.expires_at === null || new Date(l.expires_at).getTime() > now),
  );
  if (live) return 'active';
  const newest = links[0];
  if (newest.revoked_at) return 'revoked';
  return 'expired';
};

const STATUS_STYLE: Record<ShareLinkStatus, string> = {
  none: 'bg-surface text-muted-foreground',
  active: 'bg-emerald-500/15 text-emerald-600',
  expired: 'bg-amber-500/15 text-amber-600',
  revoked: 'bg-destructive/15 text-destructive',
};

const STATUS_LABEL: Record<ShareLinkStatus, string> = {
  none: 'Not shared yet',
  active: 'Active',
  expired: 'Expired',
  revoked: 'Revoked',
};

interface Props {
  clientId: string;
  assessmentId: string;
  clientName?: string | null;
  /** Compact mode drops the heading — used inside table rows. */
  compact?: boolean;
}

/**
 * The single Share Report surface used everywhere an authenticated operator
 * manages a finalised report.
 *
 * Regenerating mints a NEW opaque token against the SAME client and the SAME
 * saved assessment, so the immutable formula snapshot behind the report is
 * untouched — the report is never recomputed and the previous share record is
 * kept for history. No database ids or token hashes are ever displayed.
 */
const ShareReportPanel = ({ clientId, assessmentId, clientName, compact }: Props) => {
  const { data: links = [], isLoading } = useAssessmentReportLinks(assessmentId);
  const active = activeLinkOf(links);
  const status = resolveShareStatus(links);

  const createMut = useCreateReportLink();
  const revokeMut = useRevokeReportLink();
  const recoverMut = useRecoverReportLinkUrl();

  const [url, setUrl] = useState<string | null>(null);
  const [legacy, setLegacy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  // Recover the shareable URL for the current active link (HMAC re-derivation)
  // so an operator returning later never has to remember it.
  useEffect(() => {
    setUrl(null);
    setLegacy(false);
    if (!active) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await recoverMut.mutateAsync({
          client_id: clientId,
          assessment_id: assessmentId,
          link_id: active.id,
        });
        if (cancelled) return;
        if (res && res.ok) setUrl(res.url);
        else if (res && res.ok === false) setLegacy(true);
      } catch {
        /* operator can still regenerate */
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, clientId, assessmentId]);

  const mint = async (regenerate: boolean) => {
    try {
      const res = await createMut.mutateAsync({
        client_id: clientId,
        assessment_id: assessmentId,
        revoke_previous: regenerate,
      });
      setUrl(res.url);
      setLegacy(false);
      toast.success(
        regenerate
          ? 'New secure link created — the previous link no longer works'
          : res.recovered
            ? 'Existing secure link recovered'
            : 'Secure report link created',
      );
    } catch (err) {
      const e = err as Error & { legacy?: boolean };
      if (e?.legacy) {
        setLegacy(true);
        toast.error('This link predates secure recovery. Use Regenerate to issue a fresh one.');
        return;
      }
      toast.error(e instanceof Error ? e.message : 'Could not create the link');
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Copy failed — long-press the link to copy it manually');
    }
  };

  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const nativeShare = async () => {
    if (!url) return;
    try {
      await navigator.share({
        title: 'Your XCAPE skin report',
        text: clientName ? `${clientName}, here is your XCAPE skin report.` : 'Your XCAPE skin report',
        url,
      });
    } catch {
      /* dismissed */
    }
  };

  const revoke = async () => {
    if (!active) return;
    try {
      await revokeMut.mutateAsync({
        link_id: active.id,
        client_id: clientId,
        assessment_id: assessmentId,
      });
      setUrl(null);
      setConfirmRevoke(false);
      toast.success('Link revoked — it can no longer be opened');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not revoke the link');
    }
  };

  const busy = createMut.isPending || revokeMut.isPending;
  const opens = Number(active?.open_count ?? 0);

  return (
    <section
      className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-3"
      data-testid="share-report-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!compact && (
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" /> Share report
          </h3>
        )}
        <Badge className={`text-[10px] border-0 ${STATUS_STYLE[status]}`}>
          {STATUS_LABEL[status]}
        </Badge>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Checking share status…</p>
      ) : status === 'none' ? (
        <>
          <p className="text-xs text-muted-foreground">
            No link has been issued for this report yet. Generating one creates a private,
            unguessable web address for this client only.
          </p>
          <Button
            onClick={() => mint(false)}
            disabled={busy}
            className="bg-primary text-primary-foreground min-h-11 w-full sm:w-auto"
          >
            {createMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
            Generate secure link
          </Button>
        </>
      ) : (
        <>
          {url ? (
            <p className="text-[11px] text-muted-foreground break-all rounded-lg bg-surface/70 px-3 py-2">
              {url}
            </p>
          ) : legacy ? (
            <p className="text-[11px] text-amber-600">
              This link was issued before secure recovery was added, so it cannot be shown again.
              Regenerate to issue a fresh one.
            </p>
          ) : status === 'active' ? (
            <p className="text-[11px] text-muted-foreground">Recovering the link…</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {status === 'revoked'
                ? 'The last link was revoked. The report itself is untouched — regenerate to share it again.'
                : 'The last link expired. Regenerate to share this same report again.'}
            </p>
          )}

          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div>
              <dt className="text-muted-foreground">Expires</dt>
              <dd className="text-foreground">{fmtDate(active?.expires_at) ?? 'No expiry'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Opens</dt>
              <dd className="text-foreground tabular-nums">{opens}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">First opened</dt>
              <dd className="text-foreground">{fmtDateTime(active?.first_opened_at) ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last opened</dt>
              <dd className="text-foreground">{fmtDateTime(active?.last_opened_at) ?? '—'}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            {url && (
              <Button variant="outline" onClick={copy} className="min-h-11 text-xs">
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy link
              </Button>
            )}
            {url && canNativeShare && (
              <Button variant="outline" onClick={nativeShare} className="min-h-11 text-xs">
                <Share2 className="w-3.5 h-3.5 mr-1.5" /> Share
              </Button>
            )}
            {url && (
              <Button variant="outline" asChild className="min-h-11 text-xs">
                <a href={url} target="_blank" rel="noreferrer">
                  <Eye className="w-3.5 h-3.5 mr-1.5" /> Open
                </a>
              </Button>
            )}
            <Button variant="outline" onClick={() => mint(true)} disabled={busy} className="min-h-11 text-xs">
              {createMut.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
              Regenerate link
            </Button>
            {status === 'active' && (
              confirmRevoke ? (
                <>
                  <Button
                    variant="destructive"
                    onClick={revoke}
                    disabled={busy}
                    className="min-h-11 text-xs"
                  >
                    Confirm revoke
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmRevoke(false)} className="min-h-11 text-xs">
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => setConfirmRevoke(true)}
                  disabled={busy}
                  className="min-h-11 text-xs text-destructive hover:text-destructive"
                >
                  <Link2Off className="w-3.5 h-3.5 mr-1.5" /> Revoke
                </Button>
              )
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Regenerating keeps this exact saved analysis and its approved formula — only the web
            address changes.
          </p>
        </>
      )}
    </section>
  );
};

export default ShareReportPanel;
