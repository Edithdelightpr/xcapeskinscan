import { useMemo } from 'react';
import { TrendingUp, Users, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRealClients } from '@/hooks/useRealClients';
import { useRealAppointments } from '@/hooks/useRealAppointments';
import { useMyCommissionTotal, useCommissionSettings } from '@/hooks/useCommissions';
import { formatNaira } from '@/lib/finance';
import MyBookingLinkCard from './MyBookingLinkCard';
import MyPromoCodeCard from './MyPromoCodeCard';

const CONVERTED = new Set(['converted', 'member', 'elite']);

/**
 * Canonical "your referrals" panel — sits on top of the existing booking-link
 * card and adds the funnel + revenue numbers, all from one source of truth
 * (`attributed_staff_id` on clients/appointments/finance allocations).
 *
 * This component intentionally wraps `MyBookingLinkCard` instead of replacing
 * it, so we don't duplicate the slug-claim flow.
 */
const MyReferralsPanel = () => {
  const { user } = useAuth();
  const { data: clients = [] } = useRealClients();
  const { data: appts = [] } = useRealAppointments();
  const { data: settings } = useCommissionSettings();

  const monthStartIso = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1).toISOString();
  }, []);
  const { data: monthCommission = 0 } = useMyCommissionTotal(monthStartIso);
  const { data: lifetimeCommission = 0 } = useMyCommissionTotal();
  const showCommission = !!settings?.enabled;

  const me = user?.id;

  const stats = useMemo(() => {
    if (!me) {
      return { mLeads: 0, mBookings: 0, mConverted: 0, lLeads: 0, lBookings: 0, lConverted: 0 };
    }
    const monthStart = monthStartIso;
    const myClients = clients.filter((c) => c.attributed_staff_id === me && !c.archived);
    const myAppts = appts.filter((a) => a.attributed_staff_id === me);

    const mLeads = myClients.filter((c) => (c.created_at ?? '') >= monthStart).length;
    const mBookings = myAppts.filter((a) => (a.created_at ?? '') >= monthStart).length;
    const mConverted = myClients.filter(
      (c) => CONVERTED.has(c.status) && (c.updated_at ?? c.created_at ?? '') >= monthStart,
    ).length;

    const lLeads = myClients.length;
    const lBookings = myAppts.length;
    const lConverted = myClients.filter((c) => CONVERTED.has(c.status)).length;

    return { mLeads, mBookings, mConverted, lLeads, lBookings, lConverted };
  }, [clients, appts, me, monthStartIso]);

  return (
    <div className="space-y-4">
      <MyBookingLinkCard />
      <MyPromoCodeCard />

      {/* Funnel & revenue — one card, two columns (this month / lifetime) */}
      <div className="glass rounded-xl p-4 sm:p-5 border border-accent/30 bg-gradient-to-br from-accent/5 to-primary/5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-accent" />
          <h3 className="font-display font-bold text-foreground text-sm sm:text-base">
            Your referral impact
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* This month */}
          <div className="rounded-lg border border-border/40 bg-surface/40 p-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-emerald-300 inline-flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> This month
            </p>
            <p className="text-sm text-foreground">
              <span className="font-display font-bold text-lg">{stats.mLeads}</span>
              <span className="text-muted-foreground"> leads → </span>
              <span className="font-display font-bold text-lg">{stats.mBookings}</span>
              <span className="text-muted-foreground"> bookings → </span>
              <span className="font-display font-bold text-lg text-emerald-300">{stats.mConverted}</span>
              <span className="text-muted-foreground"> converted</span>
            </p>
            {showCommission && (
              <p className="text-xs text-accent">
                Commission earned: <span className="font-semibold">{formatNaira(monthCommission)}</span>
              </p>
            )}
          </div>

          {/* Lifetime */}
          <div className="rounded-lg border border-border/40 bg-surface/40 p-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
              <Users className="w-3 h-3" /> Lifetime
            </p>
            <p className="text-sm text-foreground">
              <span className="font-display font-bold text-lg">{stats.lLeads}</span>
              <span className="text-muted-foreground"> leads → </span>
              <span className="font-display font-bold text-lg">{stats.lBookings}</span>
              <span className="text-muted-foreground"> bookings → </span>
              <span className="font-display font-bold text-lg text-foreground">{stats.lConverted}</span>
              <span className="text-muted-foreground"> converted</span>
            </p>
            {showCommission && (
              <p className="text-xs text-accent">
                Total earned: <span className="font-semibold">{formatNaira(lifetimeCommission)}</span>
              </p>
            )}
          </div>
        </div>

        {!showCommission && (
          <p className="text-[11px] text-muted-foreground mt-3 italic">
            Commission tracking is currently off. Once admin turns it on, your earnings will appear here.
          </p>
        )}
      </div>
    </div>
  );
};

export default MyReferralsPanel;