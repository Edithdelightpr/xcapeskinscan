import jsPDF from 'jspdf';
import logo from '@/assets/tropics-logo.jpeg';

/**
 * Lightweight client-portal PDF — renders ONLY data the manage-booking
 * portal already exposes (client subset, appointments, journey, spend).
 * Does not touch storage / private media; the client downloads it directly
 * without a round-trip to the server.
 */

const C_PURPLE: [number, number, number] = [56, 24, 92];
const C_GOLD: [number, number, number] = [201, 162, 89];
const C_INK: [number, number, number] = [38, 22, 60];
const C_MUTED: [number, number, number] = [120, 110, 140];
const C_LINE: [number, number, number] = [220, 215, 230];

const formatNaira = (n: number) => `NGN ${n.toLocaleString()}`;
const formatDate = (iso: string) => {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('en-NG', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
};
const formatTime = (hhmm: string) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

const fileToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });

export interface PortalReportClient {
  full_name?: string | null;
  client_code?: string | null;
  phone?: string | null;
  email?: string | null;
  location?: string | null;
  membership_type?: string | null;
  status?: string | null;
}
export interface PortalReportAppt {
  date: string;
  time: string;
  treatment: string;
  status: string;
}
export interface PortalReportJourney {
  status: string;
  note?: string | null;
  occurred_at: string;
}
export interface PortalReportSpend {
  membership_type?: string | null;
  spend_this_month?: number | null;
  threshold?: number | null;
  remaining_to_threshold?: number | null;
}

export interface GeneratePortalReportInput {
  client: PortalReportClient;
  appointments: PortalReportAppt[];
  journey: PortalReportJourney[];
  spend: PortalReportSpend | null;
}

export async function generateClientPortalReport(
  input: GeneratePortalReportInput,
): Promise<Blob> {
  const { client, appointments, journey, spend } = input;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  // ---- Header
  try {
    const logoData = await fetch(logo).then((r) => r.blob()).then(fileToDataUrl);
    doc.addImage(logoData, 'JPEG', margin, y, 48, 48);
  } catch { /* logo optional */ }

  doc.setTextColor(...C_PURPLE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('TROPICS MEDSPA', margin + 60, y + 20);

  doc.setTextColor(...C_GOLD);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Your Personal Record', margin + 60, y + 38);

  y += 64;
  doc.setDrawColor(...C_GOLD);
  doc.setLineWidth(1);
  doc.line(margin, y, pageW - margin, y);
  y += 18;

  const ensureRoom = (h: number) => {
    if (y + h > pageH - margin) { doc.addPage(); y = margin; }
  };
  const sectionTitle = (label: string) => {
    ensureRoom(28);
    doc.setTextColor(...C_PURPLE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(label.toUpperCase(), margin, y);
    y += 6;
    doc.setDrawColor(...C_LINE);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 14;
  };
  const kvRow = (k: string, v: string) => {
    ensureRoom(16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...C_MUTED);
    doc.text(k, margin, y);
    doc.setTextColor(...C_INK);
    doc.setFont('helvetica', 'bold');
    doc.text(v, margin + 130, y);
    y += 16;
  };

  // ---- Client
  sectionTitle('Your details');
  kvRow('Name', client.full_name || '—');
  if (client.client_code) kvRow('Client code', client.client_code);
  if (client.phone) kvRow('Phone', client.phone);
  if (client.email) kvRow('Email', client.email);
  if (client.location) kvRow('Location', client.location);
  if (client.membership_type) kvRow('Membership', client.membership_type);
  y += 6;

  // ---- Membership / spend
  if (spend) {
    sectionTitle('Membership progress');
    if (spend.membership_type) kvRow('Tier', spend.membership_type);
    if (typeof spend.spend_this_month === 'number') {
      kvRow('Spend this month', formatNaira(spend.spend_this_month));
    }
    if (typeof spend.threshold === 'number' && spend.threshold > 0) {
      kvRow('Tier threshold', formatNaira(spend.threshold));
    }
    if (typeof spend.remaining_to_threshold === 'number') {
      const r = spend.remaining_to_threshold;
      kvRow('Remaining to next tier', r > 0 ? formatNaira(r) : 'Reached');
    }
    y += 6;
  }

  // ---- Appointments
  if (appointments.length > 0) {
    sectionTitle('Appointments');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    appointments.slice(0, 30).forEach((a) => {
      ensureRoom(16);
      doc.setTextColor(...C_INK);
      doc.text(`${formatDate(a.date)} · ${formatTime(a.time)}`, margin, y);
      doc.setTextColor(...C_MUTED);
      doc.text(a.treatment ?? '—', margin + 180, y);
      doc.setTextColor(...C_GOLD);
      doc.text(a.status, pageW - margin, y, { align: 'right' });
      y += 14;
    });
    y += 6;
  }

  // ---- Journey
  if (journey.length > 0) {
    sectionTitle('Activity timeline');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    journey.slice(0, 30).forEach((j) => {
      ensureRoom(16);
      const when = new Date(j.occurred_at).toLocaleString('en-NG', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
      });
      doc.setTextColor(...C_MUTED);
      doc.text(when, margin, y);
      doc.setTextColor(...C_INK);
      doc.setFont('helvetica', 'bold');
      doc.text(j.status, margin + 150, y);
      doc.setFont('helvetica', 'normal');
      if (j.note) {
        const note = j.note.length > 70 ? `${j.note.slice(0, 67)}…` : j.note;
        doc.setTextColor(...C_MUTED);
        doc.text(note, margin + 240, y);
      }
      y += 14;
    });
  }

  // ---- Footer
  const reportId = `TM-PORTAL-${Date.now().toString(36).toUpperCase()}`;
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(...C_MUTED);
    doc.text(
      `Report ${reportId}  ·  Generated ${new Date().toLocaleString()}`,
      margin, pageH - 18,
    );
    doc.text(`Page ${p} / ${pageCount}`, pageW - margin, pageH - 18, { align: 'right' });
  }

  return doc.output('blob');
}