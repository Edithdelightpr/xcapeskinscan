import jsPDF from 'jspdf';
import logo from '@/assets/tropics-logo.jpeg';

const C_PURPLE: [number, number, number] = [56, 24, 92];
const C_GOLD: [number, number, number] = [201, 162, 89];
const C_INK: [number, number, number] = [38, 22, 60];
const C_MUTED: [number, number, number] = [120, 110, 140];
const C_LINE: [number, number, number] = [220, 215, 230];

const naira = (n: number) => `NGN ${n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export interface ReceiptLineItem {
  name: string;
  qty: number;
  unit_price: number;
  kind: 'service' | 'product';
}

export interface ReceiptOpts {
  receiptNo: string;
  clientName: string;
  practitioner?: string | null;
  signedOutBy?: string | null;
  visitDate: Date;
  signInTime?: string | null;
  signOutTime: Date;
  items: ReceiptLineItem[];
  amountPaid: number;
  paymentState: 'paid' | 'pending' | 'waived';
  notes?: string | null;
  /** Optional assessment summary rendered above the notes block. */
  assessmentSummary?: {
    mainConcern?: string | null;
    practitionerObservation?: string | null;
    homeCare?: string | null;
    recommendation?: string | null;
  } | null;
  /**
   * Optional accepted-treatment-plan summary. When provided, the receipt
   * shows catalogue vs agreed value and total savings so the client has a
   * printable record of the discount they were given.
   */
  planSummary?: {
    lines: {
      name: string;
      sessions: number;
      catalogueUnit: number;
      agreedUnit: number;
      catalogueTotal: number;
      agreedTotal: number;
      savings: number;
      discountReason?: string | null;
    }[];
    catalogueTotal: number;
    agreedTotal: number;
    savings: number;
  } | null;
  /**
   * Optional promo / manual discount summary rendered under the totals box.
   */
  discountSummary?: {
    servicesSubtotal: number;
    productsSubtotal: number;
    grossSubtotal: number;
    planCredit: number;
    promoCode?: string | null;
    promoStaffName?: string | null;
    promoPct?: number | null;
    promoAmount?: number | null;
    manualType?: 'percentage' | 'fixed' | null;
    manualValue?: number | null;
    manualAmount?: number | null;
    manualReason?: string | null;
    finalTotal: number;
  } | null;
}

export function generateReceiptPdf(opts: ReceiptOpts): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  // Header band
  doc.setFillColor(...C_PURPLE);
  doc.rect(0, 0, pageW, 90, 'F');
  try {
    doc.addImage(logo, 'JPEG', margin, 18, 54, 54);
  } catch { /* ignore */ }
  doc.setTextColor(...C_GOLD);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Tropics MedSpa', margin + 70, 44);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Official Visit Receipt', margin + 70, 62);

  doc.setFontSize(9);
  doc.text(`Receipt #: ${opts.receiptNo}`, pageW - margin, 36, { align: 'right' });
  doc.text(opts.visitDate.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }),
    pageW - margin, 52, { align: 'right' });
  doc.text(opts.signOutTime.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }),
    pageW - margin, 66, { align: 'right' });

  y = 120;

  // Client / visit block
  doc.setTextColor(...C_INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Client', margin, y);
  doc.text('Visit', pageW / 2, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  y += 14;
  doc.text(opts.clientName, margin, y);
  const visitMeta: string[] = [];
  if (opts.practitioner) visitMeta.push(`Practitioner: ${opts.practitioner}`);
  if (opts.signedOutBy) visitMeta.push(`Signed out by: ${opts.signedOutBy}`);
  if (opts.signInTime) visitMeta.push(`Signed in: ${opts.signInTime}`);
  let vy = y;
  visitMeta.forEach((line) => {
    doc.text(line, pageW / 2, vy);
    vy += 12;
  });

  y = Math.max(y + 10, vy + 6);

  // Divider
  doc.setDrawColor(...C_LINE);
  doc.line(margin, y, pageW - margin, y);
  y += 18;

  // Items table header
  doc.setFillColor(...C_PURPLE);
  doc.rect(margin, y - 12, pageW - margin * 2, 22, 'F');
  doc.setTextColor(...C_GOLD);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Item', margin + 8, y + 3);
  doc.text('Type', margin + 260, y + 3);
  doc.text('Qty', margin + 340, y + 3, { align: 'right' });
  doc.text('Unit', margin + 420, y + 3, { align: 'right' });
  doc.text('Total', pageW - margin - 8, y + 3, { align: 'right' });
  y += 22;

  doc.setTextColor(...C_INK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  let subtotal = 0;
  if (opts.items.length === 0) {
    doc.setTextColor(...C_MUTED);
    doc.text('No items recorded', margin + 8, y + 4);
    y += 18;
    doc.setTextColor(...C_INK);
  } else {
    opts.items.forEach((it, idx) => {
      const total = it.qty * it.unit_price;
      subtotal += total;
      if (idx % 2 === 0) {
        doc.setFillColor(248, 246, 252);
        doc.rect(margin, y - 10, pageW - margin * 2, 20, 'F');
      }
      const nameLines = doc.splitTextToSize(it.name, 240);
      doc.text(nameLines[0] ?? it.name, margin + 8, y + 3);
      doc.setTextColor(...C_MUTED);
      doc.text(it.kind === 'service' ? 'Service' : 'Product', margin + 260, y + 3);
      doc.setTextColor(...C_INK);
      doc.text(String(it.qty), margin + 340, y + 3, { align: 'right' });
      doc.text(naira(it.unit_price), margin + 420, y + 3, { align: 'right' });
      doc.text(naira(total), pageW - margin - 8, y + 3, { align: 'right' });
      y += 20;
    });
  }

  y += 8;
  doc.setDrawColor(...C_LINE);
  doc.line(margin, y, pageW - margin, y);
  y += 16;

  // Totals box
  const boxX = pageW - margin - 220;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...C_MUTED);
  doc.text('Subtotal', boxX, y);
  doc.setTextColor(...C_INK);
  doc.text(naira(subtotal), pageW - margin, y, { align: 'right' });
  y += 16;

  doc.setTextColor(...C_MUTED);
  doc.text('Payment status', boxX, y);
  doc.setTextColor(...C_INK);
  doc.text(opts.paymentState.toUpperCase(), pageW - margin, y, { align: 'right' });
  y += 16;

  doc.setDrawColor(...C_GOLD);
  doc.setLineWidth(1);
  doc.line(boxX, y, pageW - margin, y);
  y += 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...C_PURPLE);
  doc.text('Amount paid', boxX, y);
  doc.text(naira(opts.amountPaid), pageW - margin, y, { align: 'right' });
  y += 24;

  // Discount summary (promo + manual)
  const d = opts.discountSummary;
  if (d && (d.promoAmount || d.manualAmount || d.planCredit)) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C_INK);
    doc.text('Discount breakdown', margin, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const row = (label: string, value: string, gold = false) => {
      doc.setTextColor(...(gold ? C_GOLD : C_MUTED));
      doc.text(label, margin, y);
      doc.setTextColor(...C_INK);
      doc.text(value, pageW - margin, y, { align: 'right' });
      y += 12;
    };
    row('Services subtotal', naira(d.servicesSubtotal));
    row('Products subtotal', naira(d.productsSubtotal));
    row('Gross subtotal', naira(d.grossSubtotal));
    if (d.planCredit > 0) row('Treatment plan credit', `− ${naira(d.planCredit)}`, true);
    if (d.promoAmount && d.promoAmount > 0) {
      const label = `Promo ${d.promoCode ?? ''}${d.promoStaffName ? ` · ${d.promoStaffName}` : ''} (${d.promoPct ?? 0}%)`;
      row(label.trim(), `− ${naira(d.promoAmount)}`, true);
    }
    if (d.manualAmount && d.manualAmount > 0) {
      const mlabel = `Manual discount${d.manualType === 'percentage' ? ` (${d.manualValue}%)` : ''}${d.manualReason ? ` · ${d.manualReason}` : ''}`;
      row(mlabel, `− ${naira(d.manualAmount)}`, true);
    }
    doc.setDrawColor(...C_GOLD);
    doc.line(margin, y, pageW - margin, y);
    y += 12;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C_PURPLE);
    doc.text('Final total', margin, y);
    doc.text(naira(d.finalTotal), pageW - margin, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 20;
  }

  // Accepted plan value box — catalogue vs agreed vs savings.
  const plan = opts.planSummary;
  if (plan && plan.lines.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C_INK);
    doc.text('Accepted treatment plan', margin, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C_MUTED);
    plan.lines.forEach((l) => {
      const label = `${l.name} × ${l.sessions}`;
      doc.setTextColor(...C_INK);
      doc.text(doc.splitTextToSize(label, 260)[0] ?? label, margin, y);
      doc.setTextColor(...C_MUTED);
      doc.text(naira(l.catalogueTotal), margin + 320, y, { align: 'right' });
      doc.setTextColor(...C_INK);
      doc.text(naira(l.agreedTotal), pageW - margin, y, { align: 'right' });
      y += 12;
      if (l.discountReason || l.savings > 0) {
        doc.setTextColor(...C_MUTED);
        const parts: string[] = [];
        if (l.savings > 0) parts.push(`Saved ${naira(l.savings)}`);
        if (l.discountReason) parts.push(l.discountReason);
        doc.text(parts.join(' · '), margin + 8, y);
        y += 12;
      }
    });
    doc.setDrawColor(...C_LINE);
    doc.line(margin, y, pageW - margin, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C_MUTED);
    doc.text('Catalogue value', margin, y);
    doc.setTextColor(...C_INK);
    doc.text(naira(plan.catalogueTotal), pageW - margin, y, { align: 'right' });
    y += 12;
    if (plan.savings > 0) {
      doc.setTextColor(...C_GOLD);
      doc.text('Total savings', margin, y);
      doc.text(`− ${naira(plan.savings)}`, pageW - margin, y, { align: 'right' });
      y += 12;
    }
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C_PURPLE);
    doc.text('Agreed value', margin, y);
    doc.text(naira(plan.agreedTotal), pageW - margin, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 20;
  }

  // Assessment block — only when we have any content to show.
  const a = opts.assessmentSummary;
  const assessLines: [string, string][] = [];
  if (a?.mainConcern) assessLines.push(['Main concern', a.mainConcern]);
  if (a?.practitionerObservation) assessLines.push(['Practitioner notes', a.practitionerObservation]);
  if (a?.recommendation) assessLines.push(['Recommendation', a.recommendation]);
  if (a?.homeCare) assessLines.push(['Home care', a.homeCare]);
  if (assessLines.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C_INK);
    doc.text('Assessment summary', margin, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    assessLines.forEach(([label, value]) => {
      doc.setTextColor(...C_MUTED);
      doc.text(label, margin, y);
      doc.setTextColor(...C_INK);
      const lines = doc.splitTextToSize(value, pageW - margin * 2 - 110);
      doc.text(lines, margin + 110, y);
      y += Math.max(12, lines.length * 12) + 2;
    });
    y += 6;
  }

  if (opts.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C_INK);
    doc.text('Notes', margin, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C_MUTED);
    const lines = doc.splitTextToSize(opts.notes, pageW - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 12 + 6;
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 50;
  doc.setDrawColor(...C_LINE);
  doc.line(margin, footerY, pageW - margin, footerY);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...C_MUTED);
  doc.text('Thank you for visiting Tropics MedSpa.', margin, footerY + 16);
  doc.text('This receipt was generated electronically and is valid without a signature.',
    margin, footerY + 30);

  return doc;
}

export function openReceiptForPrint(opts: ReceiptOpts) {
  const doc = generateReceiptPdf(opts);
  const blobUrl = doc.output('bloburl');
  const w = window.open(blobUrl, '_blank');
  if (w) {
    w.addEventListener('load', () => {
      try { w.focus(); w.print(); } catch { /* ignore */ }
    });
  }
  // Also offer save
  doc.save(`receipt-${opts.receiptNo}.pdf`);
}