import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertCircle, CheckCircle2, Eye, FileText, Loader2, Save, Share2,
} from 'lucide-react';
import ShareReportDialog from '@/components/admin/ShareReportDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { buildReportPreviewUrl } from '@/lib/reportPreview';
import type { RealClient } from '@/hooks/useRealClients';
import type { VisitAssessment } from '@/hooks/useVisitAssessments';
import { useAssessmentProposals } from '@/hooks/useXcapeProposals';

interface Props {
  client: RealClient;
  readiness: { ready: boolean; missing: string[] };
  ensureSaved: () => Promise<VisitAssessment>;
  savePending: boolean;
  assessments: VisitAssessment[];
  /** Current draft assessment — used to gate on undecided XCAPE proposals. */
  assessmentId: string | null;
}

/**
 * Step 6 — Report. Existing readiness rules gate generation; the existing
 * ShareReportDialog mints and manages secure report links. Reports may only
 * be shared once every generated XCAPE proposal has been decided — accepted
 * proposals feed the recommendations; pending ones block sharing so an
 * unreviewed suggestion never reaches a client report.
 */
const StepReport = ({ client, readiness, ensureSaved, savePending, assessments, assessmentId }: Props) => {
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareAssessment, setShareAssessment] = useState<VisitAssessment | null>(null);
  const navigate = useNavigate();
  const { data: proposals = [] } = useAssessmentProposals(assessmentId);
  const pendingProposals = proposals.filter((p) => p.status === 'proposed').length;
  const blockedByProposals = pendingProposals > 0;

  const past = assessments.filter((a) => a.report_ready).slice(0, 5);

  const handleSave = async () => {
    setSaving(true);
    try {
      await ensureSaved();
      toast.success('Analysis saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Preview requires a persisted assessment id — save first, then open the
   * staff preview for the exact saved row. Navigating without the returned
   * id is rejected by AdminReportPreview ("Missing client or assessment").
   */
  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const saved = await ensureSaved();
      navigate(buildReportPreviewUrl(client.id, saved.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed before preview');
    } finally {
      setPreviewing(false);
    }
  };

  const handleShare = async () => {
    if (!readiness.ready) {
      toast.error(readiness.missing[0] ?? 'Complete the XCAPE scores first');
      return;
    }
    if (blockedByProposals) {
      toast.error(
        `${pendingProposals} XCAPE proposal(s) are still awaiting a decision — accept, edit or reject each one in the Recommendations step before sharing.`,
      );
      return;
    }
    setSharing(true);
    try {
      const saved = await ensureSaved();
      setShareAssessment(saved);
      setShareOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed before sharing');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Readiness */}
      <section
        className={cn(
          'glass rounded-xl p-5 space-y-3 border',
          readiness.ready ? 'border-emerald-500/40' : 'border-amber-500/40',
        )}
      >
        <p
          className={cn(
            'text-sm font-semibold inline-flex items-center gap-1.5',
            readiness.ready ? 'text-emerald-700' : 'text-amber-800',
          )}
        >
          {readiness.ready ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {readiness.ready ? 'Report ready' : 'Report not ready yet'}
        </p>
        {!readiness.ready && (
          <ul className="ml-5 list-disc text-[11px] text-amber-800 space-y-0.5">
            {readiness.missing.map((m) => <li key={m}>{m}</li>)}
          </ul>
        )}
        {readiness.ready && (
          <p className="text-[11px] text-muted-foreground">
            The report is generated from the confirmed XCAPE scores, practitioner findings and
            recommendations. Save is automatic once scores exist — use
            <strong> Share report</strong> to send the client a secure link to their personal report page.
          </p>
        )}

        {blockedByProposals && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
            <p className="text-[11px] text-amber-300">
              {pendingProposals} XCAPE proposal(s) awaiting your decision. Reports are generated only
              from practitioner-approved recommendations — accept, edit or reject each proposal in the
              Recommendations step before sharing.
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={handleSave}
            disabled={saving || savePending}
          >
            {(saving || savePending) ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Save analysis
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handlePreview}
            disabled={previewing || saving || savePending}
            title="Saves the analysis, then opens the staff preview for this exact assessment"
          >
            {previewing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Eye className="w-4 h-4 mr-1.5" />}
            Preview report
          </Button>
          <Button
            type="button"
            onClick={handleShare}
            disabled={savePending || sharing || !readiness.ready || blockedByProposals}
            title={blockedByProposals ? 'Decide on all XCAPE proposals first' : readiness.ready ? 'Save and share a secure report link with the client' : (readiness.missing[0] ?? 'Complete the required readings first')}
            className="glow-primary"
          >
            {sharing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Share2 className="w-4 h-4 mr-1.5" />}
            Share report
          </Button>
        </div>
      </section>

      {/* Report history for this client */}
      <section className="glass rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Report history — {client.full_name}
          </h2>
          <Button type="button" variant="ghost" size="sm" className="text-xs" asChild>
            <Link to="/xcape/reports">All reports</Link>
          </Button>
        </div>
        {past.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">
            No completed reports for this client yet.
          </p>
        ) : (
          <div className="space-y-1.5">
            {past.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/30 bg-surface/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs text-foreground">
                    {new Date(a.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    {a.main_concern ? ` · ${a.main_concern}` : ''}
                  </p>
                </div>
                <Badge className="text-[9px] bg-primary/15 text-primary border-0 shrink-0">Report ready</Badge>
              </div>
            ))}
          </div>
        )}
      </section>

      {shareOpen && shareAssessment && (
        <ShareReportDialog
          open={shareOpen}
          onClose={() => { setShareOpen(false); setShareAssessment(null); }}
          client={client}
          assessment={shareAssessment}
        />
      )}
    </div>
  );
};

export default StepReport;
