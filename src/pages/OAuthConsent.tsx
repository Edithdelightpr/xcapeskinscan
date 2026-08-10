import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";


// Managed Supabase OAuth 2.1 consent screen. Users land here when an external
// MCP client (ChatGPT, Claude, Codex, Cursor, …) starts an authorization.
// We look up the request, show the client, and forward the user's decision.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};

const oauth: OAuthApi = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      if (!oauth) return setError("This project's Supabase client does not expose the OAuth helper.");
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("No redirect returned by the authorization server.");
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <div className="min-h-screen gradient-primary flex items-center justify-center px-4">
        <div className="glass-strong rounded-2xl p-8 w-full max-w-md space-y-4">
          <h1 className="text-xl font-display font-bold text-foreground">Connection error</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="min-h-screen gradient-primary flex items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Loading authorization request…</p>
      </div>
    );
  }

  const clientName = details.client?.name ?? "an external app";
  const redirectUri: string | undefined = details.client?.redirect_uri ?? details.redirect_uri;

  return (
    <div className="min-h-screen gradient-primary flex items-center justify-center px-4">
      <div className="glass-strong rounded-2xl p-8 w-full max-w-md space-y-6 glow-primary-soft">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 ring-2 ring-accent/40 flex items-center justify-center">
            <span className="font-display font-bold text-2xl text-foreground">X</span>
          </div>
          <h1 className="text-xl font-display font-bold text-foreground text-center">
            Connect {clientName} to XCAPE
          </h1>
          <p className="text-xs text-muted-foreground text-center">
            This will let {clientName} use XCAPE tools as you. It respects your staff role
            and all row-level permissions — it cannot see or change anything you can't already access.
          </p>
        </div>

        {redirectUri && (
          <div className="text-[11px] text-muted-foreground bg-surface rounded-lg p-3 break-all">
            <div className="uppercase tracking-wider text-[10px] mb-1">Redirect URI</div>
            {redirectUri}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" disabled={busy} onClick={() => decide(false)}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => decide(true)} className="glow-primary">
            {busy ? "Please wait…" : "Approve"}
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground text-center">
          This does not bypass row-level security or backend policies.
        </p>
      </div>
    </div>
  );
}