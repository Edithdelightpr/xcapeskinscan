import { ArrowRight } from 'lucide-react';
import { logReportEvent } from '@/hooks/useReportPayload';

const ExploreMoreStrip = ({ token, linkPrefix }: { token: string; linkPrefix: string }) => {
  const href = `/treatments?ref=report&link=${encodeURIComponent(linkPrefix)}`;
  return (
    <a
      href={href}
      onClick={() => logReportEvent(token, 'explore_treatments')}
      className="group flex items-center justify-between rounded-2xl border border-bronze/20 bg-white/70 backdrop-blur px-5 py-4 hover:bg-white transition"
    >
      <div>
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-bronze font-semibold">Explore more</div>
        <div className="font-display text-[15px] text-cocoa">See the full treatment menu</div>
      </div>
      <ArrowRight className="w-5 h-5 text-cocoa/70 group-hover:translate-x-0.5 transition-transform" strokeWidth={1.6} />
    </a>
  );
};

export default ExploreMoreStrip;