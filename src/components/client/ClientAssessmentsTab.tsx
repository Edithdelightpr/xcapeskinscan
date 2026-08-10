import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, ClipboardList, CheckCircle2, AlertCircle, ScanFace, Activity, Share2, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { RealClient } from '@/hooks/useRealClients';
import VisitAssessmentModal from '@/components/admin/VisitAssessmentModal';
import { useClientAssessments, type VisitAssessment } from '@/hooks/useVisitAssessments';
import ShareReportDialog from '@/components/admin/ShareReportDialog';
import AcceptTreatmentPlanDialog from '@/components/admin/AcceptTreatmentPlanDialog';
import PaymentClaimsPanel from '@/components/admin/PaymentClaimsPanel';
import TreatmentPlanExecutionPanel from '@/components/admin/TreatmentPlanExecutionPanel';
import { useAuth } from '@/hooks/useAuth';

const ClientAssessmentsTab = ({ client }: { client: RealClient }) => {
  const { isAdmin, hasRole } = useAuth();
  const canWriteClinical = isAdmin || hasRole('medical_aesthetician');
  const { data: items = [], isLoading } = useClientAssessments(client.id);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VisitAssessment | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [deepLinkVisitId, setDeepLinkVisitId] = useState<string | null>(null);
  const [shareFor, setShareFor] = useState<VisitAssessment | null>(null);
  const [acceptFor, setAcceptFor] = useState<VisitAssessment | null>(null);

  // Deep-link support: /admin/clients/:id?tab=assessments&visit=<visitId>
  // Opens VisitAssessmentModal scoped to that visit. If an assessment already
  // exists for the visit, opens the existing one. The param is stripped once
  // consumed so refreshing doesn't reopen the modal on every mount.
  useEffect(() => {
    const v = searchParams.get('visit');
    if (!v) return;
    setDeepLinkVisitId(v);
    const match = items.find((a) => a.visit_id === v) ?? null;
    setEditing(match);
    setOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('visit');
    setSearchParams(next, { replace: true });
  }, [searchParams, items, setSearchParams]);

  const startNew = () => { setEditing(null); setOpen(true); };
  const startEdit = (a: VisitAssessment) => { setEditing(a); setOpen(true); };

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" /> Assessments
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Skin Analysis &amp; Body Composition reports for this client.
          </p>
        </div>
        {canWriteClinical ? (
          <Button onClick={startNew} className="glow-primary">
            <Plus className="w-4 h-4 mr-1.5" /> New Visit Log
          </Button>
        ) : (
          <span className="text-[11px] text-muted-foreground">
            Practitioner-only actions
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <div className="glass rounded-xl p-10 text-center space-y-2">
          <ClipboardList className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">No assessments yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <div
              key={a.id}
              className="glass rounded-lg p-4 hover:border-primary/60 border border-transparent transition-all"
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => startEdit(a)}
                  className="min-w-0 text-left flex-1"
                >
                  <p className="text-sm font-semibold text-foreground">
                    {new Date(a.created_at).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {a.main_concern || a.client_goal || 'General visit log'}
                  </p>
                </button>
                <div className="flex items-center gap-2 flex-wrap">
                  {a.skin_analysis_enabled && (
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                      <ScanFace className="w-3 h-3 mr-1" /> Skin
                    </Badge>
                  )}
                  {a.body_bmi_enabled && (
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                      <Activity className="w-3 h-3 mr-1" /> Body/BMI
                    </Badge>
                  )}
                  {a.report_ready ? (
                    <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/40 text-[10px] uppercase tracking-wider" variant="outline">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Report ready
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/15 text-amber-800 border-amber-500/40 text-[10px] uppercase tracking-wider" variant="outline">
                      <AlertCircle className="w-3 h-3 mr-1" /> Draft
                    </Badge>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); setShareFor(a); }}
                    disabled={!a.report_ready}
                    title={a.report_ready ? 'Share secure personal report link' : 'Complete the required readings first'}
                  >
                    <Share2 className="w-3.5 h-3.5 mr-1.5" /> Share
                  </Button>
                  {canWriteClinical && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); setAcceptFor(a); }}
                      disabled={!(a.recommended_services ?? []).some((r) => !!r.service_id)}
                      title="Accept recommendations as a treatment plan"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" /> Accept Plan
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <VisitAssessmentModal
          open={open}
          onClose={() => { setOpen(false); setEditing(null); setDeepLinkVisitId(null); }}
          client={client}
          visitId={editing?.visit_id ?? deepLinkVisitId ?? null}
          appointmentId={editing?.appointment_id ?? null}
        />
      )}

      {shareFor && (
        <ShareReportDialog
          open={!!shareFor}
          onClose={() => setShareFor(null)}
          client={client}
          assessment={shareFor}
        />
      )}

      {acceptFor && (
        <AcceptTreatmentPlanDialog
          open={!!acceptFor}
          onClose={() => setAcceptFor(null)}
          assessment={acceptFor}
        />
      )}

      <PaymentClaimsPanel client={client} />
      <TreatmentPlanExecutionPanel client={client} />
    </div>
  );
};

export default ClientAssessmentsTab;