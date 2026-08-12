import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import Seo from '@/components/Seo';
import { Button } from '@/components/ui/button';
import PublicScanIntro from '@/components/xcape/public/PublicScanIntro';
import PublicCaptureStage from '@/components/xcape/public/PublicCaptureStage';
import PublicUploadFallback from '@/components/xcape/public/PublicUploadFallback';
import AnalysisScanAnimation from '@/components/xcape/public/AnalysisScanAnimation';
import PublicReportStage from '@/components/xcape/public/PublicReportStage';
import { priorityFromScores, type PublicScoreKey, type PublicScores } from '@/lib/publicAnalysisScores';
import { scoresFromReport, type PublicAnalysisReport } from '@/lib/publicAnalysisReport';
import { isAnalysisPhase, type AnalysisPhase } from '@/lib/analysisPhases';
import {
  PUBLIC_VIEWS,
  clearStoredToken,
  fetchReport,
  fetchStatus,
  readStoredToken,
  startAnalysis,
  startSession,
  PublicAnalysisError,
  type PublicAnalysisStatus,
  type PublicViewId,
} from '@/lib/publicAnalysisSession';
import xcapeLogo from '@/assets/xcape-logo-black.png';

type Stage =
  | 'resuming'
  | 'intro'
  | 'camera'
  | 'upload'
  | 'analyzing'
  | 'analyzed'
  | 'analysis_failed'
  | 'expired';

const allDone = (views: PublicViewId[]) => PUBLIC_VIEWS.every((v) => views.includes(v));

/** How often the page asks the server for the real phase. */
export const POLL_INTERVAL_MS = 2_000;
/** The scanning stage is always visible for at least this long. */
export const MIN_ANIMATION_MS = 2_500;

