import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import Seo from '@/components/Seo';
import { Button } from '@/components/ui/button';
import PublicScanIntro from '@/components/xcape/public/PublicScanIntro';
import PublicCaptureStage from '@/components/xcape/public/PublicCaptureStage';
import PublicUploadFallback from '@/components/xcape/public/PublicUploadFallback';
import {
  PUBLIC_VIEWS,
  clearStoredToken,
  fetchStatus,
  readStoredToken,
  startSession,
  PublicAnalysisError,
  type PublicViewId,
} from '@/lib/publicAnalysisSession';
import xcapeLogo from '@/assets/xcape-logo-black.png';

type Stage = 'resuming' | 'intro' | 'camera' | 'upload' | 'captured' | 'expired';

const allDone = (views: PublicViewId[]) => PUBLIC_VIEWS.every((v) => views.includes(v));

/**
 * Public XCAPE skin analysis — anonymous capture surface.
 *
 * The page owns the single source of truth for verified views, so switching
 * between the guided camera and the upload fallback (in either direction)
 * and reloading the tab all preserve progress. Only an invalid or expired
 * session clears the stored token.
 */
const PublicSkinAnalysis = () => {
  const renderedAt = useMemo(() => Date.now(), []);
  const honeypot = useRef('');

  const [stage, setStage] = useState<Stage>(() => (readStoredToken() ? 'resuming' : 'intro'));
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [verifiedViews, setVerifiedViews] = useState<PublicViewId[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiredMessage, setExpiredMessage] = useState<string | null>(null);

  const endSession = useCallback((message: string) => {
    clearStoredToken();
    setToken(null);
    setVerifiedViews([]);
    setExpiredMessage(message);
    setStage('expired');
  }, []);

  // ── Resume: a stored token is checked before any new session is created ──
  useEffect(() => {
    if (stage !== 'resuming') return;
    const stored = readStoredToken();
    if (!stored) {
      setStage('intro');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const s = await fetchStatus(stored);
        if (cancelled) return;
        setToken(stored);
        setVerifiedViews(s.verified_views);
        if (allDone(s.verified_views) || s.status === 'queued' || s.status === 'complete') {
          setStage('captured');
        } else {
          setStage(s.capture_method === 'upload' ? 'upload' : 'camera');
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof PublicAnalysisError && e.kind === 'invalid') {
          // Only an invalid/expired token is discarded.
          clearStoredToken();
          setToken(null);
          setStage('intro');
        } else {
          // Network / 5xx: keep the token, let the visitor retry.
          setError('We could not reach the analysis service. Please try again.');
          setStage('intro');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stage]);

  const begin = useCallback(
    async (method: 'camera' | 'upload') => {
      setStarting(true);
      setError(null);
      try {
        const res = await startSession({
          captureMethod: method,
          cameraConsent: method === 'camera',
          renderedAt,
          website: honeypot.current,
        });
        setToken(res.token);
        setVerifiedViews([]);
        setStage(method);
      } catch (e) {
        setError(
          e instanceof PublicAnalysisError ? e.message : 'The analysis could not be started. Please try again.',
        );
      } finally {
        setStarting(false);
      }
    },
    [renderedAt],
  );

  /** Shared across camera and upload — a view verified in one mode counts in the other. */
  const handleVerified = useCallback((view: PublicViewId) => {
    setVerifiedViews((prev) => {
      const next = prev.includes(view) ? prev : [...prev, view];
      if (allDone(next)) setStage('captured');
      return next;
    });
  }, []);

  const restart = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setVerifiedViews([]);
    setExpiredMessage(null);
    setError(null);
    setStage('intro');
  }, []);

  return (
    <div className="xcape-public min-h-screen bg-background text-foreground">
      <Seo
        title="Free Skin Analysis for Tropical Skin | XCAPE"
        description="Take three guided photos and get your four XCAPE skin-health scores in about two minutes. No account needed. Photos deleted within 24 hours."
        path="/skin-analysis"
      />

      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link to="/" aria-label="XCAPE home">
            <img src={xcapeLogo} alt="XCAPE" className="h-6 w-auto" />
          </Link>
          <Link to="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Exit
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
        {/* Bot honeypot — visually hidden, never focusable */}
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          className="sr-only"
          onChange={(e) => {
            honeypot.current = e.target.value;
          }}
        />

        {stage === 'resuming' && (
          <div className="mx-auto flex max-w-lg flex-col items-center gap-3 py-16 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">Restoring your session…</p>
          </div>
        )}

        {stage === 'intro' && <PublicScanIntro starting={starting} error={error} onStart={begin} />}

        {stage === 'camera' && token && (
          <PublicCaptureStage
            token={token}
            verifiedViews={verifiedViews}
            onViewVerified={handleVerified}
            onSwitchToUpload={() => setStage('upload')}
            onSessionEnded={endSession}
          />
        )}

        {stage === 'upload' && token && (
          <PublicUploadFallback
            token={token}
            verifiedViews={verifiedViews}
            onViewVerified={handleVerified}
            onSwitchToCamera={() => setStage('camera')}
            onSessionEnded={endSession}
          />
        )}

        {stage === 'captured' && (
          <div className="mx-auto max-w-lg space-y-5 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden />
            <h2 className="text-2xl font-semibold text-foreground">All three photos are verified</h2>
            <p className="text-sm text-muted-foreground">
              Your capture is complete and held securely. The analysis and your personal report are coming in the next
              release of this page — your photos will be deleted within 24 hours in the meantime.
            </p>
            <Button asChild variant="outline" className="min-h-[44px]">
              <Link to="/">Back to XCAPE</Link>
            </Button>
          </div>
        )}

        {stage === 'expired' && (
          <div className="mx-auto max-w-lg space-y-5 text-center">
            <h2 className="text-2xl font-semibold text-foreground">This session has ended</h2>
            <p role="alert" className="text-sm text-muted-foreground">
              {expiredMessage ?? 'Your analysis session is no longer valid.'}
            </p>
            <Button className="min-h-[44px]" onClick={restart}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
              Start again
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default PublicSkinAnalysis;
