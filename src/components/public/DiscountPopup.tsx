import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import tropicsLogo from "@/assets/tropics-logo.jpeg";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "tropics-discount-popup-dismissed";
const DEFAULT_DELAY_MS = 20_000;

const EXCLUDED_PREFIXES = ["/auth", "/admin", "/outreach/portal", "/checkout"];

type PromoPopupConfig = {
  enabled?: boolean;
  heading?: string;
  message?: string;
  badge?: string | null;
  cta_label?: string;
  cta_kind?: "internal" | "anchor" | "external";
  cta_target?: string;
  image_url?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  display?: "immediate" | "delay";
  delay_ms?: number;
  dismissible?: boolean;
};

function isExcluded(pathname: string) {
  return EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isValidCta(kind: string | undefined, target: string | undefined): boolean {
  if (!target || typeof target !== "string") return false;
  if (kind === "internal") return target.startsWith("/");
  if (kind === "anchor") return target.startsWith("/") && target.includes("#");
  if (kind === "external") {
    try {
      const u = new URL(target);
      return u.protocol === "https:";
    } catch {
      return false;
    }
  }
  return false;
}

function isConfigDisplayable(cfg: PromoPopupConfig | null): cfg is PromoPopupConfig {
  if (!cfg || typeof cfg !== "object") return false;
  if (cfg.enabled !== true) return false;
  if (!cfg.heading || !cfg.message || !cfg.cta_label) return false;
  if (!isValidCta(cfg.cta_kind, cfg.cta_target)) return false;
  const now = Date.now();
  if (cfg.start_at) {
    const t = Date.parse(cfg.start_at);
    if (Number.isFinite(t) && now < t) return false;
  }
  if (cfg.end_at) {
    const t = Date.parse(cfg.end_at);
    if (Number.isFinite(t) && now >= t) return false;
  }
  return true;
}

const DiscountPopup = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<PromoPopupConfig | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isExcluded(location.pathname)) return;

    let cancelled = false;
    let timer: number | undefined;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("site_settings")
          .select("value")
          .eq("key", "promo_popup")
          .maybeSingle();
        if (cancelled || error || !data) return;
        const cfg = (data.value ?? null) as PromoPopupConfig | null;
        if (!isConfigDisplayable(cfg)) return;

        // Session throttle — dismissible campaigns don't re-show in the same session.
        if (cfg.dismissible !== false && sessionStorage.getItem(SESSION_KEY) === "true") return;

        setConfig(cfg);

        if (cfg.display === "immediate") {
          setOpen(true);
        } else {
          const delay = typeof cfg.delay_ms === "number" && cfg.delay_ms >= 0 ? cfg.delay_ms : DEFAULT_DELAY_MS;
          timer = window.setTimeout(() => {
            if (!cancelled) setOpen(true);
          }, delay);
        }
      } catch {
        // Fail closed — never render a hardcoded fallback.
      }
    })();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
    // Only run once on initial mount — we don't want the timer to restart on every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, "true");
    } catch {}
    setOpen(false);
  };

  const handleShop = () => {
    dismiss();
    if (!config) return;
    const target = config.cta_target ?? "";
    if (config.cta_kind === "external") {
      window.open(target, "_blank", "noopener,noreferrer");
    } else {
      navigate(target);
    }
  };

  // Re-evaluate exclusion on navigation: if user navigates to an excluded route while open, close it.
  useEffect(() => {
    if (open && isExcluded(location.pathname)) setOpen(false);
  }, [location.pathname, open]);

  // Fail closed: nothing to render until a valid live campaign is loaded.
  if (!config) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : dismiss())}>
      <DialogContent className="max-w-md border-accent/30 bg-card p-0 overflow-hidden rounded-2xl shadow-2xl">
        <div className="relative px-6 pt-8 pb-6 sm:px-8 sm:pt-10 sm:pb-8">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/10" />
          <div className="relative flex flex-col items-center text-center">
            <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-accent via-accent/80 to-accent/60 p-[2px] shadow-[0_4px_20px_-4px_hsl(var(--accent)/0.6)] ring-2 ring-accent/40">
              <div className="h-full w-full rounded-full overflow-hidden bg-background ring-1 ring-accent/30">
                <img
                  src={config.image_url || tropicsLogo}
                  alt="Tropics Med Spa"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
            {config.badge ? (
              <p className="text-[11px] uppercase tracking-[0.25em] text-accent/90 font-semibold mb-2">
                {config.badge}
              </p>
            ) : null}
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground leading-tight">
              {config.heading}
            </h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-sm">
              {config.message}
            </p>

            <div className="mt-6 flex w-full flex-col gap-2">
              <Button
                onClick={handleShop}
                className="w-full h-12 text-base bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_4px_20px_-4px_hsl(var(--accent)/0.5)]"
              >
                {config.cta_label}
              </Button>
              {config.dismissible !== false ? (
                <Button
                  variant="ghost"
                  onClick={dismiss}
                  className="w-full text-muted-foreground hover:text-foreground"
                >
                  Maybe Later
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DiscountPopup;