import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { CalendarDays, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import xcapeLogo from '@/assets/xcape-logo-black.png';

interface InviteDetails {
  event_title: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  client_first_name: string | null;
  status: 'pending' | 'accepted' | 'declined';
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'ready'; details: InviteDetails };

/**
 * Public client event invitation — token-only link (hash stored server-side).
 * The invitee views the event and accepts or declines. No login required.
 */
const EventInvite = () => {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [responding, setResponding] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setState({ kind: 'invalid' });
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('public-invitation-respond', {
        body: { token, action: 'details' },
      });
      if (error || !data || (data as { error?: string }).error) {
        setState({ kind: 'invalid' });
        return;
      }
      setState({ kind: 'ready', details: data as InviteDetails });
    } catch {
      setState({ kind: 'invalid' });
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const respond = async (response: 'accepted' | 'declined') => {
    if (!token) return;
    setResponding(true);
    try {
      const { data, error } = await supabase.functions.invoke('public-invitation-respond', {
        body: { token, action: 'respond', response },
      });
      if (error || !data || (data as { error?: string }).error) {
        throw new Error((data as { error?: string } | null)?.error ?? 'Could not save your response');
      }
      const status = (data as { status?: InviteDetails['status'] }).status ?? response;
      setState((prev) =>
        prev.kind === 'ready' ? { kind: 'ready', details: { ...prev.details, status } } : prev,
      );
    } catch (err) {
      // Keep UI honest — surface the failure rather than faking success.
      alert(err instanceof Error ? err.message : 'Could not save your response');
    } finally {
      setResponding(false);
    }
  };

  return (
    <div className="xcape-app min-h-screen gradient-primary flex items-center justify-center px-4 py-10">
      <Helmet>
        <title>Event Invitation — XCAPE</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="glass-strong rounded-2xl p-8 w-full max-w-md space-y-6 text-center">
        <img src={xcapeLogo} alt="XCAPE" width={1241} height={488} className="h-10 w-auto mx-auto" />

        {state.kind === 'loading' && (
          <p className="text-sm text-muted-foreground">Loading your invitation…</p>
        )}

        {state.kind === 'invalid' && (
          <div className="space-y-2">
            <XCircle className="w-10 h-10 mx-auto text-destructive/70" />
            <h1 className="text-lg font-display font-bold text-foreground">Invitation not found</h1>
            <p className="text-sm text-muted-foreground">
              This link is invalid or has been replaced. Ask the person who invited you for a new link.
            </p>
          </div>
        )}

        {state.kind === 'ready' && (
          <div className="space-y-5">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {state.details.client_first_name
                  ? `${state.details.client_first_name}, you're invited`
                  : "You're invited"}
              </p>
              <h1 className="text-xl font-display font-bold text-foreground">
                {state.details.event_title}
              </h1>
            </div>

            <div className="glass rounded-xl p-4 space-y-1 text-left">
              <p className="text-sm text-foreground flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-accent shrink-0" />
                {new Date(state.details.start_time).toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <p className="text-sm text-muted-foreground pl-6">
                {new Date(state.details.start_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                {' — '}
                {new Date(state.details.end_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </p>
              {state.details.notes && (
                <p className="text-sm text-muted-foreground pl-6 pt-1">{state.details.notes}</p>
              )}
            </div>

            {state.details.status === 'pending' ? (
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={() => respond('accepted')} disabled={responding} className="w-full">
                  {responding ? 'Saving…' : "I'll be there"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => respond('declined')}
                  disabled={responding}
                  className="w-full"
                >
                  Can't make it
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div
                  className={`rounded-xl border p-4 flex items-center justify-center gap-2 ${
                    state.details.status === 'accepted'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                      : 'border-destructive/30 bg-destructive/10 text-destructive'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <p className="text-sm font-semibold">
                    {state.details.status === 'accepted'
                      ? "You're on the list — see you there!"
                      : "Response recorded — sorry you can't make it."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => respond(state.details.status === 'accepted' ? 'declined' : 'accepted')}
                  disabled={responding}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Change my response
                </button>
              </div>
            )}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground/70">
          XCAPE — Tropical Skin Analysis
        </p>
      </div>
    </div>
  );
};

export default EventInvite;
