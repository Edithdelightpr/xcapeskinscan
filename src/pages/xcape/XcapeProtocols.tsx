import { Helmet } from 'react-helmet-async';
import { BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';
import { useActiveXcapeProtocols } from '@/hooks/useXcapeProtocols';

/**
 * Practitioner-facing protocol browser — read-only view of the active
 * protocols from the admin-managed Protocol Library. Practitioners can
 * read and act on protocols inside proposals, but cannot change them here.
 */
const XcapeProtocols = () => {
  const { data: protocols = [], isLoading } = useActiveXcapeProtocols();

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto space-y-5">
      <Helmet>
        <title>Protocols — XCAPE</title>
      </Helmet>
      <XcapePageHeader
        title="Protocols"
        description="Active treatment and home-care protocols from the XCAPE Protocol Library. These are the protocols recommendation rules can propose during an analysis. Managed by XCAPE administrators."
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading protocols…</p>
      ) : protocols.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center space-y-2">
          <BookOpen className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-foreground font-medium">No active protocols yet</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Protocols mapped to the XCAPE Tropical Skin Analysis Standard will appear here once an
            administrator activates them in the Protocol Library.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {protocols.map((p) => (
            <li key={p.id} className="glass rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-foreground">{p.name}</p>
                {p.category && <Badge variant="secondary" className="text-[10px]">{p.category}</Badge>}
              </div>
              {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
              {p.steps.length > 0 && (
                <ol className="space-y-1 pt-1">
                  {p.steps.map((s, i) => (
                    <li key={i} className="text-xs text-foreground flex gap-2">
                      <span className="text-primary font-semibold shrink-0">{i + 1}.</span> {s}
                    </li>
                  ))}
                </ol>
              )}
              <p className="text-[11px] text-muted-foreground pt-1">
                {[
                  p.frequency && `Frequency: ${p.frequency}`,
                  p.duration && `Duration: ${p.duration}`,
                  p.sessions != null && `${p.sessions} session(s)`,
                  p.follow_up_weeks != null && `Follow-up: ${p.follow_up_weeks} weeks`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {p.home_care && (
                <p className="text-[11px] text-muted-foreground">
                  <span className="text-foreground font-medium">Home care:</span> {p.home_care}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default XcapeProtocols;
