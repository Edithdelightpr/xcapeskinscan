import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import Seo from '@/components/Seo';
import { Button } from '@/components/ui/button';
import PublicScanIntro from '@/components/xcape/public/PublicScanIntro';
import PublicCaptureStage from '@/components/xcape/public/PublicCaptureStage';
import PublicUploadFallback from '@/components/xcape/public/PublicUploadFallback';
import {
  clearStoredToken,
  readStoredToken,
  startSession,
  PublicAnalysisError,
} from '@/lib/publicAnalysisSession';
import xcapeLogo from '@/assets/xcape-logo-black.png';

type Stage = 'intro' | 'camera' | 'upload' | 'captured' | 'expired';

/**
 * Public XCAPE skin analysis — anonymous capture surface.
 *
 * This step of the journey ends once all three views are captured and
 * verified server-side; the analysis, animation, report and lead capture
 * arrive in the next phase.
 */
const PublicSkinAnalysis = () => {
  const renderedAt = useMemo(() => Date.now(), []);
  const honeypot = useRef('');

  const [stage, setStage] = useState<Stage>('intro');
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiredMessage, setExpiredMessage] = useState<string | null>(null);

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

  const handleExpired = useCallback((message: string) => {
    clearStoredToken();
    setToken(null);
    setExpiredMessage(message);
    setStage('expired');
  }, []);

  const restart = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setExpiredMessage(null);
    setError(null);
    setStage('intro');
  }, []);

  return (
    <div className="xcape-public min-h-screen bg-background text-foreground">
      <Seo
        title="Free Skin Analysis for Tropical Skin | XCAPE"
        description="Take three guided photos and get your four XCAPE skin-health scores in about two minutes. No account needed. Photos deleted within 24 hours."
        canonical="/skin-analysis"
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

        {stage === 'intro' && <PublicScanIntro starting={starting} error={error} onStart={begin} />}

        {stage === 'camera' && token && (
          <PublicCaptureStage
            token={token}
            onAllVerified={() => setStage('captured')}
            onSwitchToUpload={() => setStage('upload')}
            onSessionExpired={handleExpired}
          />
        )}

        {stage === 'upload' && token && (
          <PublicUploadFallback
            token={token}
            onAllVerified={() => setStage('captured')}
            onSwitchToCamera={() => setStage('camera')}
            onSessionExpired={handleExpired}
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
