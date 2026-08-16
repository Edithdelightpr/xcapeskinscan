import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Eye, ImageIcon, Share2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useRealClient, type RealClient } from '@/hooks/useRealClients';
import { useArchiveXcapeClient } from '@/hooks/useArchiveXcapeClient';
import { useClientAssessments, type VisitAssessment } from '@/hooks/useVisitAssessments';
import { useClientMedia, type ClientMedia } from '@/hooks/useClientMedia';
import { scoresFromSkin } from '@/components/xcape/protocol/StaffProtocolPanel';
import ShareReportPanel from '@/components/report/ShareReportPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatNaira } from '@/lib/finance';
import { pickPreferredImage } from '@/lib/xcapeMedia';


/**
 * XCAPE Skin Journey — the product-facing client history for Affiliate / CDP
 * accounts. It reuses the SAME RLS-scoped queries the operational console
 * uses (clients, client_visit_assessments, client_media, report links,
 * orders); only the presentation is XCAPE product language.
 *
 * Nothing here writes: historical image sets and assessments are read-only,
 * so a baseline can never be overwritten by viewing progress.
 */

const TABS = ['Overview', 'Progress', 'Analyses', 'Reports', 'Purchases'] as const;
type Tab = (typeof TABS)[number];

const SCORE_LABELS: Record<string, string> = {
  pigmentation_stability: 'Pigmentation stability',
  barrier_surface_hydration: 'Barrier & hydration',
  firmness_skin_support: 'Firmness & support',
  oil_congestion_balance: 'Oil & congestion balance',
};

const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

/** Signed URLs for a set of stored media paths (consented storage only). */
const useSignedMedia = (media: ClientMedia[]) => {
  const paths = useMemo(
    () =>
      media
        .filter((m) => (m.file_type ?? 'image') === 'image')
        .map((m) => m.storage_path ?? m.bucket_path)
        .filter(Boolean) as string[],
    [media],
  );
  return useQuery({
    queryKey: ['xcape-journey-signed', paths.join(',')],
    enabled: paths.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data } = await supabase.storage.from('client-media').createSignedUrls(paths, 900);
      const out: Record<string, string> = {};
      for (const s of data ?? []) if (s.path && s.signedUrl) out[s.path] = s.signedUrl;
      return out;
    },
  });
};

