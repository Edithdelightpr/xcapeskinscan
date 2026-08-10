import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { ScanFace, UserPlus, Play, History, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import ClientSearchPicker from '@/components/admin/ClientSearchPicker';
import VisitAssessmentModal from '@/components/admin/VisitAssessmentModal';
import { useCreateRealClient, type RealClient } from '@/hooks/useRealClients';
import { useClientAssessments, type VisitAssessment } from '@/hooks/useVisitAssessments';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

/**
 * XCAPE primary destination — opens the proven practitioner assessment
 * workflow (VisitAssessmentModal) against a selected client.
 * visitId=null starts a new practitioner log; no code path is altered.
 */
const XcapeNewAnalysis = () => {
  const { user } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);
  const [client, setClient] = useState<RealClient | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', location: '' });
  const createMut = useCreateRealClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VisitAssessment | null>(null);

  const { data: assessments = [] } = useClientAssessments(clientId ?? undefined);
  const recent = [...assessments]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const handlePick = (id: string, picked: RealClient) => {
    setClientId(id);
    setClient(picked);
    setCreateMode(false);
  };

  const handleCreate = async () => {
    if (!form.full_name.trim()) {
      toast.error('Client name is required');
      return;
    }
    try {
      const created = await createMut.mutateAsync({
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        location: form.location.trim() || null,
        source_type: null,
        attributed_staff_id: user?.id ?? null,
        status: 'lead',
      });
      toast.success(`Client ${created.full_name} created`);
      setClientId(created.id);
      setClient(created);
      setCreateMode(false);
      setForm({ full_name: '', phone: '', email: '', location: '' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create client');
    }
  };

  const startNew = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const continueDraft = (a: VisitAssessment) => {
    setEditing(a);
    setModalOpen(true);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Helmet>
        <title>New Analysis — XCAPE</title>
      </Helmet>

      <XcapePageHeader
        title="New Analysis"
        description="Start or continue a tropical skin analysis. Findings and scores are captured first; treatment and home-care directions are recorded separately by the practitioner."
      />

      {/* Step 1 — client */}
      <section className="glass rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] font-bold flex items-center justify-center">1</span>
            Select client
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => setCreateMode((v) => !v)}
          >
            <UserPlus className="w-3.5 h-3.5 mr-1.5" />
            {createMode ? 'Search existing' : 'Create new client'}
          </Button>
        </div>

        {createMode ? (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="xc-name" className="text-xs">Full name *</Label>
                <Input
                  id="xc-name"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="bg-surface border-border/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="xc-phone" className="text-xs">Phone</Label>
                <Input
                  id="xc-phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="bg-surface border-border/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="xc-email" className="text-xs">Email</Label>
                <Input
                  id="xc-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="bg-surface border-border/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="xc-location" className="text-xs">Location</Label>
                <Input
                  id="xc-location"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  className="bg-surface border-border/60"
                />
              </div>
            </div>
            <Button onClick={handleCreate} disabled={createMut.isPending} className="bg-primary text-primary-foreground">
              {createMut.isPending ? 'Creating…' : 'Create & select client'}
            </Button>
          </div>
        ) : (
          <ClientSearchPicker value={clientId} onChange={handlePick} />
        )}
      </section>

      {/* Step 2 — begin */}
      <section className="glass rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] font-bold flex items-center justify-center">2</span>
          Begin analysis
        </h2>
        <Button
          size="lg"
          onClick={startNew}
          disabled={!client}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 text-sm"
        >
          <ScanFace className="w-4 h-4 mr-2" />
          {client ? `Start skin analysis for ${client.full_name}` : 'Select a client to start'}
        </Button>

        {client && recent.length > 0 && (
          <div className="pt-2 space-y-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold flex items-center gap-1.5">
              <History className="w-3 h-3" /> Recent assessments for {client.full_name}
            </p>
            <div className="space-y-1.5">
              {recent.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-surface/60 border border-border/30"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-foreground">
                      {new Date(a.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      {a.main_concern ? ` · ${a.main_concern}` : ''}
                    </p>
                    <div className="flex gap-1.5 mt-1">
                      {a.report_ready ? (
                        <Badge className="text-[9px] bg-primary/15 text-primary border-0">Report ready</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] border-border/50 text-muted-foreground">Draft</Badge>
                      )}
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="text-xs shrink-0" onClick={() => continueDraft(a)}>
                    <RotateCcw className="w-3.5 h-3.5 mr-1" /> Continue
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {client && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1">
            <Play className="w-3 h-3" /> Image capture, AI-assisted scoring, practitioner review and report generation run inside the assessment.
          </p>
        )}
      </section>

      {modalOpen && client && (
        <VisitAssessmentModal
          open={modalOpen}
          client={client}
          visitId={editing?.visit_id ?? null}
          appointmentId={editing?.appointment_id ?? null}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
};

export default XcapeNewAnalysis;
