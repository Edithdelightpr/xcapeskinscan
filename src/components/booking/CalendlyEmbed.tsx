import { InlineWidget } from 'react-calendly';
import { buildCalendlyUrl } from '@/lib/calendlyConfig';

interface CalendlyEmbedProps {
  /** Base Calendly scheduling URL (e.g. https://calendly.com/handle/event). */
  url: string;
  /** Optional staff id to attribute the booking to (added as utm_content). */
  attributedStaffId?: string | null;
  /** Optional prefill for the Calendly form. */
  prefill?: {
    name?: string;
    email?: string;
    customAnswers?: Record<string, string>;
  };
}

/**
 * Tropics-themed wrapper around Calendly's official inline widget.
 * The actual booking is recorded by Calendly + an n8n webhook → Supabase.
 */
const CalendlyEmbed = ({ url, attributedStaffId, prefill }: CalendlyEmbedProps) => {
  const finalUrl = buildCalendlyUrl(url, attributedStaffId);

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-border/40 glass">
      <InlineWidget
        url={finalUrl}
        styles={{ height: '760px', width: '100%' }}
        prefill={prefill}
        pageSettings={{
          backgroundColor: '1a0b2e',
          primaryColor: '9b59b6',
          textColor: 'ffffff',
          hideEventTypeDetails: false,
          hideLandingPageDetails: false,
          hideGdprBanner: true,
        }}
      />
    </div>
  );
};

export default CalendlyEmbed;