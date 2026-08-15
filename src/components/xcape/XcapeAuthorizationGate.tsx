import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ShieldAlert, Sparkles } from 'lucide-react';
import { useXcapeAuthorization } from '@/hooks/useXcapeAuthorization';
import { describeAuthorization, formatFee } from '@/lib/xcapeAuthorization';

/**
 * Gates the scanner on the SERVER-derived authorization verdict.
 *
 * Affiliates are authorized the moment they sign up. A partner location is
 * authorized only when it is approved AND its activation fee is recorded.
 * This component is presentation only — the database enforces the same rule
 * on scan creation, so a hand-typed URL still cannot start an analysis.
 */
const XcapeAuthorizationGate = ({ children }: { children: ReactNode }) => {
  const { data, isLoading } = useXcapeAuthorization();

  if (isLoading) {
    return (
      <div className="px-4 sm:px-6 py-24 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" aria-label="Checking access" />
      </div>
    );
  }

  if (data && !data.authorized) {
    const copy = describeAuthorization(data);
    return (
      <div className="px-4 sm:px-6 py-12 sm:py-16 max-w-xl mx-auto">
        <div className="glass rounded-2xl p-6 sm:p-10 text-center space-y-4">
          <ShieldAlert className="w-10 h-10 mx-auto text-accent" />
          <h1 className="font-display font-bold text-xl sm:text-2xl text-foreground">{copy.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.body}</p>

          {copy.showFee && (
            <div className="rounded-xl border border-border/60 bg-surface/60 p-4 text-left space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Activation fee
              </p>
              <p className="text-lg font-semibold text-foreground">
                {formatFee(data.required_fee, data.currency ?? 'NGN')}
              </p>
              <p className="text-xs text-muted-foreground">
                Payment status: <span className="capitalize">{data.fee_status ?? 'unpaid'}</span>.
                XCAPE marks this as paid once your transfer is confirmed.
              </p>
            </div>
          )}

          {data.org_name && (
            <p className="text-xs text-muted-foreground/80">
              Partner location: <span className="text-foreground">{data.org_name}</span>
            </p>
          )}

          <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
            <Link
              to="/xcape/account"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-border px-5 text-sm hover:bg-muted/40"
            >
              View my account
            </Link>
            <a
              href="mailto:hello@xcape.africa"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm text-background hover:opacity-90"
            >
              <Sparkles className="w-4 h-4" aria-hidden /> Contact XCAPE
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default XcapeAuthorizationGate;
