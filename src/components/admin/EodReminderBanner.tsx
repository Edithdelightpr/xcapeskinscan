import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const STORAGE_KEY = 'tropics:eod-banner-dismissed';

const yesterdayISO = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

interface Props {
  onOpenEod?: () => void;
}

/**
 * Passive nag: if the signed-in staff has no EOD report for yesterday,
 * show a dismissible amber banner. Dismissal is per-session only.
 */
const EodReminderBanner = ({ onOpenEod }: Props) => {
  const { user, roles } = useAuth();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return sessionStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  });

  // Only roles that owe an EOD see the banner.
  const owesEod = !!user && (
    roles.includes('admin') ||
    roles.includes('front_desk') ||
    roles.includes('medical_aesthetician')
  );

  const yesterday = yesterdayISO();

  const { data: hasYesterdayReport, isLoading } = useQuery({
    queryKey: ['eod-banner', user?.id, yesterday],
    enabled: owesEod && !dismissed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eod_reports')
        .select('id')
        .eq('staff_user_id', user!.id)
        .eq('report_date', yesterday)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  useEffect(() => {
    // Reset dismissal flag at midnight crossing — handled implicitly because
    // the storage key is per-session.
  }, []);

  if (!owesEod || dismissed || isLoading || hasYesterdayReport) return null;

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch { /* noop */ }
  };

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex items-center gap-3 mb-4 animate-fade-in">
      <AlertTriangle className="w-5 h-5 text-amber-700 font-semibold shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          You haven't submitted yesterday's End-of-Day report.
        </p>
        <p className="text-[11px] text-muted-foreground">
          Submit it now to keep the team's daily record accurate.
        </p>
      </div>
      {onOpenEod && (
        <button
          onClick={onOpenEod}
          className="text-xs font-medium px-3 py-1.5 rounded-md bg-amber-500/20 text-amber-700 font-semibold hover:bg-amber-500/30 transition-colors"
        >
          Submit now →
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default EodReminderBanner;
