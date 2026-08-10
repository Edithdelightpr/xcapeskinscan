// Staff-only preview of a client's Personal Report. Renders the SAME
// `PersonalReportView` used on `/report/:token` so staff see exactly what
// the client sees. Nothing is suppressed inside the renderer — the
// "Preview only" ribbon lives here, above/around the report content.
//
// Guarded by <AuthGuard/>, matching the Client tab's permission surface so
// any role that can manage a client's Reports tab can preview it — not just
// administrators. The underlying `admin-preview-report` edge function
// repeats the role and entity-belongs checks server-side.
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, EyeOff, Monitor, Smartphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PersonalReportView from '@/components/report/PersonalReportView';
import type { ReportPayload } from '@/hooks/useReportPayload';
import Seo from '@/components/Seo';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; data: ReportPayload };

const AdminReportPreview = () => {
  const { id: clientId } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const assessmentId = search.get('assessment');
  const embed = search.get('embed') === '1';
  const initialDevice = (search.get('device') as 'desktop' | 'mobile') || 'desktop';
  const [device, setDevice] = useState<'desktop' | 'mobile'>(initialDevice);
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    if (!clientId || !assessmentId) {
      setState({ kind: 'error', message: 'Missing client or assessment' });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('admin-preview-report', {
          body: { client_id: clientId, assessment_id: assessmentId },
        });
        if (cancelled) return;
        if (error) {
          // Try to surface the underlying response body for diagnostics.
          let detail = error.message ?? 'Preview failed';
          // deno-lint-ignore no-explicit-any
          const ctx: any = (error as any).context;
          if (ctx?.response) {
            try {
              const text = await ctx.response.clone().text();
              detail = `HTTP ${ctx.response.status}: ${text || detail}`;
            } catch { /* ignore */ }
          }
          setState({ kind: 'error', message: detail });
          return;
        }
        if (!data?.ok) {
          setState({ kind: 'error', message: data?.error ? JSON.stringify(data) : 'Preview failed' });
          return;
        }
        setState({ kind: 'ok', data: data as ReportPayload });
      } catch (e) {
        if (!cancelled) {
          setState({ kind: 'error', message: e instanceof Error ? e.message : 'Network error' });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [clientId, assessmentId]);

  return (
    <>
      <Seo title="Report preview" description="Staff preview" path="/admin" type="website" noindex />

      {/* Preview ribbon lives OUTSIDE the shared renderer so we don't have to
          thread a preview flag through client-facing components. */}
      {!embed && (
        <div className="sticky top-0 z-40 bg-amber-500/10 border-b border-amber-500/30 backdrop-blur">
          <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3 text-xs">
            <EyeOff className="w-3.5 h-3.5 text-amber-600" />
            <span className="font-semibold text-amber-700 dark:text-amber-300">
              Preview only — this is exactly what your client sees. Nothing is being logged.
            </span>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDevice('desktop')}
                aria-pressed={device === 'desktop'}
                className={`px-2 py-1 rounded inline-flex items-center gap-1 ${device === 'desktop' ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200' : 'text-amber-700/70 dark:text-amber-300/70 hover:bg-amber-500/10'}`}
              >
                <Monitor className="w-3.5 h-3.5" /> Desktop
              </button>
              <button
                type="button"
                onClick={() => setDevice('mobile')}
                aria-pressed={device === 'mobile'}
                className={`px-2 py-1 rounded inline-flex items-center gap-1 ${device === 'mobile' ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200' : 'text-amber-700/70 dark:text-amber-300/70 hover:bg-amber-500/10'}`}
              >
                <Smartphone className="w-3.5 h-3.5" /> Mobile
              </button>
              <Link
                to={`/admin/clients/${clientId}?tab=reports`}
                className="ml-3 inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 dark:text-amber-300"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Reports
              </Link>
            </div>
          </div>
        </div>
      )}

      {state.kind === 'loading' && (
        <div className="min-h-[60vh] flex items-center justify-center text-sm text-muted-foreground">
          Loading preview…
        </div>
      )}
      {state.kind === 'error' && (
        <div className="min-h-[60vh] flex items-center justify-center px-6 text-center">
          <div className="max-w-md">
            <h1 className="font-display text-xl mb-2">Couldn't load preview</h1>
            <p className="text-sm text-muted-foreground">{state.message}</p>
          </div>
        </div>
      )}
      {state.kind === 'ok' && (
        <div className={device === 'mobile' && !embed ? 'mx-auto max-w-[390px] shadow-xl border-x border-border/40' : ''}>
          <PersonalReportView data={state.data} token="preview" downloadDisabled />
        </div>
      )}
    </>
  );
};

export default AdminReportPreview;