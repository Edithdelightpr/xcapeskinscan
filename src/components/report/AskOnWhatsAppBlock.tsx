import { CalendarHeart, MessageCircle } from 'lucide-react';
import { BRAND, whatsAppLink } from '@/lib/brand';
import { logReportEvent } from '@/hooks/useReportPayload';

interface Props {
  token: string;
  firstName: string | null;
  linkPrefix?: string;
}

const AskOnWhatsAppBlock = ({ token, firstName, linkPrefix }: Props) => {
  const greeting = firstName
    ? `Hi ${BRAND.name}! I just read my Personal Report — ${firstName} here. I have a question:`
    : `Hi ${BRAND.name}! I just read my Personal Report and I have a question:`;
  const waHref = whatsAppLink(greeting);

  const bookParams = new URLSearchParams({ ref: 'report', report_token: token });
  if (linkPrefix) bookParams.set('link', linkPrefix);
  const bookHref = `/book-appointment?${bookParams.toString()}`;

  return (
    <section className="rounded-3xl border border-bronze/20 bg-gradient-to-br from-cream-warm/70 to-white/60 backdrop-blur p-8 sm:p-10 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-bronze/15 text-bronze flex items-center justify-center">
        <MessageCircle className="w-5 h-5" strokeWidth={1.6} />
      </div>
      <h3 className="mt-4 font-display text-2xl sm:text-[26px] text-cocoa tracking-tight">
        Need help understanding your report?
      </h3>
      <p className="mt-3 text-[14px] text-cocoa/70 max-w-lg mx-auto leading-relaxed">
        Your practitioner is one message away. Ask any question, or book a consultation to walk through
        your results together.
      </p>
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
        <a
          href={waHref}
          target="_blank"
          rel="noreferrer noopener"
          onClick={() => logReportEvent(token, 'question_clicked')}
          className="inline-flex items-center gap-2 rounded-full bg-cocoa text-white text-[13px] font-medium px-5 py-2.5 hover:bg-cocoa/90 transition shadow-sm"
        >
          <MessageCircle className="w-4 h-4" strokeWidth={1.8} />
          Chat with your practitioner
        </a>
        <a
          href={bookHref}
          onClick={() => logReportEvent(token, 'consult_clicked')}
          className="inline-flex items-center gap-2 rounded-full border border-cocoa/25 bg-white/70 text-cocoa text-[13px] font-medium px-5 py-2.5 hover:bg-white transition"
        >
          <CalendarHeart className="w-4 h-4" strokeWidth={1.8} />
          Book consultation
        </a>
      </div>
    </section>
  );
};

export default AskOnWhatsAppBlock;