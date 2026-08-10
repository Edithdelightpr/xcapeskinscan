import { Download } from 'lucide-react';
import { whatsAppLink } from '@/lib/brand';

interface Props {
  /** Pre-formatted greeting from the shared report formatter (e.g. "Welcome, Ada"). */
  greeting: string;
  assessmentDate: string;
  practitionerName?: string | null;
  nextVisitInWeeks?: number | null;
  onDownloadPdf?: () => void;
  downloadDisabled?: boolean;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

const MetaCell = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <div className="text-[10px] uppercase tracking-[0.22em] text-cocoa/50 font-semibold">{label}</div>
    <div className="mt-1 text-[13.5px] text-cocoa font-medium truncate">{value}</div>
  </div>
);

const ReportHeader = ({
  greeting,
  assessmentDate,
  practitionerName,
  nextVisitInWeeks,
  onDownloadPdf,
  downloadDisabled,
}: Props) => {
  const cells: Array<{ label: string; value: string }> = [
    { label: 'Assessment completed', value: formatDate(assessmentDate) },
  ];
  if (practitionerName?.trim()) cells.push({ label: 'Practitioner', value: practitionerName.trim() });
  if (nextVisitInWeeks && nextVisitInWeeks > 0) {
    cells.push({
      label: 'Next review',
      value: `In ${nextVisitInWeeks} week${nextVisitInWeeks === 1 ? '' : 's'}`,
    });
  }

  return (
    <header className="relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(120% 80% at 15% 0%, hsl(28 65% 88% / 0.55), transparent 60%),' +
            'radial-gradient(120% 80% at 100% 100%, hsl(290 30% 90% / 0.5), transparent 60%),' +
            'linear-gradient(180deg, hsl(30 40% 97%) 0%, hsl(28 35% 94%) 100%)',
        }}
      />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-8 sm:pb-14">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={tropicsLogo} alt={BRAND.name} className="h-11 w-11 rounded-lg object-cover ring-1 ring-bronze/30" />
            <div className="leading-tight">
              <div className="text-[10.5px] uppercase tracking-[0.22em] text-bronze font-semibold">Personal Report</div>
              <div className="font-display text-[15px] text-cocoa font-semibold">{BRAND.name}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={downloadDisabled}
            className="inline-flex items-center gap-2 rounded-full border border-bronze/40 bg-white/70 backdrop-blur px-4 py-2 text-[13px] font-medium text-cocoa hover:bg-white hover:shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
            title={downloadDisabled ? 'Preparing your PDF…' : 'Download your Personal Report'}
          >
            <Download className="w-4 h-4" strokeWidth={1.6} />
            Download PDF
          </button>
        </div>

        <div className="mt-6 sm:mt-14 max-w-3xl">
          <div className="text-[10.5px] uppercase tracking-[0.24em] text-bronze font-semibold">
            Your Personal Skin Journey
          </div>
          <h1 className="mt-2 sm:mt-3 font-display text-[28px] sm:text-[46px] md:text-[54px] text-cocoa leading-[1.1] sm:leading-[1.05] tracking-tight">
            {greeting}
          </h1>
        </div>

        <div className="mt-6 sm:mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-10 border-t border-bronze/20 pt-4 sm:pt-6">
          {cells.map((c) => (
            <MetaCell key={c.label} {...c} />
          ))}
        </div>
      </div>
    </header>
  );
};

export default ReportHeader;