const scoreEntries = (a: VisitAssessment | undefined) =>
  a ? Object.entries(scoresFromSkin((a.skin_analysis ?? {}) as never)) : [];

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-border bg-card p-5 ${className}`}>{children}</div>
);

/**
 * "Remove client" — a safe archive, not a regulatory erase. Copy states
 * exactly what happens: the client leaves your lists, shared report links stop
 * working and stored photos are cleared, while analysis and order history is
 * kept for records. Requires typing REMOVE to confirm.
 */
const RemoveClientAction = ({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string | null;
}) => {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const archive = useArchiveXcapeClient();
  const ready = confirm.trim().toUpperCase() === 'REMOVE';

  const submit = async () => {
    if (!ready || archive.isPending) return;
    setError(null);
    try {
      const result = await archive.mutateAsync(clientId);
      setOpen(false);
      if (result.cleanup_pending) {
        // Links are dead and the client is hidden, but the photo purge did not
        // finish — never report that as a success.
        toast.warning(`${clientName ?? 'Client'} removed — photo cleanup unfinished`, {
          description:
            'Shared report links no longer work. Some stored photos were not cleared yet — run Remove client again to finish the cleanup.',
        });
      } else {
        toast.success(`${clientName ?? 'Client'} removed`, {
          description: 'Shared report links no longer work and stored photos were cleared.',
        });
      }
      navigate('/xcape/clients', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We could not remove this client.');
    }
  };


  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full text-destructive hover:text-destructive"
        onClick={() => {
          setConfirm('');
          setError(null);
          setOpen(true);
        }}
      >
        <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden /> Remove client
      </Button>

      {/* While the archive is in flight the dialog cannot be dismissed — no
          escape, overlay click, close button, Keep, or typing. */}
      <Dialog open={open} onOpenChange={(next) => { if (!archive.isPending) setOpen(next); }}>
        <DialogContent
          className={`sm:max-w-md ${archive.isPending ? '[&>button.absolute]:pointer-events-none [&>button.absolute]:opacity-40' : ''}`}

          onEscapeKeyDown={(e) => { if (archive.isPending) e.preventDefault(); }}
          onPointerDownOutside={(e) => { if (archive.isPending) e.preventDefault(); }}
          onInteractOutside={(e) => { if (archive.isPending) e.preventDefault(); }}
        >
          <DialogHeader>
            <DialogTitle>Remove {clientName ?? 'this client'}?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-left text-sm">
                <p>This removes a bad or duplicate capture from your XCAPE clients. It will:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>hide the client from your clients list and search</li>
                  <li>stop every shared report link for them from working</li>
                  <li>clear their stored skin photos</li>
                </ul>
                <p>
                  Analysis records, orders and history are kept for your records. This is not a
                  full personal-data erasure request.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Type REMOVE to confirm</span>
            <Input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="REMOVE"
              aria-label="Type REMOVE to confirm"
              autoComplete="off"
              disabled={archive.isPending}
            />
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={archive.isPending}
              onClick={() => setOpen(false)}
            >
              Keep client
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-full"
              disabled={!ready || archive.isPending}
              onClick={submit}
            >
              {archive.isPending ? 'Removing…' : 'Remove client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

/** Shown when the client was removed, or never visible to this account. */
const ClientUnavailable = () => (
  <div className="space-y-4 py-12 text-center">
    <h1 className="text-2xl font-semibold tracking-tight">Client no longer available</h1>
    <p className="mx-auto max-w-md text-sm text-muted-foreground">
      This client has been removed from your XCAPE clients. Their shared report links no longer
      work and their photos have been cleared.
    </p>
    <Button asChild variant="outline" className="rounded-full">
      <Link to="/xcape/clients">Back to clients</Link>
    </Button>
  </div>
);

/**
 * Gate: no assessment, media, report-link or purchase query is started until
 * the client query has resolved to a live (non-archived) client. A removed
 * client therefore never triggers reads of their remaining records.
 */
const XcapeSkinJourney = ({ clientId }: { clientId: string }) => {
  const { data: client, isLoading } = useRealClient(clientId);
  if (isLoading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Loading skin journey…</p>;
  }
  if (!client) return <ClientUnavailable />;
  return <JourneyBody clientId={clientId} client={client} />;
};

const JourneyBody = ({ clientId, client }: { clientId: string; client: RealClient }) => {
  const [tab, setTab] = useState<Tab>('Overview');

  const { data: assessments = [] } = useClientAssessments(clientId);
  const { data: media = [] } = useClientMedia(clientId);
  const { data: signed = {} } = useSignedMedia(media);
  const [shareFor, setShareFor] = useState<string | null>(null);

  const imageFor = (m: ClientMedia | undefined) => {
    const p = m?.storage_path ?? m?.bucket_path;
    return p ? signed[p] : undefined;
  };
  const mediaByAssessment = useMemo(() => {
    const map = new Map<string, ClientMedia[]>();
    for (const m of media) {
      if ((m.file_type ?? 'image') !== 'image') continue;
      const key = m.assessment_id ?? 'unlinked';
      map.set(key, [...(map.get(key) ?? []), m]);
    }
    return map;
  }, [media]);
  /** Front view where available; strictly scoped to the analysis it belongs to. */
  const imageForAssessment = (assessmentId: string | null | undefined) =>
    imageFor(pickPreferredImage(mediaByAssessment.get(assessmentId ?? '') ?? []));

  const latest = assessments[0];
  const latestImage = imageForAssessment(latest?.id);


  const { data: reports = [] } = useQuery({
    queryKey: ['xcape-journey-reports', clientId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('client_report_links')
        .select('id, assessment_id, created_at, revoked_at, expires_at, open_count, last_opened_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        assessment_id: string;
        created_at: string;
        revoked_at: string | null;
        expires_at: string | null;
        open_count: number | null;
        last_opened_at: string | null;
      }>;
    },
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ['xcape-journey-purchases', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pending_outreach_orders')
        .select('id, quantity, unit_price, status, created_at, products(name)')
        .eq('customer_client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []) as any[];
    },
  });

  // Progress comparison — two distinct assessments, never merged image sets.
  const [fromId, setFromId] = useState<string>('');
  const [toId, setToId] = useState<string>('');
  const from = assessments.find((a) => a.id === fromId) ?? assessments[assessments.length - 1];
  const to = assessments.find((a) => a.id === toId) ?? assessments[0];




  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/xcape/clients"
            className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Clients
          </Link>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{client?.full_name ?? 'Skin Journey'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {assessments.length} analys{assessments.length === 1 ? 'is' : 'es'} · last {fmtDate(latest?.created_at)}
          </p>
        </div>
        <RemoveClientAction clientId={clientId} clientName={client?.full_name ?? null} />
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-full border border-border p-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-current={tab === t}
            className={`min-h-[40px] whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors ${
              tab === t ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-0 overflow-hidden">
            <div className="flex aspect-[4/3] items-center justify-center bg-muted">
              {latestImage ? (
                <img
                  src={latestImage}
                  alt={`Most recent captured skin image for ${client?.full_name ?? 'this client'}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground" aria-hidden />
              )}
            </div>
          </Card>
          <Card className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Last analysis</p>
              <p className="text-lg font-semibold">{fmtDate(latest?.created_at)}</p>
            </div>
            <div className="space-y-2">
              {scoreEntries(latest).length === 0 ? (
                <p className="text-sm text-muted-foreground">No scores recorded yet.</p>
              ) : (
                scoreEntries(latest).map(([k, v]) => (
                  <div key={k}>
                    <div className="flex items-center justify-between text-sm">
                      <span>{SCORE_LABELS[k] ?? k}</span>
                      <span className="font-semibold tabular-nums">{v}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted">
                      <div className="h-1.5 rounded-full bg-foreground" style={{ width: `${v}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
            {latest?.main_concern && (
              <p className="text-sm text-muted-foreground">
                Protocol focus: <span className="text-foreground">{latest.main_concern}</span>
              </p>
            )}
          </Card>
        </div>
      )}

      {tab === 'Progress' && (
        <div className="space-y-4">
          {assessments.length < 2 ? (
            <Card>
              <p className="text-sm text-muted-foreground">
                Two analyses are needed to compare progress. Run another analysis to unlock before &amp; after.
              </p>
            </Card>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Before</span>
                  <select
                    aria-label="Before analysis"
                    value={from?.id ?? ''}
                    onChange={(e) => setFromId(e.target.value)}
                    className="h-11 w-full rounded-xl border border-border bg-background px-3"
                  >
                    {assessments.map((a) => (
                      <option key={a.id} value={a.id}>{fmtDate(a.created_at)}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">After</span>
                  <select
                    aria-label="After analysis"
                    value={to?.id ?? ''}
                    onChange={(e) => setToId(e.target.value)}
                    className="h-11 w-full rounded-xl border border-border bg-background px-3"
                  >
                    {assessments.map((a) => (
                      <option key={a.id} value={a.id}>{fmtDate(a.created_at)}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {[from, to].map((a, i) => {
                  const img = imageFor(mediaByAssessment.get(a?.id ?? '')?.[0]);
                  return (
                    <Card key={`${a?.id}-${i}`} className="space-y-3 p-0 overflow-hidden">
                      <div className="flex aspect-[4/3] items-center justify-center bg-muted">
                        {img ? (
                          <img
                            src={img}
                            alt={`${i === 0 ? 'Before' : 'After'} image from ${fmtDate(a?.created_at)}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-muted-foreground" aria-hidden />
                        )}
                      </div>
                      <div className="p-4 pt-0">
                        <p className="text-sm font-medium">{i === 0 ? 'Before' : 'After'} · {fmtDate(a?.created_at)}</p>
                      </div>
                    </Card>
                  );
                })}
              </div>
              <Card className="space-y-2">
                {Object.keys(SCORE_LABELS).map((k) => {
                  const b = Object.fromEntries(scoreEntries(from))[k];
                  const t = Object.fromEntries(scoreEntries(to))[k];
                  if (typeof b !== 'number' || typeof t !== 'number') return null;
                  const delta = t - b;
                  return (
                    <div key={k} className="flex items-center justify-between text-sm">
                      <span>{SCORE_LABELS[k]}</span>
                      <span className="tabular-nums">
                        {b} → {t}{' '}
                        <span className={delta >= 0 ? 'text-emerald-600' : 'text-destructive'}>
                          ({delta >= 0 ? '+' : ''}{delta})
                        </span>
                      </span>
                    </div>
                  );
                })}
              </Card>
            </>
          )}
        </div>
      )}

      {tab === 'Analyses' && (
        <ul className="space-y-3">
          {assessments.length === 0 && (
            <Card><p className="text-sm text-muted-foreground">No analyses recorded yet.</p></Card>
          )}
          {assessments.map((a) => (
            <li key={a.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{fmtDate(a.created_at)}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {a.main_concern ?? 'Skin analysis'}
                    {scoreEntries(a).length ? ` · ${scoreEntries(a).length} scores` : ''}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="rounded-full">
                  <Link to={`/xcape/clients/${clientId}/report-preview?assessment=${a.id}`}>
                    <Eye className="mr-1 h-3.5 w-3.5" /> View report
                  </Link>
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {tab === 'Reports' && (
        <ul className="space-y-3">
          {reports.length === 0 && (
            <Card><p className="text-sm text-muted-foreground">No reports shared yet.</p></Card>
          )}
          {reports.map((r) => (
            <li key={r.id}>
              <Card className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{fmtDate(r.created_at)}</p>
                    <p className="text-sm text-muted-foreground">
                      {r.revoked_at ? 'Revoked' : 'Active'} · opened {r.open_count ?? 0}×
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setShareFor((id) => (id === r.id ? null : r.id))}
                  >
                    <Share2 className="mr-1 h-3.5 w-3.5" /> {shareFor === r.id ? 'Close' : 'Share'}
                  </Button>
                </div>
                {shareFor === r.id && (
                  <ShareReportPanel
                    clientId={clientId}
                    assessmentId={r.assessment_id}
                    clientName={client?.full_name ?? null}
                    compact
                  />
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {tab === 'Purchases' && (
        <ul className="space-y-3">
          {purchases.length === 0 && (
            <Card><p className="text-sm text-muted-foreground">No purchases recorded yet.</p></Card>
          )}
          {purchases.map((p) => (
            <li key={p.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{p.products?.name ?? 'XCAPE order'}</p>
                  <p className="text-sm text-muted-foreground">
                    {fmtDate(p.created_at)} · {p.status} · ×{p.quantity ?? 1}
                  </p>
                </div>
                <p className="font-semibold tabular-nums">
                  {formatNaira(Number(p.unit_price ?? 0) * Number(p.quantity ?? 1))}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default XcapeSkinJourney;
