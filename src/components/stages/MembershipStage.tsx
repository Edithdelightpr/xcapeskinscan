import { useAppStore } from '@/store/appStore';
import { useRealClient, useUpdateRealClient } from '@/hooks/useRealClients';
import { useCurrentClientId } from '@/hooks/useCurrentClientId';
import { recordConversionRevenue } from '@/hooks/useFinanceEntries';
import { Button } from '@/components/ui/button';
import { Crown, Star, Sparkles } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';
import { useClientMedia, useUploadClientMedia } from '@/hooks/useClientMedia';
import { generateAndUploadClientReport } from '@/lib/clientReportPdf';
import { toast } from 'sonner';
import { useSendDocumentDelivery } from '@/hooks/useDocumentDeliveries';

type Membership = Database['public']['Enums']['membership_type'];
type ClientStatus = Database['public']['Enums']['client_status'];

const formatNaira = (n: number) => `₦${n.toLocaleString()}`;

const tiers = [
  {
    key: 'regular' as const,
    label: 'Regular Client',
    price: null as number | null,
    discount: 0,
    icon: Star,
    features: ['Pay per treatment', 'No discount', 'Standard booking'],
    recommended: false,
  },
  {
    key: 'member' as const,
    label: 'Member',
    price: 100000,
    discount: 10,
    icon: Crown,
    features: ['10% discount on all treatments', 'Priority booking', 'Monthly skin check-in'],
    recommended: true,
  },
  {
    key: 'elite' as const,
    label: 'Elite Member',
    price: 500000,
    discount: 20,
    icon: Sparkles,
    features: ['20% discount on all treatments', 'Full priority access', 'Free monthly reviews', 'Exclusive products'],
    recommended: false,
  },
];

const MembershipStage = () => {
  const { completeStage, setActiveStage } = useAppStore();
  const [currentId] = useCurrentClientId();
  const { data: client } = useRealClient(currentId ?? undefined);
  const updateMut = useUpdateRealClient();
  const uploadMediaMut = useUploadClientMedia();
  const { data: clientMedia = [] } = useClientMedia(currentId ?? undefined);
  const sendDeliveryMut = useSendDocumentDelivery();

  const plan = (client?.treatment_plan ?? null) as
    | { totalCost?: number; treatments?: { enabled: boolean; name: string }[] }
    | null;
  const totalCost = plan?.totalCost ?? 0;
  const membershipDb: Membership = client?.membership_type ?? 'none';

  const isSelected = (key: 'regular' | 'member' | 'elite') =>
    (key === 'regular' && membershipDb === 'one_time') ||
    (key !== 'regular' && membershipDb === key);

  const selectTier = async (tier: 'regular' | 'member' | 'elite') => {
    if (!client) return;
    const tierMeta = tiers.find((t) => t.key === tier)!;
    const amount = tier === 'regular' ? totalCost : (tierMeta.price ?? 0);
    const dbMembership: Membership =
      tier === 'regular' ? 'one_time' : tier === 'member' ? 'member' : 'elite';
    const newStatus: ClientStatus = tier === 'regular' ? 'converted' : tier;

    await updateMut.mutateAsync({
      id: client.id,
      patch: { membership_type: dbMembership, status: newStatus },
    });

    if (amount > 0 && client.attributed_staff_id) {
      void recordConversionRevenue({
        staffUserId: client.attributed_staff_id,
        amount,
        category: tier === 'regular' ? 'treatment-revenue' : 'membership',
        notes: `Conversion: ${client.full_name} · ${tierMeta.label}`,
        sourceClientId: client.id,
      });
    }

    // Generate & store branded PDF report (best-effort, non-blocking for stage advance)
    const reportToast = toast.loading('Generating report…');
    try {
      const fresh = { ...client, membership_type: dbMembership, status: newStatus };
      const reportRow = await generateAndUploadClientReport({
        client: fresh,
        tier,
        paymentAmount: amount,
        paymentCategory: tier === 'regular' ? 'treatment-revenue' : 'membership',
        uploadFn: uploadMediaMut.mutateAsync,
        photos: clientMedia,
      });
      toast.success('Report saved to profile', { id: reportToast });

      // Queue WhatsApp delivery to the client's phone (simulated until provider is connected)
      try {
        const delivery = await sendDeliveryMut.mutateAsync({
          clientId: client.id,
          mediaId: reportRow.id,
          phoneNumber: client.phone,
        });
        if (delivery.status === 'failed') {
          toast.error(delivery.error_message ?? 'WhatsApp send failed');
        } else if (delivery.status === 'simulated') {
          toast.success('Report queued for WhatsApp (simulated)');
        } else {
          toast.success('Report queued for WhatsApp delivery');
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'WhatsApp logging failed');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Report failed', { id: reportToast });
    }

    completeStage(3);
    setActiveStage(4);
  };

  return (
    <div className="animate-slide-up space-y-6">
      <h2 className="text-2xl font-display font-bold text-foreground">Membership Tiers</h2>
      <p className="text-sm text-muted-foreground">
        Select a plan for <span className="text-foreground font-medium">{client?.full_name ?? '…'}</span>
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {tiers.map((tier) => {
          const Icon = tier.icon;
          const discountedTotal = totalCost * (1 - tier.discount / 100);
          const selected = isSelected(tier.key);

          return (
            <button
              key={tier.key}
              onClick={() => selectTier(tier.key)}
              disabled={updateMut.isPending}
              className={`glass rounded-xl p-6 text-left transition-all duration-500 relative group ${
                selected ? 'border-primary glow-primary' : tier.recommended ? 'border-accent/40' : ''
              }`}
            >
              {tier.recommended && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-semibold bg-accent text-accent-foreground uppercase tracking-wider">
                  Recommended
                </span>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  tier.key === 'elite' ? 'bg-accent/20' : 'bg-primary/15'
                }`}>
                  <Icon className={`w-5 h-5 ${tier.key === 'elite' ? 'text-accent-foreground' : 'text-primary'}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{tier.label}</h3>
                  {tier.price && (
                    <p className="text-xs text-muted-foreground">{formatNaira(tier.price)}/month</p>
                  )}
                </div>
              </div>

              <ul className="space-y-2 mb-5">
                {tier.features.map((f) => (
                  <li key={f} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    {f}
                  </li>
                ))}
              </ul>

              {totalCost > 0 && (
                <div className="pt-3 border-t border-border/30">
                  <p className="text-xs text-muted-foreground">Plan cost under this tier</p>
                  <p className="text-lg font-display font-bold text-foreground">
                    {formatNaira(discountedTotal)}
                    {tier.discount > 0 && (
                      <span className="text-xs font-normal text-primary ml-2">-{tier.discount}%</span>
                    )}
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {updateMut.isPending && (
        <p className="text-xs text-muted-foreground italic">Saving membership choice to cloud…</p>
      )}
    </div>
  );
};

export default MembershipStage;