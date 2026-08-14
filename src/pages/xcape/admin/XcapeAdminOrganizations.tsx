import { Helmet } from 'react-helmet-async';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Check, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAllOrganizations, type Organization } from '@/hooks/useXcapeOrg';

/* eslint-disable @typescript-eslint/no-explicit-any */

const statusTone = (s: Organization['status']) =>
  s === 'active' ? 'bg-primary/15 text-primary' :
  s === 'suspended' ? 'bg-destructive/15 text-destructive' :
  'bg-amber-500/15 text-amber-500';

/**
 * Partner locations. Approving a CDP application activates the organisation
 * and its members — no client, assessment or order data is ever moved.
 */
const XcapeAdminOrganizations = () => {
  const qc = useQueryClient();
  const { data: organizations, isLoading } = useAllOrganizations();

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
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not update partner'),
  });


  const rows = organizations ?? [];

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto space-y-5">
      <Helmet>
        <title>Partner Locations — XCAPE</title>
      </Helmet>
      <XcapePageHeader
        title="Partner Locations"
        description="Certified Distribution Partners, their approval status and their fulfilment scope."
      />

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
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`text-[10px] border-0 capitalize ${statusTone(o.status)}`}>{o.status}</Badge>
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default XcapeAdminOrganizations;
