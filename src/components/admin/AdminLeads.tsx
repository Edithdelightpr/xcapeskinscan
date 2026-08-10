import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRealClients, useUpdateRealClient, useDeleteRealClient } from '@/hooks/useRealClients';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useRealAppointments } from '@/hooks/useRealAppointments';
import { useAuth } from '@/hooks/useAuth';
import {
  useOutreachTemplates,
  useCreateOutreachTemplate,
  useUpdateOutreachTemplate,
  useDeleteOutreachTemplate,
  useCreateOutreachLog,
  useUpdateOutreachLog,
  useOutreachLogs,
  type OutreachTemplate,
  type OutreachLog,
} from '@/hooks/useOutreach';
import { openWhatsApp, renderTemplate, deriveFirstName } from '@/lib/whatsapp';
import { buildLeadOutreachMessage } from '@/lib/leadOutreachMessage';
import PipelineStageSelect, { type PipelineStage } from '@/components/admin/PipelineStageSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Plus, Pencil, Trash2, X, Save, Check, XCircle, Upload, Clock, Download, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import CsvLeadImportModal from './CsvLeadImportModal';
import ClientCaptureForm from '@/components/intake/ClientCaptureForm';
import { UserPlus } from 'lucide-react';
import { toCsv, downloadCsv, type CsvColumn } from '@/lib/csvExport';
import { isValidE164 } from '@/lib/phone';
import LogInteractionModal from './LogInteractionModal';
import { isStaleLead, hoursSinceTouch } from '@/hooks/useLeadInteractions';
import { MessageSquarePlus } from 'lucide-react';

type ClientStatus = Database['public']['Enums']['client_status'];

const STATUS_LABELS: Record<ClientStatus, string> = {
  lead: 'Lead', new_lead: 'New Lead', contacted: 'Contacted', booked: 'Booked',
  consultation_booked: 'Consultation Booked', scheduled: 'Scheduled',
  payment_pending: 'Payment Pending', converted: 'Converted',
  member: 'Member', elite: 'Elite',
  follow_up_required: 'Follow-up Required', renewal_due: 'Renewal Due',
  no_show: 'No-show', not_reached: 'Not Reached', inactive: 'Inactive',
};

/** Statuses staff can pick from the inline dropdown on each lead row. */
const STATUS_OPTIONS: ClientStatus[] = [
  'new_lead', 'contacted', 'consultation_booked', 'scheduled', 'payment_pending',
  'follow_up_required', 'not_reached', 'converted', 'member', 'elite',
  'renewal_due', 'no_show', 'inactive',
];

/** Source values that should match the "CSV Import" filter chip. */
const CSV_SOURCE_VALUES = new Set(['csv-import', 'csv_import', 'csv import', 'csv']);
const isCsvSource = (s: string | null | undefined) => {
  if (!s) return false;
  const v = s.toLowerCase().trim();
  return CSV_SOURCE_VALUES.has(v) || v.startsWith('csv');
};

/** Source values that should match the "Calendly" filter chip (n8n webhook writes this). */
const isCalendlySource = (s: string | null | undefined) => {
  if (!s) return false;
  return s.toLowerCase().trim().startsWith('calendly');
};

/**
 * Lead "stages" used in filter UI. Some are persisted client_status enum values,
 * others are derived from appointments / membership at runtime.
 */
const STAGE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'new_lead', label: 'New Lead' },
  { id: 'lead', label: 'Lead (legacy)' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'consultation_booked', label: 'Consultation Booked' },
  { id: 'scheduled', label: 'Scheduled Appointment' },
  { id: 'payment_pending', label: 'Payment Pending' },
  { id: 'converted', label: 'Converted' },
  { id: 'member', label: 'Member' },
  { id: 'elite', label: 'Elite Member' },
  { id: 'follow_up_required', label: 'Follow-up Required' },
  { id: 'not_reached', label: 'Not Reached' },
  { id: 'renewal_due', label: 'Renewal Due' },
  { id: 'no_show', label: 'No-show' },
  { id: 'inactive', label: 'Inactive' },
] as const;
type StageId = (typeof STAGE_FILTERS)[number]['id'];

/** Membership tier filter options. */
const TIER_FILTERS = [
  { id: 'all',      label: 'All tiers' },
  { id: 'none',     label: 'None' },
  { id: 'one_time', label: 'One-time' },
  { id: 'member',   label: 'Member' },
  { id: 'elite',    label: 'Elite' },
] as const;
type TierId = (typeof TIER_FILTERS)[number]['id'];

/** "Created in last N days" preset. */
const DATE_FILTERS = [
  { id: 'any', label: 'Any time', days: null as number | null },
  { id: '7',   label: 'Last 7d',  days: 7 },
  { id: '30',  label: 'Last 30d', days: 30 },
  { id: '90',  label: 'Last 90d', days: 90 },
] as const;
type DateFilterId = (typeof DATE_FILTERS)[number]['id'];

const TEMPLATE_CATEGORIES = [
  { id: 'new_lead', label: 'New Lead' },
  { id: 'scheduled_appointment', label: 'Scheduled Appointment' },
  { id: 'payment_pending', label: 'Payment Pending' },
  { id: 'follow_up_required', label: 'Follow-up Required' },
  { id: 'renewal_due', label: 'Renewal Due' },
  { id: 'no_show', label: 'No-show' },
  { id: 'general', label: 'General' },
];

