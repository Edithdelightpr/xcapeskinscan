import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Loader2,
  Archive,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { Share2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  useClientMedia,
  useUploadClientMedia,
  useArchiveClientMedia,
  useSignedMediaUrl,
  type ClientMedia,
} from '@/hooks/useClientMedia';
import { generateAndUploadClientReport } from '@/lib/clientReportPdf';
import type { RealClient } from '@/hooks/useRealClients';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  useClientDeliveries,
  useSendDocumentDelivery,
  type DocumentDelivery,
} from '@/hooks/useDocumentDeliveries';
import { useClientAssessments } from '@/hooks/useVisitAssessments';
import { useClientReportLinks, activeLinkOf } from '@/hooks/useReportLinks';
import ShareReportDialog from '@/components/admin/ShareReportDialog';
import ReportPreviewFrame from '@/components/admin/ReportPreviewFrame';
import { resolveClientFirstName } from '@/lib/clientName';

export const ClientReportsTab = ({
  client,
  isAdmin,
}: {
  client: RealClient;
  isAdmin: boolean;
}) => {
  const { data: allMedia = [], isLoading } = useClientMedia(client.id);
  const uploadMut = useUploadClientMedia();
  const archiveMut = useArchiveClientMedia();
  const { data: deliveries = [] } = useClientDeliveries(client.id);
  const sendMut = useSendDocumentDelivery();
  const [generating, setGenerating] = useState(false);

  // --- Personal Report control centre (top of tab) --------------------------
  const { data: assessments = [] } = useClientAssessments(client.id);
  const latestReadyAssessment = useMemo(() => {
    const ready = assessments.filter((a) => a.report_ready === true);
    if (ready.length === 0) return null;
    return ready.slice().sort((a, b) => {
      // deno-lint-ignore no-explicit-any
      const aTs = ((a as any).report_ready_at ?? a.updated_at ?? a.created_at) as string;
      // deno-lint-ignore no-explicit-any
      const bTs = ((b as any).report_ready_at ?? b.updated_at ?? b.created_at) as string;
      const cmp = new Date(bTs).getTime() - new Date(aTs).getTime();
      if (cmp !== 0) return cmp;
      return a.id < b.id ? 1 : -1;
    })[0] ?? null;
  }, [assessments]);

  const { data: reportLinks = [] } = useClientReportLinks(client.id);
  const activeReportLink = useMemo(() => {
    if (!latestReadyAssessment) return null;
    const scoped = reportLinks.filter((l) => l.assessment_id === latestReadyAssessment.id);
    return activeLinkOf(scoped);
  }, [reportLinks, latestReadyAssessment]);

  const [shareOpen, setShareOpen] = useState(false);
  const clientDisplayName =
    resolveClientFirstName(
      // deno-lint-ignore no-explicit-any
      (client as any).first_name ?? null,
      client.full_name ?? null,
    ) ?? 'this client';

  // --- End personal report control centre -----------------------------------

  // Readiness signals: latest paid completed visit + intake + assigned staff.
  const { data: readiness } = useQuery({
    queryKey: ['client-report-readiness', client.id],
    queryFn: async () => {
      const [visitsRes, financeRes, intakeRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from('client_visit_logs')
          .select('id, treatment_completed_at, assigned_medical_expert_id')
          .eq('client_id', client.id)
          .not('treatment_completed_at', 'is', null),
        supabase
          .from('finance_entries')
          .select('visit_id')
          .eq('source_client_id', client.id)
          .eq('kind', 'revenue')
          .eq('status', 'active')
          .eq('payment_status', 'paid'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from('client_safety_intakes')
          .select('collected_at, treatment_consent')
          .eq('client_id', client.id)
          .order('collected_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return {
        completedVisits: (visitsRes.data ?? []) as Array<{ id: string; assigned_medical_expert_id: string | null }>,
        paidVisitIds: new Set(((financeRes.data ?? []) as Array<{ visit_id: string | null }>).map((r) => r.visit_id).filter(Boolean) as string[]),
        intake: intakeRes.data as { collected_at: string; treatment_consent: boolean | null } | null,
      };
    },
  });

  const missing: string[] = [];
  if (!client.full_name) missing.push('Client name');
  if (!client.phone) missing.push('Phone number');
  if (!readiness?.intake) missing.push('Intake / consultation info');
  else if (readiness.intake.treatment_consent === false) missing.push('Treatment consent');
  const paidCompletedVisit = readiness?.completedVisits.find((v) => readiness.paidVisitIds.has(v.id)) ?? null;
  if (!paidCompletedVisit) missing.push('Completed paid treatment');
  if (paidCompletedVisit && !paidCompletedVisit.assigned_medical_expert_id) missing.push('Assigned practitioner');
  const reportReady = missing.length === 0;

  // Latest delivery per media id (deliveries already arrive newest-first)
  const latestDeliveryByMedia = new Map<string, DocumentDelivery>();
  for (const d of deliveries) {
    if (!latestDeliveryByMedia.has(d.media_id)) latestDeliveryByMedia.set(d.media_id, d);
  }

  const reports = allMedia.filter(
    (m) => (m.category ?? m.kind) === 'report' && (m.file_type ?? '') !== 'video',
  );

  const photos = allMedia.filter((m) => {
    const cat = m.category ?? m.kind;
    return cat === 'before' || cat === 'after' || cat === 'treatment';
  });

  const canGenerate = isAdmin && reportReady;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    const t = toast.loading('Generating report…');
    try {
      await generateAndUploadClientReport({
        client,
        tier:
          client.membership_type === 'member'
            ? 'member'
            : client.membership_type === 'elite'
              ? 'elite'
              : client.membership_type === 'one_time'
                ? 'regular'
                : undefined,
        uploadFn: uploadMut.mutateAsync,
        photos,
      });
      toast.success('Report saved to profile', { id: t });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Report failed', { id: t });
    } finally {
      setGenerating(false);
    }
  };

  const handleArchive = async (m: ClientMedia) => {
    try {
      await archiveMut.mutateAsync(m);
      toast.success('Archived');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Archive failed');
    }
  };

  const handleSendWhatsApp = async (m: ClientMedia) => {
    const t = toast.loading('Sending via WhatsApp…');
    try {
      const res = await sendMut.mutateAsync({
        clientId: client.id,
        mediaId: m.id,
        phoneNumber: client.phone,
      });
      if (res.status === 'failed') {
        toast.error(res.error_message ?? 'Send failed', { id: t });
      } else if (res.status === 'simulated') {
        toast.success('Simulated WhatsApp send recorded', { id: t });
      } else {
        toast.success('Queued for WhatsApp delivery', { id: t });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Send failed', { id: t });
    }
  };

  return (
    <div className="space-y-6">
      {/* --- A. Personal Report Status ---------------------------------- */}
      <section className="glass rounded-xl p-6 space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-display font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Personal report
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Live, personalised skin report for {clientDisplayName}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {latestReadyAssessment ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px] uppercase tracking-wider">
                <CheckCircle2 className="w-3 h-3" /> Ready to share
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[11px] uppercase tracking-wider">
                <AlertCircle className="w-3 h-3" /> Awaiting completed assessment
              </span>
            )}
          </div>
        </div>

        {latestReadyAssessment ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3 text-xs">
              <div className="rounded-lg bg-background/40 border border-border/40 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Latest assessment</p>
                <p className="mt-1 text-foreground font-medium">
                  {new Date(latestReadyAssessment.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="rounded-lg bg-background/40 border border-border/40 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Link</p>
                <p className="mt-1 text-foreground font-medium">
                  {activeReportLink ? 'Created' : 'Not created yet'}
                </p>
                {activeReportLink && (
                  <p className="text-[11px] text-muted-foreground">
                    {activeReportLink.expires_at
                      ? `Expires ${new Date(activeReportLink.expires_at).toLocaleDateString()}`
                      : 'Persistent — expires only when revoked or regenerated'}
                  </p>
                )}
              </div>
              <div className="rounded-lg bg-background/40 border border-border/40 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Prefix</p>
                <p className="mt-1 text-foreground font-mono text-xs">
                  {activeReportLink ? `${activeReportLink.token_prefix}…` : '—'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={() => setShareOpen(true)} className="glow-primary">
                <Share2 className="w-4 h-4 mr-1.5" />
                {activeReportLink ? 'Manage sharing' : 'Create secure link'}
              </Button>
              <Button asChild variant="outline">
                <Link
                  to={`/admin/clients/${client.id}/report-preview?assessment=${latestReadyAssessment.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Eye className="w-4 h-4 mr-1.5" /> Open full preview
                </Link>
              </Button>
            </div>

            {/* --- B. Live Client-View Preview (embedded iframe) ------------ */}
            <ReportPreviewFrame
              clientId={client.id}
              assessmentId={latestReadyAssessment.id}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            When an assessment is marked <b>Report ready</b> in the Assessments tab,
            the client's live personal report will appear here for preview and sharing.
          </p>
        )}
      </section>

      {shareOpen && latestReadyAssessment && (
        <ShareReportDialog
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          client={client}
          assessment={latestReadyAssessment}
        />
      )}

      {/* --- D. Existing PDF artefacts (unchanged) --------------------- */}
      <div className="glass rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-foreground">Treatment & membership PDFs</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Generated treatment & membership PDFs for this client.
          </p>
          <p className="mt-2 text-xs">
            {reportReady ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">
                <CheckCircle2 className="w-3 h-3" /> Report Ready
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">
                <AlertCircle className="w-3 h-3" /> Report Not Ready
              </span>
            )}
          </p>
        </div>
        {canGenerate && (
          <Button onClick={handleGenerate} disabled={generating} className="glow-primary">
            {generating ? (
              <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Generating…</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-1.5" /> Generate Report</>
            )}
          </Button>
        )}
      </div>

      {!reportReady && missing.length > 0 && (
        <div className="glass rounded-xl p-4 text-sm">
          <p className="font-semibold text-foreground mb-2">Missing for report generation:</p>
          <ul className="text-muted-foreground space-y-1">
            {missing.map((m) => (
              <li key={m} className="flex items-center gap-2"><AlertCircle className="w-3 h-3 text-amber-400" /> {m}</li>
            ))}
          </ul>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading reports…</p>
      ) : reports.length === 0 ? (
        <div className="glass rounded-xl p-10 text-center space-y-2">
          <FileText className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">No report generated yet.</p>
          {canGenerate && (
            <p className="text-xs text-muted-foreground/70 italic">
              Click "Generate Report" to create the first one.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((m) => (
            <ReportRow
              key={m.id}
              media={m}
              isAdmin={isAdmin}
              clientPhone={client.phone}
              delivery={latestDeliveryByMedia.get(m.id)}
              sending={sendMut.isPending}
              onSend={() => handleSendWhatsApp(m)}
              onArchive={() => handleArchive(m)}
            />
          ))}
        </div>
      )}

      {isAdmin && reports.length > 0 && canGenerate && (
        <div className="flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3 h-3" /> Regenerate latest
          </button>
        </div>
      )}
    </div>
  );
};

const ReportRow = ({
  media,
  isAdmin,
  clientPhone,
  delivery,
  sending,
  onSend,
  onArchive,
}: {
  media: ClientMedia;
  isAdmin: boolean;
  clientPhone: string | null;
  delivery?: DocumentDelivery;
  sending: boolean;
  onSend: () => void;
  onArchive: () => void;
}) => {
  const { data: url } = useSignedMediaUrl(media.storage_path ?? media.bucket_path);
  const canSend = isAdmin && !!clientPhone;

  return (
    <div className="glass rounded-lg p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
        <FileText className="w-5 h-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">
          {media.file_name ?? 'Treatment report'}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {media.caption ?? '—'} · {new Date(media.upload_date ?? media.created_at).toLocaleString()}
        </p>
        <DeliveryBadge delivery={delivery} clientPhone={clientPhone} />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {url ? (
          <Button asChild variant="outline" size="sm">
            <a href={url} target="_blank" rel="noreferrer">
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open PDF
            </a>
          </Button>
        ) : (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        )}
        {isAdmin && (
          <Button
            onClick={onSend}
            disabled={sending || !canSend}
            size="sm"
            variant="outline"
            title={canSend ? 'Send via WhatsApp' : 'Client has no phone number on file'}
          >
            <Send className="w-3.5 h-3.5 mr-1.5" /> WhatsApp
          </Button>
        )}
        {isAdmin && (
          <button
            onClick={onArchive}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Archive report"
            title="Archive"
          >
            <Archive className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

const DeliveryBadge = ({
  delivery,
  clientPhone,
}: {
  delivery?: DocumentDelivery;
  clientPhone: string | null;
}) => {
  if (!delivery) {
    if (!clientPhone) {
      return (
        <p className="text-[11px] text-muted-foreground/80 mt-1 inline-flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> No phone on file — cannot send
        </p>
      );
    }
    return (
      <p className="text-[11px] text-muted-foreground/70 mt-1 italic">Not yet sent</p>
    );
  }
  const ts = new Date(delivery.sent_at ?? delivery.created_at).toLocaleString();
  const channelLabel =
    delivery.channel === 'whatsapp_business'
      ? 'WhatsApp Business'
      : delivery.channel === 'whatsapp_simulated'
        ? 'WhatsApp (simulated)'
        : delivery.channel;

  if (delivery.status === 'sent' || delivery.status === 'simulated') {
    return (
      <p className="text-[11px] text-primary mt-1 inline-flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3" />
        {delivery.status === 'simulated' ? 'Simulated send' : 'Sent'} · {channelLabel} · {ts}
      </p>
    );
  }
  if (delivery.status === 'pending') {
    return (
      <p className="text-[11px] text-accent-foreground/90 mt-1 inline-flex items-center gap-1">
        <Clock className="w-3 h-3" /> Pending · {channelLabel} · {ts}
      </p>
    );
  }
  return (
    <p className="text-[11px] text-destructive mt-1 inline-flex items-center gap-1">
      <AlertCircle className="w-3 h-3" /> Failed · {delivery.error_message ?? channelLabel} · {ts}
    </p>
  );
};