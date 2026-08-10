import { Link } from 'react-router-dom';
import { Phone, ExternalLink, Pencil, Clock, User } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import type { RealAppointment } from '@/hooks/useRealAppointments';
import { type RealClient } from '@/hooks/useRealClients';
import { type RealStaff } from '@/hooks/useRealStaff';
import {
  STATUS_PILL,
  STATUS_LABEL,
  statusOf,
} from '@/lib/appointmentStatus';
import {
  getAppointmentSource,
  SOURCE_BADGE,
  isConsultation,
} from '@/lib/appointmentMeta';
import PaymentStatusChip from '@/components/admin/PaymentStatusChip';
import { visitStageChipClass, visitStageLabel, type VisitStage } from '@/lib/visitStage';

interface Props {
  apt: RealAppointment;
  client?: RealClient;
  practitioner?: RealStaff;
  visitStage?: VisitStage | null;
  onEdit: (apt: RealAppointment) => void;
  children: React.ReactNode;
}

/**
 * Wraps any calendar chip with a hover-card preview that surfaces the full
 * appointment context without forcing the admin to open the edit modal first.
 * Practitioner is shown — this card is admin-only, never rendered for clients.
 */
const AppointmentPreviewCard = ({ apt, client, practitioner, visitStage, onEdit, children }: Props) => {
  const status = statusOf(apt);
  const source = getAppointmentSource(apt);
  const srcStyle = SOURCE_BADGE[source];
  const consult = isConsultation(apt);

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-72 space-y-2.5" align="start">
        {consult && (
          <p className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold">
            Free consultation
          </p>
        )}
        <div className="space-y-0.5">
          <p className="font-semibold text-sm text-foreground truncate">
            {client?.full_name ?? 'Unknown client'}
          </p>
          {client?.phone && (
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Phone className="w-3 h-3" /> {client.phone}
            </p>
          )}
        </div>

        <p className="text-xs text-foreground">{apt.treatment}</p>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span className="font-mono">
            {apt.date} · {apt.time?.slice(0, 5)}
            {apt.duration_minutes ? ` · ${apt.duration_minutes}m` : ''}
          </span>
        </div>

        {practitioner && (
          <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1" title="Internal only — never shown to clients">
            <User className="w-3 h-3" /> With {practitioner.full_name || practitioner.email}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${STATUS_PILL[status]}`}>
            {STATUS_LABEL[status]}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${srcStyle.cls}`}>
            {srcStyle.label}
          </span>
          {visitStage && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${visitStageChipClass(visitStage)}`}>
              {visitStageLabel(visitStage)}
            </span>
          )}
        </div>

        <PaymentStatusChip status={(apt as { payment_status?: string }).payment_status} />

        <div className="flex gap-2 pt-1 border-t border-border/40">
          <button
            onClick={() => onEdit(apt)}
            className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/15 hover:bg-primary/25 text-primary transition-colors"
          >
            <Pencil className="w-3 h-3" /> Edit
          </button>
          {client?.id && (
            <Link
              to={`/admin/clients/${client.id}`}
              className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface hover:bg-surface-hover text-foreground transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Open profile
            </Link>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default AppointmentPreviewCard;