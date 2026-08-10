import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePendingRewards, useApproveReward, useRejectReward } from '@/hooks/useOutreachSessions';
import { useRealStaff } from '@/hooks/useRealStaff';
import { Coins } from 'lucide-react';

const fmt = (n: number) => `₦${Number(n || 0).toLocaleString()}`;

const OutreachRewardsQueue = () => {
  const { data: rewards = [] } = usePendingRewards();
  const { data: staff = [] } = useRealStaff();
  const approve = useApproveReward();
  const reject = useRejectReward();
  const map = new Map(staff.map((s) => [s.id, s.full_name]));

  if (rewards.length === 0) return null;

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Coins className="w-4 h-4 text-accent" />
        <h3 className="font-display font-bold">Outreach Rewards · Pending Approval</h3>
        <Badge variant="outline">{rewards.length}</Badge>
      </div>
      <div className="space-y-2">
        {rewards.map((r: any) => (
          <div key={r.id} className="flex items-center justify-between border border-border/40 rounded-md p-3 text-sm">
            <div>
              <div className="font-semibold">{map.get(r.beneficiary_staff_id) ?? r.beneficiary_staff_id}</div>
              <div className="text-xs text-muted-foreground">
                {r.outreach_sessions?.name ?? 'Outreach'} · {Number(r.percent).toFixed(2)}% of net (basis {fmt(r.basis_amount)})
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right font-semibold">{fmt(r.amount)}</div>
              <Button size="sm" onClick={() => approve.mutate({ id: r.id, outreach_id: r.outreach_id })}>Approve & post</Button>
              <Button size="sm" variant="ghost" onClick={() => reject.mutate({ id: r.id, outreach_id: r.outreach_id })}>Reject</Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default OutreachRewardsQueue;