/** Outreach status filters (independent from lead stage). */
const OUTREACH_FILTERS = [
  { id: 'any', label: 'Any outreach' },
  { id: 'not_contacted', label: 'Not contacted' },
  { id: 'contacted_recent', label: 'Contacted (7d)' },
  { id: 'follow_up_needed', label: 'Follow-up needed (>14d)' },
  { id: 'awaiting_confirmation', label: 'Awaiting confirmation' },
] as const;
type OutreachFilterId = (typeof OUTREACH_FILTERS)[number]['id'];

const DAY_MS = 24 * 60 * 60 * 1000;

const AdminLeads = () => {
  const { data: clients = [] } = useRealClients();
  const { data: staff = [] } = useRealStaff();
  const { data: appointments = [] } = useRealAppointments();
  const { user } = useAuth();
  const [csvOpen, setCsvOpen] = useState(false);
  const [quickLeadOpen, setQuickLeadOpen] = useState(false);
  const updateClient = useUpdateRealClient();
  const deleteClient = useDeleteRealClient();
  const [confirmDeleteId, setConfirmDeleteId] = useState<{ id: string; name: string } | null>(null);
  const { data: templates = [] } = useOutreachTemplates();
  const createTemplate = useCreateOutreachTemplate();
  const updateTemplate = useUpdateOutreachTemplate();
  const deleteTemplate = useDeleteOutreachTemplate();
  const logOutreach = useCreateOutreachLog();
  const updateOutreach = useUpdateOutreachLog();
  const { data: outreachLogs = [] } = useOutreachLogs();
  const { data: outreachSessions = [] } = useQuery({
    queryKey: ['admin-leads-outreach-names'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outreach_sessions')
        .select('id, name')
        .order('outreach_date', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });
  const outreachNameById = useMemo(() => {
    const m = new Map<string, string>();
    outreachSessions.forEach((o) => m.set(o.id, o.name));
    return m;
  }, [outreachSessions]);

  const [stage, setStage] = useState<StageId>('all');
  const [source, setSource] = useState<string>('All');
  const [csvOnly, setCsvOnly] = useState(false);
  const [calendlyOnly, setCalendlyOnly] = useState(false);
  const [outreachIdFilter, setOutreachIdFilter] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string>('All');
  const [outreachFilter, setOutreachFilter] = useState<OutreachFilterId>('any');
  const [tier, setTier] = useState<TierId>('all');
  const [dateRange, setDateRange] = useState<DateFilterId>('any');
  const [hasPhone, setHasPhone] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [interactionTarget, setInteractionTarget] = useState<{ id: string; name: string } | null>(null);
  const [draftMessage, setDraftMessage] = useState<string>('');
  const [showTemplates, setShowTemplates] = useState(false);
  /** The most-recent log we just created via the WhatsApp click — pending Sent/Not Sent confirmation. */
  const [pendingLog, setPendingLog] = useState<OutreachLog | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  /** Map client_id -> latest outreach log (any status). */
  const latestLogByClient = useMemo(() => {
    const m = new Map<string, OutreachLog>();
    [...outreachLogs]
      .sort((a, b) => (b.clicked_at ?? '').localeCompare(a.clicked_at ?? ''))
      .forEach((l) => { if (!m.has(l.client_id)) m.set(l.client_id, l); });
    return m;
  }, [outreachLogs]);

  /** Map client_id -> next upcoming appointment */
  const nextApptByClient = useMemo(() => {
    const m = new Map<string, typeof appointments[number]>();
    [...appointments]
      .filter((a) => a.date >= today && (a.status === 'scheduled' || a.status === 'arrived'))
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
      .forEach((a) => {
        if (!m.has(a.client_id)) m.set(a.client_id, a);
      });
    return m;
  }, [appointments, today]);

  /** Map client_id -> latest appointment overall (for no-show / follow-up detection) */
  const lastApptByClient = useMemo(() => {
    const m = new Map<string, typeof appointments[number]>();
    [...appointments]
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
      .forEach((a) => { if (!m.has(a.client_id)) m.set(a.client_id, a); });
    return m;
  }, [appointments]);

  /** Derive a stage label per client. */
  const deriveStage = (c: typeof clients[number]): StageId => {
    const last = lastApptByClient.get(c.id);
    if (last?.status === 'no_show') return 'no_show';
    if (nextApptByClient.has(c.id)) {
      return c.status === 'lead' || c.status === 'contacted'
        ? 'consultation_booked'
        : 'scheduled';
    }
    if (c.membership_type === 'elite' || c.status === 'elite') return 'elite';
    if (c.membership_type === 'member' || c.status === 'member') return 'member';
    return c.status as StageId;
  };

  const filtered = useMemo(() => {
    const days = DATE_FILTERS.find((d) => d.id === dateRange)?.days ?? null;
    const cutoff = days ? Date.now() - days * DAY_MS : null;
    const q = searchQ.trim().toLowerCase();
    return clients.filter((c) => {
      if (stage !== 'all' && deriveStage(c) !== stage) return false;
      if (source !== 'All' && c.source_type !== source) return false;
      if (csvOnly && !isCsvSource(c.source_type)) return false;
      if (calendlyOnly && !isCalendlySource(c.source_type)) return false;
      if (outreachIdFilter && c.outreach_id !== outreachIdFilter) return false;
      if (staffId !== 'All' && c.attributed_staff_id !== staffId) return false;
      if (tier !== 'all' && (c.membership_type ?? 'none') !== tier) return false;
      if (hasPhone && !c.phone) return false;
      if (hasEmail && !c.email) return false;
      if (cutoff && c.created_at && new Date(c.created_at).getTime() < cutoff) return false;
      if (q) {
        const hay = `${c.full_name ?? ''} ${c.phone ?? ''} ${c.email ?? ''} ${c.client_code ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (outreachFilter !== 'any') {
        const log = latestLogByClient.get(c.id);
        const lastTouchIso = log?.sent_at ?? log?.clicked_at ?? (c as { last_contact_date?: string | null }).last_contact_date ?? null;
        const ageMs = lastTouchIso ? Date.now() - new Date(lastTouchIso).getTime() : Infinity;
        if (outreachFilter === 'not_contacted' && log) return false;
        if (outreachFilter === 'contacted_recent' && !(ageMs <= 7 * DAY_MS)) return false;
        if (outreachFilter === 'follow_up_needed' && !(log && ageMs > 14 * DAY_MS)) return false;
        if (outreachFilter === 'awaiting_confirmation' && !(log && log.status === 'clicked')) return false;
      }
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, stage, source, csvOnly, calendlyOnly, outreachIdFilter, staffId, outreachFilter, tier, dateRange, hasPhone, hasEmail, searchQ, latestLogByClient, nextApptByClient, lastApptByClient]);

  const staffName = (id?: string | null) => staff.find((s) => s.id === id)?.full_name || '—';

  /**
   * Build & download a CSV of the currently-filtered leads. Column shape is
   * tuned for direct import into Klaviyo (`email`, `phone_number`) and
   * WhatsApp Business contacts (`first_name` + `phone_e164`).
   */
  const handleExportCsv = () => {
    const rows = filtered;
    if (rows.length === 0) {
      toast.info('No leads match the current filters.');
      return;
    }
    const splitName = (full: string | null | undefined) => {
      const n = (full ?? '').trim();
      if (!n) return { first: '', last: '' };
      const parts = n.split(/\s+/);
      return { first: parts[0], last: parts.slice(1).join(' ') };
    };
    type Row = (typeof rows)[number];
    const cols: CsvColumn<Row>[] = [
      { key: 'first_name',         header: 'first_name',         value: (c) => splitName(c.full_name).first },
      { key: 'last_name',          header: 'last_name',          value: (c) => splitName(c.full_name).last },
      { key: 'full_name',          header: 'full_name',          value: (c) => c.full_name ?? '' },
      { key: 'phone_e164',         header: 'phone_e164',         value: (c) => (isValidE164(c.phone) ? c.phone! : '') },
      { key: 'phone_raw',          header: 'phone_raw',          value: (c) => c.phone ?? '' },
      { key: 'email',              header: 'email',              value: (c) => c.email ?? '' },
      { key: 'source',             header: 'source',             value: (c) => c.source_type ?? '' },
      { key: 'stage',              header: 'stage',              value: (c) => deriveStage(c) },
      { key: 'pipeline_stage',     header: 'pipeline_stage',     value: (c) => (c as { pipeline_stage?: string }).pipeline_stage ?? 'new' },
      { key: 'membership_tier',    header: 'membership_tier',    value: (c) => c.membership_type ?? '' },
      { key: 'attributed_staff',   header: 'attributed_staff',   value: (c) => staffName(c.attributed_staff_id) },
      { key: 'last_contact_date',  header: 'last_contact_date',  value: (c) => (c as { last_contact_date?: string | null }).last_contact_date ?? '' },
      { key: 'created_at',         header: 'created_at',         value: (c) => c.created_at ?? '' },
      { key: 'client_code',        header: 'client_code',        value: (c) => c.client_code ?? '' },
    ];
    const csv = toCsv(rows, cols);
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(`tropics-leads-${today}.csv`, csv);
    const withPhone = rows.filter((c) => isValidE164(c.phone)).length;
    const withEmail = rows.filter((c) => c.email).length;
    toast.success(`Exported ${rows.length} leads — ${withPhone} with phone, ${withEmail} with email.`);
  };
  const sourceOptions = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => { if (c.source_type) set.add(c.source_type); });
    return Array.from(set);
  }, [clients]);

  const stageColor = (s: StageId) => {
    switch (s) {
      case 'lead': return 'bg-primary/15 text-primary';
      case 'new_lead': return 'bg-primary/15 text-primary';
      case 'contacted': return 'bg-primary/10 text-primary';
      case 'consultation_booked': return 'bg-blue-500/15 text-blue-400';
      case 'scheduled': return 'bg-blue-500/20 text-blue-300';
      case 'payment_pending': return 'bg-yellow-500/20 text-yellow-300';
      case 'converted': return 'bg-green-500/20 text-green-400';
      case 'member': return 'bg-accent/20 text-accent-foreground';
      case 'elite': return 'bg-accent/30 text-amber-700 font-semibold';
      case 'follow_up_required': return 'bg-orange-500/20 text-orange-300';
      case 'not_reached': return 'bg-orange-500/15 text-orange-300';
      case 'renewal_due': return 'bg-fuchsia-500/20 text-fuchsia-300';
      case 'no_show': return 'bg-destructive/20 text-destructive';
      case 'inactive': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const stageLabel = (s: StageId) => STAGE_FILTERS.find((f) => f.id === s)?.label ?? s;

  /** Build template context for the currently selected client */
  const selectedClient = clients.find((c) => c.id === selectedClientId) ?? null;
  const selectedAppt = selectedClient ? nextApptByClient.get(selectedClient.id) : undefined;
  const selectedStaff = selectedClient ? staff.find((s) => s.id === selectedClient.attributed_staff_id) : undefined;

  const onPickTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!selectedClient) return;
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    const rendered = renderTemplate(tpl.body, {
      client_name: selectedClient.full_name,
      first_name: deriveFirstName(selectedClient.full_name),
      phone: selectedClient.phone,
      appointment_date: selectedAppt?.date,
      appointment_time: selectedAppt?.time,
      membership_type: selectedClient.membership_type,
      service_name: selectedAppt?.treatment,
      staff_name: selectedStaff?.full_name,
    });
    setDraftMessage(rendered);
  };

  const sendWhatsApp = async () => {
    if (!selectedClient) return;
    if (!draftMessage.trim()) {
      toast.error('Pick a template or write a message first.');
      return;
    }
    const link = openWhatsApp(selectedClient.phone, draftMessage);
    if (!selectedClient.phone) {
      toast.warning('No phone on file — opened WhatsApp without recipient.');
    }
    try {
      const created = await logOutreach.mutateAsync({
        client_id: selectedClient.id,
        staff_user_id: user?.id ?? null,
        template_id: selectedTemplateId || null,
        template_category: templates.find((t) => t.id === selectedTemplateId)?.category ?? null,
        message_text: draftMessage,
        phone_number: selectedClient.phone ?? null,
        status: 'clicked',
      });
      setPendingLog(created);
      toast.success('WhatsApp opened — confirm whether the message was sent.');
      // eslint-disable-next-line no-console
      console.log('[WhatsApp] logged outreach', created.id, 'url:', link);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to log outreach');
    }
  };

  /** Quick verification helper — opens a sample message without logging. */
  const testWhatsApp = () => {
    const sample = 'Tropics MedSpa test message ✓ (link verification)';
    const phone = selectedClient?.phone ?? '2348012345678';
    const url = openWhatsApp(phone, sample);
    toast.info(`Test link opened. Check console for URL.`);
    // eslint-disable-next-line no-console
    console.log('[WhatsApp Test] opened:', url);
  };

  const confirmSent = async () => {
    if (!pendingLog || !selectedClient) return;
    const nowIso = new Date().toISOString();
    try {
      await updateOutreach.mutateAsync({
        id: pendingLog.id,
        patch: { status: 'sent', sent_at: nowIso } as Partial<OutreachLog>,
      });
      // Stamp last contact, and if the lead is still untouched, promote to contacted.
      const promote = selectedClient.status === 'lead' || selectedClient.status === 'new_lead';
      try {
        await updateClient.mutateAsync({
          id: selectedClient.id,
          patch: promote
            ? { last_contact_date: nowIso, status: 'contacted' }
            : { last_contact_date: nowIso },
        });
      } catch { /* non-fatal — outreach log is the source of truth */ }
      toast.success('Marked as sent.');
      setPendingLog(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update outreach');
    }
  };

  const confirmNotSent = async () => {
    if (!pendingLog) return;
    try {
      await updateOutreach.mutateAsync({
        id: pendingLog.id,
        patch: { status: 'not_sent' } as Partial<OutreachLog>,
      });
      toast.success('Marked as not sent.');
      setPendingLog(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update outreach');
    }
  };

  /** Inline status change from the lead row dropdown. */
  const onChangeStatus = async (clientId: string, next: ClientStatus, current: ClientStatus) => {
    if (next === current) return;
    const nowIso = new Date().toISOString();
    const patch: Database['public']['Tables']['clients']['Update'] = { status: next };
    if (next === 'contacted') patch.last_contact_date = nowIso;
    try {
      await updateClient.mutateAsync({ id: clientId, patch });
      toast.success(`Status → ${STATUS_LABELS[next]}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Status update failed');
    }
  };

  /**
   * One-click WhatsApp send for a lead row. Builds the standard Sunday
   * intro message, opens WhatsApp, stamps last_contact_date, advances
   * pipeline stage to `contacted` if still `new`, and logs the outreach.
   */
  const quickWhatsAppSend = async (lead: typeof clients[number]) => {
    if (!lead.phone) {
      toast.error('No phone number on file for this lead.');
      return;
    }
    const slug = staff.find((s) => s.id === lead.attributed_staff_id)?.booking_slug ?? null;
    const message = buildLeadOutreachMessage({ full_name: lead.full_name, attributed_staff_slug: slug });
    openWhatsApp(lead.phone, message);
    const nowIso = new Date().toISOString();
    const stage = (lead as { pipeline_stage?: PipelineStage }).pipeline_stage ?? 'new';
    const patch: Database['public']['Tables']['clients']['Update'] = { last_contact_date: nowIso };
    if (stage === 'new') patch.pipeline_stage = 'contacted';
    if (lead.status === 'lead' || lead.status === 'new_lead') patch.status = 'contacted';
    try {
      await updateClient.mutateAsync({ id: lead.id, patch });
      await logOutreach.mutateAsync({
        client_id: lead.id,
        staff_user_id: user?.id ?? null,
        template_id: null,
        template_category: 'quick_whatsapp',
        message_text: message,
        phone_number: lead.phone,
        status: 'clicked',
      });
      toast.success(`WhatsApp opened for ${lead.full_name?.split(' ')[0] ?? 'lead'}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'WhatsApp opened but logging failed.');
    }
  };

  /** Inline pipeline stage change. */
  const onChangePipelineStage = async (clientId: string, next: PipelineStage) => {
    try {
      await updateClient.mutateAsync({
        id: clientId,
        patch: { pipeline_stage: next } as Database['public']['Tables']['clients']['Update'],
      });
      toast.success(`Stage → ${next}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Stage update failed');
    }
  };

  /** Quick action: mark a lead as needing follow-up + log the intent. */
  const markFollowUp = async (clientId: string, phone: string | null) => {
    try {
      await updateClient.mutateAsync({
        id: clientId,
        patch: { status: 'follow_up_required' },
      });
      await logOutreach.mutateAsync({
        client_id: clientId,
        staff_user_id: user?.id ?? null,
        template_id: null,
        template_category: 'follow_up_required',
        message_text: 'Marked for follow-up',
        phone_number: phone,
        status: 'follow_up_required',
      });
      toast.success('Marked for follow-up.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to mark follow-up');
    }
  };

  const outreachBadge = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-green-500/20 text-green-300';
      case 'clicked': return 'bg-yellow-500/20 text-yellow-300';
      case 'not_sent': return 'bg-destructive/20 text-destructive';
      case 'sent_manually': return 'bg-green-500/15 text-green-300';
      case 'prepared': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Filter by stage, choose an outreach template, and open a pre-filled WhatsApp chat.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setQuickLeadOpen(true)} className="glow-primary">
            <UserPlus className="w-4 h-4 mr-1.5" /> Quick Lead
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCsvOpen(true)}>
            <Upload className="w-4 h-4 mr-1.5" /> Import CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv} title="Download the filtered leads as CSV (Klaviyo / WhatsApp Business compatible)">
            <Download className="w-4 h-4 mr-1.5" /> Export CSV ({filtered.length})
          </Button>
          <Button variant="outline" size="sm" onClick={testWhatsApp} title="Opens a sample WhatsApp link to verify the integration">
            <MessageCircle className="w-4 h-4 mr-1.5" /> Test WhatsApp Link
          </Button>
        </div>
      </div>

      {/* Summary report */}
      <LeadsSummary clients={clients} latestLogByClient={latestLogByClient} />

      <CsvLeadImportModal
        open={csvOpen}
        onOpenChange={setCsvOpen}
        onImported={(r) => {
          if (r.created > 0 || r.updated > 0) {
            setCsvOnly(true);
            setStage('all');
            setSource('All');
            setOutreachFilter('not_contacted');
          }
        }}
      />

      {quickLeadOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          onClick={() => setQuickLeadOpen(false)}
        >
          <div
            className="glass-strong rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 className="text-xl font-display font-bold text-foreground">Quick Lead</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Outreach lead — credited to the house.
              </p>
            </div>
            <ClientCaptureForm
              mode="outreach"
              compact
              submitLabel="Save lead"
              onCreated={() => setQuickLeadOpen(false)}
              onCancel={() => setQuickLeadOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="glass rounded-xl p-5 space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Stage</p>
          <div className="flex flex-wrap gap-2">
            {STAGE_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setStage(f.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  stage === f.id ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Outreach</p>
          <div className="flex flex-wrap gap-2">
            {OUTREACH_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setOutreachFilter(f.id)}
                className={`px-3 py-1 rounded-full text-xs transition-all ${
                  outreachFilter === f.id ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Membership tier</p>
            <div className="flex flex-wrap gap-2">
              {TIER_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setTier(f.id)}
                  className={`px-3 py-1 rounded-full text-xs transition-all ${
                    tier === f.id ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Created</p>
            <div className="flex flex-wrap gap-2">
              {DATE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setDateRange(f.id)}
                  className={`px-3 py-1 rounded-full text-xs transition-all ${
                    dateRange === f.id ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Search</p>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Name, phone, email, code…"
                className="bg-surface border-border/60 pl-9"
              />
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Contact info</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setHasPhone((v) => !v)}
                className={`px-3 py-1 rounded-full text-xs transition-all ${
                  hasPhone ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground hover:text-foreground'
                }`}
                title="Only leads with a phone number on file"
              >
                Has phone
              </button>
              <button
                onClick={() => setHasEmail((v) => !v)}
                className={`px-3 py-1 rounded-full text-xs transition-all ${
                  hasEmail ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground hover:text-foreground'
                }`}
                title="Only leads with an email on file"
              >
                Has email
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Source</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setSource('All'); setCsvOnly(false); setCalendlyOnly(false); setOutreachIdFilter(null); }}
                className={`px-3 py-1 rounded-full text-xs transition-all ${source === 'All' && !csvOnly && !calendlyOnly && !outreachIdFilter ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground hover:text-foreground'}`}
              >
                All
              </button>
              <button
                onClick={() => { setCsvOnly((v) => !v); setCalendlyOnly(false); setSource('All'); setOutreachIdFilter(null); }}
                className={`px-3 py-1 rounded-full text-xs transition-all ${csvOnly ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground hover:text-foreground'}`}
                title="Show only leads imported from CSV"
              >
                CSV Import
              </button>
              <button
                onClick={() => { setCalendlyOnly((v) => !v); setCsvOnly(false); setSource('All'); setOutreachIdFilter(null); }}
                className={`px-3 py-1 rounded-full text-xs transition-all ${calendlyOnly ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground hover:text-foreground'}`}
                title="Show only leads booked via Calendly"
              >
                Calendly
              </button>
              {sourceOptions.map((s) => (
                <button
                  key={s}
                  onClick={() => { setSource(s); setCsvOnly(false); setCalendlyOnly(false); setOutreachIdFilter(null); }}
                  className={`px-3 py-1 rounded-full text-xs transition-all ${source === s ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground hover:text-foreground'}`}
                >
                  {s}
                </button>
              ))}
              {outreachIdFilter && (
                <button
                  onClick={() => setOutreachIdFilter(null)}
                  className="px-3 py-1 rounded-full text-xs bg-primary text-primary-foreground inline-flex items-center gap-1"
                  title="Clear outreach filter"
                >
                  {outreachNameById.get(outreachIdFilter) ?? 'Outreach'}
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Attributed Staff</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setStaffId('All')}
                className={`px-3 py-1 rounded-full text-xs transition-all ${staffId === 'All' ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground hover:text-foreground'}`}
              >
                All
              </button>
              {staff.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStaffId(s.id)}
                  className={`px-3 py-1 rounded-full text-xs transition-all ${staffId === s.id ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground hover:text-foreground'}`}
                >
                  {s.full_name || s.email}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Outreach composer */}
      {selectedClient && (
        <div className="glass rounded-xl p-5 space-y-4 border border-primary/30">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Outreach to</p>
              <p className="text-base font-display font-bold text-foreground">{selectedClient.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {selectedClient.phone ?? '— no phone on file'}
                {selectedAppt && ` · next: ${selectedAppt.date} ${selectedAppt.time} (${selectedAppt.treatment})`}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setSelectedClientId(null); setDraftMessage(''); setSelectedTemplateId(''); setPendingLog(null); }}>
              <X className="w-4 h-4 mr-1" /> Close
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Template</Label>
              <select
                value={selectedTemplateId}
                onChange={(e) => onPickTemplate(e.target.value)}
                className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground"
              >
                <option value="">— Choose template or write your own —</option>
                {templates.filter((t) => t.active).map((t) => (
                  <option key={t.id} value={t.id}>{t.title} ({t.category})</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">
                Variables: {'{client_name} {phone} {appointment_date} {appointment_time} {membership_type} {service_name} {staff_name}'}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Preview / Edit</Label>
              <Textarea
                value={draftMessage}
                onChange={(e) => setDraftMessage(e.target.value)}
                rows={5}
                placeholder="Pick a template or write a custom message…"
                className="bg-surface border-border/60 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={sendWhatsApp} disabled={!selectedClient.phone || logOutreach.isPending || !!pendingLog} className="glow-primary">
              <MessageCircle className="w-4 h-4 mr-1.5" />
              {logOutreach.isPending ? 'Opening…' : 'Send WhatsApp Message'}
            </Button>
            {!selectedClient.phone && (
              <span className="text-[11px] text-destructive">No phone number on file for this client.</span>
            )}
          </div>

          {/* Two-step confirmation — only after the WhatsApp button has been clicked. */}
          {pendingLog && (
            <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs">
                <p className="font-medium text-foreground">WhatsApp opened — did you actually send the message?</p>
                <p className="text-muted-foreground mt-0.5">
                  Click-to-chat can't confirm delivery. Confirm so the lead's outreach status stays accurate.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={confirmSent} disabled={updateOutreach.isPending}>
                  <Check className="w-4 h-4 mr-1.5" /> Mark as Sent
                </Button>
                <Button size="sm" variant="outline" onClick={confirmNotSent} disabled={updateOutreach.isPending}>
                  <XCircle className="w-4 h-4 mr-1.5" /> Not Sent
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[960px]">
          <thead>
            <tr className="border-b border-border/40">
              {['Lead', 'Pipeline', 'Stage', 'Source', 'Next / Last Contact', 'Outreach'].map((h) => (
                <th key={h} className="text-left text-[10px] text-muted-foreground font-medium uppercase tracking-wider px-5 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No leads match these filters.
                </td>
              </tr>
            )}
            {filtered.map((lead) => {
              const derived = deriveStage(lead);
              const next = nextApptByClient.get(lead.id);
              const lastContact = (lead as { last_contact_date?: string | null }).last_contact_date;
              const latestLog = latestLogByClient.get(lead.id);
              const leadStage = (lead as { pipeline_stage?: string | null }).pipeline_stage;
              const lastInteractionAt = (lead as { last_interaction_at?: string | null }).last_interaction_at;
              const stale = isStaleLead(leadStage, lastInteractionAt, lead.created_at);
              const hoursAgo = Math.round(hoursSinceTouch(lastInteractionAt, lead.created_at));
              return (
              <tr key={lead.id} className={`border-b border-border/20 hover:bg-surface/50 transition-colors ${selectedClientId === lead.id ? 'bg-primary/5' : ''}`}>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    {stale && (
                      <span
                        title={`Stale — no interaction for ${hoursAgo}h`}
                        className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-destructive shrink-0"
                      />
                    )}
                    <p className="text-sm font-medium text-foreground">{lead.full_name}</p>
                    {(lead as { intake_source?: string | null }).intake_source === 'social-media' && (
                      <span
                        title="Lead from social-media campaign intake"
                        className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider bg-fuchsia-500/15 text-fuchsia-600"
                      >
                        Social
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{lead.email ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">{lead.phone ?? '—'}</p>
                  {lead.location && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{lead.location}</p>
                  )}
                  {lastInteractionAt && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Last touch: {hoursAgo}h ago</p>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <PipelineStageSelect
                    value={((lead as { pipeline_stage?: PipelineStage }).pipeline_stage ?? 'new') as PipelineStage}
                    onChange={(next) => onChangePipelineStage(lead.id, next)}
                    disabled={updateClient.isPending}
                  />
                </td>
                <td className="px-5 py-3.5">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${stageColor(derived)}`}>
                    {stageLabel(derived)}
                  </span>
                  <select
                    value={lead.status}
                    onChange={(e) => onChangeStatus(lead.id, e.target.value as ClientStatus, lead.status)}
                    disabled={updateClient.isPending}
                    className="mt-1.5 h-7 w-full max-w-[170px] rounded-md bg-surface border border-border/60 px-2 text-[11px] text-foreground"
                    title="Change lead status"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </td>
                <td className="px-5 py-3.5 text-xs">
                  {(() => {
                    if (lead.outreach_id) {
                      const name = outreachNameById.get(lead.outreach_id) ?? 'Outreach';
                      const active = outreachIdFilter === lead.outreach_id;
                      return (
                        <button
                          onClick={() => {
                            setOutreachIdFilter(lead.outreach_id);
                            setSource('All');
                            setCsvOnly(false);
                            setCalendlyOnly(false);
                          }}
                          className={`px-2 py-0.5 rounded-full text-xs transition-all ${active ? 'bg-primary text-primary-foreground' : 'bg-surface text-foreground hover:bg-primary/10'}`}
                          title={`Filter leads from ${name}`}
                        >
                          {name}
                        </button>
                      );
                    }
                    if (!lead.source_type) return <span className="text-muted-foreground">—</span>;
                    const s = lead.source_type;
                    const active = source === s && !csvOnly && !calendlyOnly && !outreachIdFilter;
                    return (
                      <button
                        onClick={() => {
                          setSource(s);
                          setCsvOnly(false);
                          setCalendlyOnly(false);
                          setOutreachIdFilter(null);
                        }}
                        className={`px-2 py-0.5 rounded-full text-xs transition-all ${active ? 'bg-primary text-primary-foreground' : 'bg-surface text-foreground hover:bg-primary/10'}`}
                        title={`Filter leads from ${s}`}
                      >
                        {s}
                      </button>
                    );
                  })()}
                </td>
                <td className="px-5 py-3.5 text-xs">
                  {next ? (
                    <p className="text-foreground">{next.date} · {next.time}</p>
                  ) : (
                    <p className="text-muted-foreground">No upcoming</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {latestLog ? (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${outreachBadge(latestLog.status)}`}>
                        {latestLog.status}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">No outreach yet</span>
                    )}
                    {lastContact && (
                      <span className="text-[10px] text-muted-foreground">
                        · {new Date(lastContact).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3.5 text-xs">
                  <div className="flex flex-col gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => quickWhatsAppSend(lead)}
                      disabled={!lead.phone || updateClient.isPending || logOutreach.isPending}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white"
                      title="Open WhatsApp with the standard intro message"
                    >
                      <MessageCircle className="w-3.5 h-3.5 mr-1" /> WhatsApp
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => markFollowUp(lead.id, lead.phone)} disabled={updateClient.isPending || logOutreach.isPending} title="Mark this lead for follow-up">
                      <Clock className="w-3.5 h-3.5 mr-1" /> Follow-up
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setInteractionTarget({ id: lead.id, name: lead.full_name })}
                      title="Log a phone call, in-person chat, or other interaction"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5 mr-1" /> Log
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDeleteId({ id: lead.id, name: lead.full_name })}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Delete this lead permanently"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                    </Button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Outreach templates manager */}
      <div className="glass rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-display font-bold text-foreground">Outreach Templates</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Reusable WhatsApp message templates with variable placeholders.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowTemplates((v) => !v)}>
            {showTemplates ? 'Hide' : 'Manage'}
          </Button>
        </div>
        {showTemplates && (
          <TemplateManager
            templates={templates}
            onCreate={(input) => createTemplate.mutateAsync(input).then(() => toast.success('Template added')).catch((e) => toast.error(e.message))}
            onUpdate={(id, patch) => updateTemplate.mutateAsync({ id, patch }).then(() => toast.success('Template updated')).catch((e) => toast.error(e.message))}
            onDelete={(id) => deleteTemplate.mutateAsync(id).then(() => toast.success('Template removed')).catch((e) => toast.error(e.message))}
          />
        )}
      </div>

      {interactionTarget && user?.id && (
        <LogInteractionModal
          open={!!interactionTarget}
          onOpenChange={(v) => { if (!v) setInteractionTarget(null); }}
          clientId={interactionTarget.id}
          clientName={interactionTarget.name}
          staffUserId={user.id}
        />
      )}

      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          onClick={() => !deleteClient.isPending && setConfirmDeleteId(null)}
        >
          <div
            className="glass rounded-xl p-6 max-w-md w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-display font-bold text-foreground">Delete lead?</h3>
            <p className="text-sm text-muted-foreground">
              This will permanently remove <span className="text-foreground font-medium">{confirmDeleteId.name}</span> and any related records. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setConfirmDeleteId(null)} disabled={deleteClient.isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteClient.isPending}
                onClick={async () => {
                  try {
                    await deleteClient.mutateAsync(confirmDeleteId.id);
                    toast.success(`Deleted ${confirmDeleteId.name}.`);
                    setConfirmDeleteId(null);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Delete failed');
                  }
                }}
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                {deleteClient.isPending ? 'Deleting…' : 'Delete permanently'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface TemplateManagerProps {
  templates: OutreachTemplate[];
  onCreate: (input: { category: string; title: string; body: string }) => Promise<unknown>;
  onUpdate: (id: string, patch: Partial<OutreachTemplate>) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}

const TemplateManager = ({ templates, onCreate, onUpdate, onDelete }: TemplateManagerProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ category: 'new_lead', title: '', body: '' });
  const [adding, setAdding] = useState(false);

  const startEdit = (t: OutreachTemplate) => {
    setEditingId(t.id);
    setDraft({ category: t.category, title: t.title, body: t.body });
    setAdding(false);
  };

  const reset = () => {
    setEditingId(null);
    setAdding(false);
    setDraft({ category: 'new_lead', title: '', body: '' });
  };

  const save = async () => {
    if (!draft.title.trim() || !draft.body.trim()) return;
    if (editingId) {
      await onUpdate(editingId, draft);
    } else {
      await onCreate(draft);
    }
    reset();
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        {templates.map((t) => (
          <div key={t.id} className="rounded-lg border border-border/40 bg-card/40 p-3">
            {editingId === t.id ? (
              <TemplateForm draft={draft} setDraft={setDraft} onSave={save} onCancel={reset} />
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{t.title}</p>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary">{t.category}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{t.body}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(t)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => onDelete(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding ? (
        <div className="rounded-lg border border-primary/30 bg-card/40 p-3">
          <TemplateForm draft={draft} setDraft={setDraft} onSave={save} onCancel={reset} />
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => { setAdding(true); setEditingId(null); setDraft({ category: 'new_lead', title: '', body: '' }); }}>
          <Plus className="w-4 h-4 mr-1.5" /> Add Template
        </Button>
      )}
    </div>
  );
};

interface TemplateFormProps {
  draft: { category: string; title: string; body: string };
  setDraft: (d: { category: string; title: string; body: string }) => void;
  onSave: () => void;
  onCancel: () => void;
}

const TemplateForm = ({ draft, setDraft, onSave, onCancel }: TemplateFormProps) => (
  <div className="space-y-3">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Category</Label>
        <select
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground mt-1"
        >
          {TEMPLATE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
      <div>
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Title</Label>
        <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="mt-1 bg-surface border-border/60" />
      </div>
    </div>
    <div>
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Body (use {'{client_name}'} etc.)</Label>
      <Textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={4} className="mt-1 bg-surface border-border/60" />
    </div>
    <div className="flex gap-2">
      <Button size="sm" onClick={onSave}><Save className="w-4 h-4 mr-1.5" /> Save</Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
    </div>
  </div>
);

export default AdminLeads;

/** Top-of-page report cards: total / new / contacted / follow-up / converted. */
const LeadsSummary = ({
  clients,
  latestLogByClient,
}: {
  clients: ReturnType<typeof useRealClients>['data'];
  latestLogByClient: Map<string, OutreachLog>;
}) => {
  const rows = clients ?? [];
  const total = rows.length;
  const isNew = (s: string) => s === 'new_lead' || s === 'lead';
  const newLeads = rows.filter((c) => isNew(c.status)).length;
  const contactedStatuses = new Set([
    'contacted', 'consultation_booked', 'scheduled', 'payment_pending',
  ]);
  const contacted = rows.filter(
    (c) => contactedStatuses.has(c.status) || latestLogByClient.has(c.id),
  ).length;
  const followUp = rows.filter(
    (c) => c.status === 'follow_up_required' || c.status === 'not_reached',
  ).length;
  const converted = rows.filter(
    (c) => c.status === 'converted' || c.status === 'member' || c.status === 'elite',
  ).length;

  const cards = [
    { label: 'Total leads', value: total, tone: 'text-foreground' },
    { label: 'New', value: newLeads, tone: 'text-primary' },
    { label: 'Contacted', value: contacted, tone: 'text-emerald-400' },
    { label: 'Needs follow-up', value: followUp, tone: 'text-amber-400' },
    { label: 'Converted', value: converted, tone: 'text-accent' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="glass rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.label}</p>
          <p className={`mt-1 text-2xl font-display font-bold ${c.tone}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
};