/**
 * Public XCAPE skin analysis — anonymous capture and analysis surface.
 *
 * The page owns the single source of truth for verified views and for the
 * temporary object URL of the locally held front frame (created here,
 * revoked on unmount and whenever it is replaced). Only an invalid or
 * expired session clears the stored token.
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
  const [phase, setPhase] = useState<AnalysisPhase | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [scores, setScores] = useState<PublicScores | null>(null);
  const [priority, setPriority] = useState<PublicScoreKey | null>(null);
  const [report, setReport] = useState<PublicAnalysisReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  /** Temporary object URL for the front frame — owned and revoked here. */
  const [frontUrl, setFrontUrl] = useState<string | null>(null);
  const frontUrlRef = useRef<string | null>(null);
  const analysisStartedAt = useRef<number | null>(null);
  /** Set only by the visitor's explicit "Try again" action. */
  const retryRequested = useRef(false);
  /** At most one server-sanctioned stale recovery claim per analysis mount. */
  const recoveryClaimed = useRef(false);


  const setFrontFrame = useCallback((blob: Blob) => {
    if (frontUrlRef.current) URL.revokeObjectURL(frontUrlRef.current);
    const url = URL.createObjectURL(blob);
    frontUrlRef.current = url;
    setFrontUrl(url);
  }, []);

  const releaseFrontFrame = useCallback(() => {
    if (frontUrlRef.current) URL.revokeObjectURL(frontUrlRef.current);
    frontUrlRef.current = null;
    setFrontUrl(null);
  }, []);

  useEffect(() => () => releaseFrontFrame(), [releaseFrontFrame]);

  const endSession = useCallback(
    (message: string) => {
      clearStoredToken();
      releaseFrontFrame();
      setToken(null);
      setVerifiedViews([]);
      setExpiredMessage(message);
      setStage('expired');
    },
    [releaseFrontFrame],
  );

  /** Applies a server status to the page state machine. */
  const applyStatus = useCallback((s: PublicAnalysisStatus) => {
    setVerifiedViews(s.verified_views);
    setPhase(isAnalysisPhase(s.phase) ? s.phase : null);
    if (s.scores) {
      setScores(s.scores);
      setPriority(s.priority_category);
    }
    if (s.status === 'complete') return 'analyzed' as const;
    if (s.status === 'failed') return 'analysis_failed' as const;
    if (s.status === 'analyzing' || s.status === 'building_report') return 'analyzing' as const;
    if (s.status === 'queued' || allDone(s.verified_views)) return 'analyzing' as const;
    return null;
  }, []);

  // ── The finished report content is fetched once the run is complete ──
  useEffect(() => {
    if (stage !== 'analyzed' || !token || report) return;
    let cancelled = false;
    setReportLoading(true);
    void (async () => {
      try {
        const r = await fetchReport(token);
        if (cancelled) return;
        setReport(r);
        const s = scoresFromReport(r);
        if (s) {
          setScores(s);
          setPriority((prev) => prev ?? priorityFromScores(s));
        }
      } catch {
        // Non-fatal: the meters still render from the status payload.
        if (!cancelled) setReport(null);
      } finally {
        if (!cancelled) setReportLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stage, token, report]);


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
        const next = applyStatus(s);
        setStage(next ?? (s.capture_method === 'upload' ? 'upload' : 'camera'));
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
  }, [stage, applyStatus]);

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
  const handleVerified = useCallback(
    (view: PublicViewId, frame?: Blob) => {
      if (view === 'front' && frame) setFrontFrame(frame);
      setVerifiedViews((prev) => {
        const next = prev.includes(view) ? prev : [...prev, view];
        if (allDone(next)) {
          // The capture stage dissolves straight into the scanning stage —
          // there is no holding screen.
          setPhase(null);
          setAnalysisError(null);
          analysisStartedAt.current = Date.now();
          setStage('analyzing');
        }
        return next;
      });
    },
    [setFrontFrame],
  );

  // ── Analysis: start at most once, then poll status only ─────────────────
  //
  // `startAnalysis()` runs only when this effect mounts with a session that
  // is not already running, or when the visitor explicitly retried. While the
  // status is `analyzing`, polling calls `fetchStatus()` and nothing else, so
  // no amount of polling can trigger another AI request. A `failed` status is
  // shown as-is — it never auto-claims another run.
  useEffect(() => {
    if (stage !== 'analyzing' || !token) return;
    if (analysisStartedAt.current === null) analysisStartedAt.current = Date.now();
    let cancelled = false;
    let timer: number | undefined;

    const settle = (next: Stage) => {
      const elapsed = Date.now() - (analysisStartedAt.current ?? Date.now());
      const wait = Math.max(0, MIN_ANIMATION_MS - elapsed);
      timer = window.setTimeout(() => {
        if (!cancelled) setStage(next);
      }, wait);
    };

    const failWith = (message: string) => {
      setAnalysisError(message);
      settle('analysis_failed');
    };

    /** Returns true when the run reached a terminal state. */
    const applyPolled = (s: PublicAnalysisStatus): boolean => {
      setVerifiedViews(s.verified_views);
      if (isAnalysisPhase(s.phase)) setPhase(s.phase);
      if (s.status === 'complete') {
        setPhase('analysis_complete');
        settle('analyzed');
        return true;
      }
      if (s.status === 'failed') {
        failWith('The analysis could not be completed. You can try again.');
        return true;
      }
      return false;
    };

    /**
     * Bounded recovery: the SERVER decides staleness (`recoverable_stale`),
     * never a browser timer. When it says the worker that holds the lease has
     * stopped heartbeating, this makes exactly ONE claim with the stable
     * idempotency key — not `retry: true`, not a fresh key — and the row lock
     * plus lease inside `public_analysis_claim_run` remains the authority, so
     * concurrent tabs still produce a single winner.
     */
    const recoverIfStale = async (s: PublicAnalysisStatus): Promise<void> => {
      if (!s.recoverable_stale || recoveryClaimed.current) return;
      recoveryClaimed.current = true;
      const run = await startAnalysis(token);
      if (cancelled) return;
      if (isAnalysisPhase(run.phase)) setPhase(run.phase);
    };

    const poll = async () => {
      try {
        const s = await fetchStatus(token);
        if (cancelled) return;
        if (applyPolled(s)) return;
        await recoverIfStale(s);
        if (cancelled) return;
        timer = window.setTimeout(() => void poll(), POLL_INTERVAL_MS);
      } catch (e) {
        if (cancelled) return;
        handleError(e, POLL_INTERVAL_MS * 2, poll);
      }
    };

    const handleError = (e: unknown, backoff: number, resume: () => Promise<void>) => {
      if (e instanceof PublicAnalysisError) {
        if (e.kind === 'invalid') {
          endSession(e.message);
          return;
        }
        if (e.kind === 'rate_limited' || e.kind === 'rejected') {
          failWith(e.message);
          return;
        }
        // Network / 5xx: keep polling status — the worker may still be running.
        timer = window.setTimeout(() => void resume(), backoff);
        return;
      }
      failWith('The analysis could not be completed. You can try again.');
    };

    const boot = async () => {
      const retry = retryRequested.current;
      retryRequested.current = false;
      try {
        const s = await fetchStatus(token);
        if (cancelled) return;
        setVerifiedViews(s.verified_views);
        if (isAnalysisPhase(s.phase)) setPhase(s.phase);

        const running = s.status === 'analyzing' || s.status === 'building_report';
        if (!running && !(s.status === 'failed' && !retry)) {
          // Queued (or an explicit retry of a failed run): claim exactly once.
          const run = await startAnalysis(token, { retry });
          if (cancelled) return;
          if (isAnalysisPhase(run.phase)) setPhase(run.phase);
        } else {
          if (applyPolled(s)) return;
          await recoverIfStale(s);
          if (cancelled) return;
        }
        timer = window.setTimeout(() => void poll(), POLL_INTERVAL_MS);
      } catch (e) {
        if (cancelled) return;
        // A recoverable boot failure falls back to status polling only.
        handleError(e, POLL_INTERVAL_MS * 2, poll);
      }
    };

    void boot();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [stage, token, endSession]);

  const retryAnalysis = useCallback(() => {
    setAnalysisError(null);
    setPhase(null);
    setScores(null);
    setPriority(null);
    retryRequested.current = true;
    recoveryClaimed.current = false;
    analysisStartedAt.current = Date.now();
    setStage('analyzing');
  }, []);


  const restart = useCallback(() => {
    clearStoredToken();
    releaseFrontFrame();
    setToken(null);
    setVerifiedViews([]);
    setExpiredMessage(null);
    setError(null);
    setAnalysisError(null);
    setPhase(null);
    setScores(null);
    setPriority(null);
    setStage('intro');
  }, [releaseFrontFrame]);

  return (
    <div className="xcape-public min-h-screen bg-background text-foreground">
      <Seo
        title="Free Skin Analysis for Tropical Skin | XCAPE"
        description="Take three guided photos and get your four XCAPE skin-health scores in about two minutes. No account needed. Photos deleted within 24 hours."
        path="/skin-analysis"
      />

      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <Link to="/" aria-label="XCAPE home" className="flex items-center">
            <img src={xcapeLogo} alt="XCAPE" className="h-6 w-auto" />
          </Link>
          <p className="hidden text-sm font-medium text-muted-foreground sm:block">Quick skin analysis</p>
          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center rounded-full border border-border px-4 text-sm text-foreground transition-colors hover:bg-muted"
          >
            Exit
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:py-12">
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

        {stage === 'analyzing' && (
          <AnalysisScanAnimation
            photoUrl={frontUrl}
            phase={phase}
            capturedViews={verifiedViews}
            onOpenReport={() => setStage('analyzed')}
          />
        )}

        {stage === 'analyzed' && (
          <PublicReportStage
            photoUrl={frontUrl}
            scores={scores}
            priority={priority}
            capturedViews={verifiedViews}
            onRestart={restart}
          />
        )}

        {stage === 'analysis_failed' && (
          <div className="mx-auto max-w-lg space-y-5 text-center">
            <h2 className="text-2xl font-semibold text-foreground">We could not finish your analysis</h2>
            <p role="alert" className="text-sm text-muted-foreground">
              {analysisError ?? 'Something interrupted the analysis. You can try again.'}
            </p>
            <div className="flex flex-col items-center gap-3">
              <Button className="min-h-[44px]" onClick={retryAnalysis}>
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
                Try the analysis again
              </Button>
              <Button variant="outline" className="min-h-[44px]" onClick={restart}>
                Start a new session
              </Button>
            </div>
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
