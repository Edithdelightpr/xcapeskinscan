import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PageReveal from "@/components/public/PageReveal";

type Status = "loading" | "valid" | "already" | "invalid" | "submitting" | "done" | "error";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      setErrorMessage("Missing unsubscribe token.");
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON } },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus("invalid");
          setErrorMessage(data?.error ?? "Invalid or expired link.");
          return;
        }
        if (data?.valid === false && data?.reason === "already_unsubscribed") {
          setStatus("already");
          return;
        }
        if (data?.valid === true) {
          setStatus("valid");
          return;
        }
        setStatus("invalid");
        setErrorMessage("This link is no longer valid.");
      } catch {
        setStatus("error");
        setErrorMessage("Network error. Please try again.");
      }
    })();
  }, [token]);

  const confirm = async () => {
    setStatus("submitting");
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      if ((data as any)?.success || (data as any)?.reason === "already_unsubscribed") {
        setStatus("done");
      } else {
        setStatus("error");
        setErrorMessage((data as any)?.error ?? "Could not unsubscribe.");
      }
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err?.message ?? "Could not unsubscribe.");
    }
  };

  return (
    <PageReveal>
    <main className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8 space-y-5 text-center">
        <h1 className="text-2xl font-bold text-foreground">Email preferences</h1>

        {status === "loading" && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p>Checking your link…</p>
          </div>
        )}

        {status === "valid" && (
          <>
            <p className="text-muted-foreground">
              Click below to unsubscribe from Tropics MedSpa emails. You can resubscribe
              any time by contacting us.
            </p>
            <Button className="w-full" onClick={confirm}>Confirm unsubscribe</Button>
          </>
        )}

        {status === "submitting" && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p>Updating your preferences…</p>
          </div>
        )}

        {status === "done" && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <p className="text-foreground">You've been unsubscribed. We're sorry to see you go.</p>
          </div>
        )}

        {status === "already" && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <p className="text-foreground">You're already unsubscribed — no further action needed.</p>
          </div>
        )}

        {(status === "invalid" || status === "error") && (
          <div className="flex flex-col items-center gap-3">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-muted-foreground">{errorMessage}</p>
          </div>
        )}
      </Card>
    </main>
    </PageReveal>
  );
}