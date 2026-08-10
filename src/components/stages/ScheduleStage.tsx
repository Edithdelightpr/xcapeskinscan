import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/appStore';
import { useRealClient, useUpdateRealClient } from '@/hooks/useRealClients';
import { useCreateRealAppointment } from '@/hooks/useRealAppointments';
import { useCurrentClientId } from '@/hooks/useCurrentClientId';
import { useAuth } from '@/hooks/useAuth';
import { useClientMedia, useUploadClientMedia, type ClientMedia } from '@/hooks/useClientMedia';
import { useSendDocumentDelivery } from '@/hooks/useDocumentDeliveries';
import { generateAndUploadClientReport } from '@/lib/clientReportPdf';
import { toast } from 'sonner';
import {
  CheckCircle2, FileText, Send, UserCircle2, CalendarDays, Sparkles, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import CalendarStage from './CalendarStage';

const ScheduleStage = () => {
  const { completeStage } = useAppStore();
  const [currentId] = useCurrentClientId();
  const { data: client } = useRealClient(currentId ?? undefined);
  const createAppt = useCreateRealAppointment();
  const updateClient = useUpdateRealClient();
  const { user } = useAuth();
  const { data: clientMedia = [] } = useClientMedia(currentId ?? undefined);
  const uploadMediaMut = useUploadClientMedia();
  const sendDeliveryMut = useSendDocumentDelivery();
  const [date, setDate] = useState('2026-04-18');
  const [time, setTime] = useState('10:00');
  const [booked, setBooked] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [error, setError] = useState('');
  const [generatedReport, setGeneratedReport] = useState<ClientMedia | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  const plan = (client?.treatment_plan ?? null) as
    | { timeline?: string; treatments?: { enabled: boolean; name: string }[] }
    | null;
  const analysis = (client?.skin_analysis ?? null) as { primaryConcerns?: string[] } | null;
  const firstTreatmentName = plan?.treatments?.find((t) => t.enabled)?.name || 'Consultation';
  // Pre-existing report, if MembershipStage already generated one
  const existingReport = clientMedia.find(
    (m) => (m.category ?? m.kind) === 'report' && (m.file_type ?? '') !== 'video',
  ) ?? null;
  const reportRow = generatedReport ?? existingReport;

  const handleBook = async () => {
    if (!client) return;
    setError('');
    try {
      await createAppt.mutateAsync({
        client_id: client.id,
        date,
        time,
        treatment: firstTreatmentName,
        notes: `Plan: ${plan?.timeline ?? 'N/A'}`,
        membership: client.membership_type,
        skin_summary: analysis?.primaryConcerns?.join(', ') || 'N/A',
        source: client.source_type,
        attributed_staff_id: client.attributed_staff_id ?? null,
        created_by: user?.id ?? null,
      });
      await updateClient.mutateAsync({ id: client.id, patch: { status: 'booked' } });
      setBooked(true);
      completeStage(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to book appointment');
    }
  };

  const handleGeneratePdf = async () => {
    if (!client) return;
    setGenerating(true);
    const t = toast.loading('Generating PDF report…');
    try {
      const tier =
        client.membership_type === 'member'
          ? 'member'
          : client.membership_type === 'elite'
            ? 'elite'
            : client.membership_type === 'one_time'
              ? 'regular'
              : undefined;
      const row = await generateAndUploadClientReport({
        client,
        tier,
        uploadFn: uploadMediaMut.mutateAsync,
        photos: clientMedia,
      });
      setGeneratedReport(row);
      toast.success('PDF saved to client profile', { id: t });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'PDF failed', { id: t });
    } finally {
      setGenerating(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!client) return;
    if (!reportRow) {
      toast.error('Generate the PDF first, then send to WhatsApp');
      return;
    }
    if (!client.phone) {
      toast.error('No phone number on file for this client');
      return;
    }
    setSending(true);
    const t = toast.loading('Sending via WhatsApp…');
    try {
      const res = await sendDeliveryMut.mutateAsync({
        clientId: client.id,
        mediaId: reportRow.id,
        phoneNumber: client.phone,
      });
      if (res.status === 'failed') toast.error(res.error_message ?? 'Send failed', { id: t });
      else if (res.status === 'simulated') toast.success('Simulated WhatsApp send recorded', { id: t });
      else toast.success('Queued for WhatsApp delivery', { id: t });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Send failed', { id: t });
    } finally {
      setSending(false);
    }
  };

  if (showCalendar) return <CalendarStage />;

  if (!client) return <p className="text-muted-foreground">Please select a client first.</p>;

  return (
    <div className="animate-slide-up space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display font-bold text-foreground">Schedule Appointment</h2>
        <Button variant="outline" size="sm" onClick={() => setShowCalendar(true)}>
          View Calendar
        </Button>
      </div>

      {!booked ? (
        <div className="glass rounded-xl p-6 max-w-md space-y-5">
          <div className="space-y-3">
            <p className="text-sm text-foreground font-medium">{client.full_name}</p>
            <p className="text-xs text-muted-foreground">
              Treatment: {firstTreatmentName}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-surface border-border/60" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Time</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-surface border-border/60" />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button onClick={handleBook} disabled={createAppt.isPending || updateClient.isPending} className="w-full glow-primary">
            {createAppt.isPending ? 'Saving to cloud…' : 'Confirm Appointment'}
          </Button>
        </div>
      ) : (
        <div className="glass rounded-xl p-7 space-y-6 max-w-2xl glow-primary-soft">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-display font-bold text-foreground">Appointment Confirmed</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Booking saved · client moved to "Booked" status
              </p>
            </div>
          </div>

          {/* Confirmation details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Client</p>
              <p className="text-foreground font-medium">{client.full_name}</p>
              <p className="text-xs text-muted-foreground">{client.client_code}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Phone</p>
              <p className="text-foreground">{client.phone || <span className="text-destructive italic">Not on file</span>}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Treatment</p>
              <p className="text-foreground">{firstTreatmentName}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Date & Time</p>
              <p className="text-foreground">{date} · {time}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Membership</p>
              <p className="text-foreground capitalize">{client.membership_type.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Analysis Summary</p>
              <p className="text-foreground text-xs">
                {analysis?.primaryConcerns?.join(', ') || 'No analysis on file'}
              </p>
            </div>
          </div>

          {/* PDF + delivery status */}
          <div className="rounded-lg bg-surface/60 border border-border/40 p-3 flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0 text-xs">
              {reportRow ? (
                <>
                  <p className="text-foreground font-medium truncate">{reportRow.file_name ?? 'Treatment report'}</p>
                  <p className="text-muted-foreground">PDF ready to send to WhatsApp</p>
                </>
              ) : (
                <p className="text-muted-foreground">No PDF generated yet for this booking</p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              onClick={handleGeneratePdf}
              disabled={generating}
              variant={reportRow ? 'outline' : 'default'}
              className={reportRow ? '' : 'glow-primary'}
            >
              {generating ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-1.5" /> {reportRow ? 'Regenerate PDF' : 'Generate PDF Report'}</>
              )}
            </Button>
            <Button
              onClick={handleSendWhatsApp}
              disabled={sending || !reportRow || !client.phone}
              className={reportRow ? 'glow-primary' : ''}
              title={!reportRow ? 'Generate the PDF first' : !client.phone ? 'No phone on file' : 'Send via WhatsApp'}
            >
              {sending ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Sending…</>
              ) : (
                <><Send className="w-4 h-4 mr-1.5" /> Send PDF to WhatsApp</>
              )}
            </Button>
            <Button asChild variant="outline">
              <Link to={`/admin/clients/${client.id}`}>
                <UserCircle2 className="w-4 h-4 mr-1.5" /> View Client Profile
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setShowCalendar(true)}>
              <CalendarDays className="w-4 h-4 mr-1.5" /> View in Calendar
            </Button>
          </div>

          {!client.phone && (
            <p className="text-[11px] text-destructive/90 italic">
              Add a phone number on the client profile to enable WhatsApp delivery.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ScheduleStage;
