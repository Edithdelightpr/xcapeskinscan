import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { XCAPE_DEMO_PATH } from '@/lib/xcapeMarketing';

/**
 * Membership gate for scan results.
 *
 * Anyone may run the scanner, but the four XCAPE scores and the report are
 * only released to an XCAPE account. The analysis session token stays in
 * local storage, so the visitor lands back on this page after joining and
 * their finished results are restored.
 */
const joinPath = (mode: 'signup' | 'signin') =>
  `/auth?mode=${mode}&next=${encodeURIComponent(XCAPE_DEMO_PATH)}`;

const JoinToViewResults = () => (
  <section
    aria-labelledby="join-to-view-results"
    className="mx-auto max-w-lg space-y-5 rounded-2xl border border-border bg-card p-6 text-center sm:p-8"
  >
    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border">
      <Lock className="h-5 w-5 text-muted-foreground" aria-hidden />
    </span>
    <h2 id="join-to-view-results" className="text-2xl font-semibold text-foreground">
      Your analysis is ready. Join XCAPE to see it.
    </h2>
    <p className="text-sm text-muted-foreground">
      Your photos have been analysed. XCAPE results, scores and recommendations are released to XCAPE
      members only. Creating a free account takes a moment, and you come straight back to this result.
    </p>
    <div className="flex flex-col items-center gap-3">
      <Button asChild className="min-h-[44px] w-full sm:w-auto">
        <Link to={joinPath('signup')}>Join XCAPE to see my results</Link>
      </Button>
      <Button asChild variant="outline" className="min-h-[44px] w-full sm:w-auto">
        <Link to={joinPath('signin')}>I already have an account</Link>
      </Button>
    </div>
  </section>
);

export default JoinToViewResults;
