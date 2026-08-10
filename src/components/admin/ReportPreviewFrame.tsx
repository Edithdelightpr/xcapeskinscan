// Embedded staff preview of a client's Personal Report. Uses an iframe
// pointing at the staff-preview route so responsive Tailwind breakpoints
// respond to the frame's real viewport width, giving a truthful "what will
// the client see on their phone?" preview without introducing preview-only
// branches into the shared renderer.
import { useState } from 'react';
import { ExternalLink, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  clientId: string;
  assessmentId: string;
}

const ReportPreviewFrame = ({ clientId, assessmentId }: Props) => {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const embedSrc = `/admin/clients/${clientId}/report-preview?assessment=${assessmentId}&embed=1&device=${device}`;
  const fullSrc = `/admin/clients/${clientId}/report-preview?assessment=${assessmentId}&device=${device}`;

  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-foreground">Live client-view preview</p>
          <p className="text-xs text-muted-foreground">Exactly what your client sees. Nothing is logged.</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={device === 'desktop' ? 'default' : 'outline'}
            onClick={() => setDevice('desktop')}
          >
            <Monitor className="w-3.5 h-3.5 mr-1" /> Desktop
          </Button>
          <Button
            size="sm"
            variant={device === 'mobile' ? 'default' : 'outline'}
            onClick={() => setDevice('mobile')}
          >
            <Smartphone className="w-3.5 h-3.5 mr-1" /> Mobile
          </Button>
          <Button asChild size="sm" variant="ghost">
            <a href={fullSrc} target="_blank" rel="noreferrer">
              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open full preview
            </a>
          </Button>
        </div>
      </div>

      <div className="rounded-lg overflow-hidden border border-border/50 bg-background/50 flex justify-center">
        <iframe
          key={`${embedSrc}`}
          src={embedSrc}
          title="Personal report preview"
          className={`border-0 bg-white transition-all ${device === 'mobile' ? 'w-[390px]' : 'w-full'}`}
          style={{ height: '820px' }}
        />
      </div>
    </div>
  );
};

export default ReportPreviewFrame;