import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Check, Ban, BadgeDollarSign, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAllOrganizations, type Organization } from '@/hooks/useXcapeOrg';
import { useXcapeAdminSettings } from '@/hooks/useXcapeAuthorization';
import { formatFee } from '@/lib/xcapeAuthorization';

/* eslint-disable @typescript-eslint/no-explicit-any */

const statusTone = (s: Organization['status']) =>
  s === 'active' ? 'bg-primary/15 text-primary' :
  s === 'suspended' ? 'bg-destructive/15 text-destructive' :
  'bg-amber-500/15 text-amber-500';

const feeTone = (s: Organization['cdp_fee_status']) =>
  s === 'paid' || s === 'waived' ? 'bg-primary/15 text-primary' : 'bg-amber-500/15 text-amber-500';

/**
 * Partner locations. Approving a CDP application activates the organisation
 * and its members; recording the activation fee is what finally unlocks the
 * scanner. Both states are enforced server-side — no client data is ever moved.
 */
const XcapeAdminOrganizations = () => {
  const qc = useQueryClient();
  const { data: organizations, isLoading } = useAllOrganizations();
  const { data: settings } = useXcapeAdminSettings();

  const [split, setSplit] = useState('');
  const [fee, setFee] = useState('');
  useEffect(() => {
    if (settings) {
      setSplit(String(settings.affiliate_split_percentage));
      setFee(String(settings.cdp_required_fee));
    }
  }, [settings]);

  const setStatus = useMutation({
    mutationFn: async (input: { id: string; status: Organization['status'] }) => {
      // One admin-only RPC keeps org status, membership status and the partner's
      // own account activation in step — approving here is what actually lets a
      // reviewed CDP past the "under review" screen.
      const { error } = await (supabase as any).rpc('set_xcape_partner_status', {
        _org_id: input.id,
        _status: input.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Partner location updated');
      qc.invalidateQueries({ queryKey: ['organizations', 'all'] });
      qc.invalidateQueries({ queryKey: ['my-organization'] });
      qc.invalidateQueries({ queryKey: ['xcape-authorization'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not update partner'),
  });

  const setFeeStatus = useMutation({
    mutationFn: async (input: { id: string; status: 'unpaid' | 'paid' | 'waived' }) => {
      const { error } = await (supabase as any).rpc('set_cdp_fee_status', {
        _org_id: input.id,
        _status: input.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Activation fee updated');
      qc.invalidateQueries({ queryKey: ['organizations', 'all'] });
      qc.invalidateQueries({ queryKey: ['xcape-authorization'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not record the fee'),
  });

  const saveSettings = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc('set_xcape_admin_settings', {
        _affiliate_split_percentage: Number(split),
        _cdp_required_fee: Number(fee),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('XCAPE settings saved');
      qc.invalidateQueries({ queryKey: ['xcape-admin-settings'] });
      qc.invalidateQueries({ queryKey: ['xcape-authorization'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not save settings'),
  });

  const rows = organizations ?? [];

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto space-y-5">
      <Helmet>
        <title>Partner Locations — XCAPE</title>
      </Helmet>
      <XcapePageHeader
        title="Partner Locations"
        description="Certified Distribution Partners, their approval status, activation fee and fulfilment scope."
      />

      {/* Admin-only network settings. Percentage changes apply to FUTURE orders
          only — every order snapshots the split it was created with. */}
      <section className="glass rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <BadgeDollarSign className="w-4 h-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold text-foreground">Network settings</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="affiliate-split" className="text-xs uppercase tracking-wider text-muted-foreground">
              Affiliate split (%)
            </Label>
            <Input
              id="affiliate-split"
              inputMode="decimal"
              className="bg-surface border-border/60 min-h-[44px]"
              value={split}
              onChange={(e) => setSplit(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Applied to new affiliate-origin orders only. Past payouts keep the percentage they were created with.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cdp-fee" className="text-xs uppercase tracking-wider text-muted-foreground">
              Partner activation fee (₦)
            </Label>
            <Input
              id="cdp-fee"
              inputMode="decimal"
              className="bg-surface border-border/60 min-h-[44px]"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              A partner location unlocks the scanner once it is approved and this fee is recorded as paid.
            </p>
          </div>
        </div>
        <Button
          className="min-h-[44px]"
          disabled={saveSettings.isPending || !split || !fee}
          onClick={() => saveSettings.mutate()}
        >
          <Save className="w-4 h-4 mr-2" /> Save settings
        </Button>
      </section>

      {isLoading && <div className="glass rounded-xl p-8 text-sm text-muted-foreground">Loading…</div>}

      {!isLoading && rows.length === 0 && (
        <div className="glass rounded-xl p-10 text-center space-y-2">
          <Building2 className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No organisations yet.</p>
        </div>
      )}

      <div className="space-y-2">
        {rows.map((o) => (
          <div key={o.id} className="glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate">{o.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {o.kind === 'xcape_root' ? 'XCAPE head office' : o.location || 'Location not provided'}
                {o.contact_email ? ` · ${o.contact_email}` : ''}
              </p>
              {o.kind === 'cdp' && (o.cdp_fee_status === 'paid' || o.cdp_fee_status === 'waived') && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Fee {o.cdp_fee_status}
                  {o.cdp_fee_amount_paid ? ` · ${formatFee(Number(o.cdp_fee_amount_paid))}` : ''}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`text-[10px] border-0 capitalize ${statusTone(o.status)}`}>{o.status}</Badge>
              {o.kind === 'cdp' && (
                <Badge className={`text-[10px] border-0 capitalize ${feeTone(o.cdp_fee_status)}`}>
                  fee {o.cdp_fee_status ?? 'unpaid'}
                </Badge>
              )}
              {o.kind === 'cdp' && o.status !== 'active' && (
                <Button
                  size="sm"
                  disabled={setStatus.isPending}
                  onClick={() => setStatus.mutate({ id: o.id, status: 'active' })}
                >
                  <Check className="w-3.5 h-3.5 mr-1.5" /> Approve
                </Button>
              )}
              {o.kind === 'cdp' && o.status === 'active' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={setStatus.isPending}
                  onClick={() => setStatus.mutate({ id: o.id, status: 'suspended' })}
                >
                  <Ban className="w-3.5 h-3.5 mr-1.5" /> Suspend
                </Button>
              )}
              {o.kind === 'cdp' && o.cdp_fee_status !== 'paid' && o.cdp_fee_status !== 'waived' && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={setFeeStatus.isPending}
                  onClick={() => setFeeStatus.mutate({ id: o.id, status: 'paid' })}
                >
                  Mark fee paid
                </Button>
              )}
              {o.kind === 'cdp' && (o.cdp_fee_status === 'paid' || o.cdp_fee_status === 'waived') && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={setFeeStatus.isPending}
                  onClick={() => setFeeStatus.mutate({ id: o.id, status: 'unpaid' })}
                >
                  Clear fee
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default XcapeAdminOrganizations;
