import { useMemo } from 'react';
import { format, subDays, startOfDay } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useStaffDrilldown } from '@/hooks/useAnalytics';
import { formatNaira } from '@/lib/finance';
import {
  Users, TrendingUp, CalendarDays, Wallet, MessageSquare, Activity,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

interface Props {
  staffId: string | null;
  staffName?: string | null;
  staffEmail?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_TONE: Record<string, string> = {
  completed: 'bg-green-500/15 text-green-400 border-green-500/30',
  scheduled: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  cancelled: 'bg-destructive/15 text-destructive border-destructive/30',
  no_show: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  arrived: 'bg-primary/15 text-primary border-primary/30',
};

const StaffDrilldownSheet = ({ staffId, staffName, staffEmail, open, onOpenChange }: Props) => {
  const { data, isLoading } = useStaffDrilldown(staffId);

  // 30-day revenue trend for this staff member (income only)
  const revenueChart = useMemo(() => {
    if (!data) return [];
    const cutoff = startOfDay(subDays(new Date(), 30));
    const byDate = new Map<string, number>();
    for (const f of data.finance) {
      if (f.kind !== 'revenue' && f.kind !== 'income') continue;
      const d = startOfDay(new Date(f.date));
      if (d < cutoff) continue;
      byDate.set(f.date, (byDate.get(f.date) ?? 0) + Number(f.amount));
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, amount]) => ({
        date,
        label: format(new Date(date), 'd MMM'),
        amount,
      }));
  }, [data]);

  const totals = useMemo(() => {
    if (!data) return { revenue: 0, leads: 0, conversions: 0, appts: 0, outreach: 0 };
    return {
      revenue: data.conversions.reduce((s, c) => s + Number(c.amount ?? 0), 0),
      leads: data.leads.length,
      conversions: data.conversions.length,
      appts: data.appointments.filter((a) => a.status === 'completed').length,
      outreach: data.outreach.length,
    };
  }, [data]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-hidden flex flex-col p-0 bg-card/95 backdrop-blur-xl border-border/40"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
          <SheetTitle className="font-display text-xl text-foreground">
            {staffName || staffEmail || 'Staff member'}
          </SheetTitle>
          <SheetDescription className="text-xs">
            Lifetime activity attributed to this staff member.
          </SheetDescription>

          {/* Compact KPI strip */}
          <div className="grid grid-cols-5 gap-2 pt-3">
            <MiniStat icon={Users} label="Leads" value={totals.leads} />
            <MiniStat icon={TrendingUp} label="Conv." value={totals.conversions} />
            <MiniStat icon={CalendarDays} label="Appts" value={totals.appts} />
            <MiniStat icon={MessageSquare} label="Reach" value={totals.outreach} />
            <MiniStat icon={Wallet} label="Revenue" value={formatNaira(totals.revenue)} small />
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-4">
            {/* Revenue trend (30d) */}
            <div className="rounded-lg bg-surface/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-display font-semibold text-foreground">Revenue (30d)</h3>
              </div>
              {revenueChart.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">No revenue recorded.</p>
              ) : (
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={revenueChart}>
                    <defs>
                      <linearGradient id="staffRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tickFormatter={(v) => `₦${Math.round(v / 1000)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '11px',
                      }}
                      formatter={(v: number) => formatNaira(v)}
                    />
                    <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#staffRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <Tabs defaultValue="leads" className="w-full">
              <TabsList className="w-full grid grid-cols-4 h-9">
                <TabsTrigger value="leads" className="text-xs">Leads</TabsTrigger>
                <TabsTrigger value="conversions" className="text-xs">Conversions</TabsTrigger>
                <TabsTrigger value="appointments" className="text-xs">Appts</TabsTrigger>
                <TabsTrigger value="outreach" className="text-xs">Outreach</TabsTrigger>
              </TabsList>

              <TabsContent value="leads" className="mt-3">
                {isLoading ? (
                  <EmptyRow text="Loading…" />
                ) : !data?.leads.length ? (
                  <EmptyRow text="No attributed leads yet." />
                ) : (
                  <div className="space-y-1.5">
                    {data.leads.map((l) => (
                      <Row key={l.id}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground truncate">{l.full_name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {(l.source_type ?? '—').replace(/[-_]+/g, ' ')} · {format(new Date(l.created_at), 'd MMM yyyy')}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                          {l.status.replace(/_/g, ' ')}
                        </Badge>
                      </Row>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="conversions" className="mt-3">
                {isLoading ? (
                  <EmptyRow text="Loading…" />
                ) : !data?.conversions.length ? (
                  <EmptyRow text="No conversions yet." />
                ) : (
                  <div className="space-y-1.5">
                    {data.conversions.map((c) => (
                      <Row key={c.id}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground truncate">
                            {c.service || c.conversion_type}
                            {c.membership_tier && (
                              <span className="ml-2 text-[10px] uppercase tracking-wider text-accent">
                                {c.membership_tier}
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(c.converted_at), 'd MMM yyyy')}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-foreground tabular-nums">
                          {formatNaira(Number(c.amount ?? 0))}
                        </span>
                      </Row>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="appointments" className="mt-3">
                {isLoading ? (
                  <EmptyRow text="Loading…" />
                ) : !data?.appointments.length ? (
                  <EmptyRow text="No appointments yet." />
                ) : (
                  <div className="space-y-1.5">
                    {data.appointments.map((a) => (
                      <Row key={a.id}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground truncate">{a.treatment}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(a.date), 'd MMM yyyy')} · {a.time}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase tracking-wider ${STATUS_TONE[a.status] ?? ''}`}
                        >
                          {a.status.replace(/_/g, ' ')}
                        </Badge>
                      </Row>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="outreach" className="mt-3">
                {isLoading ? (
                  <EmptyRow text="Loading…" />
                ) : !data?.outreach.length ? (
                  <EmptyRow text="No outreach activity yet." />
                ) : (
                  <div className="space-y-1.5">
                    {data.outreach.map((o) => (
                      <Row key={o.id}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground truncate">
                            {o.template_category || 'Outreach'}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(o.created_at), 'd MMM yyyy, HH:mm')}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                          {o.status}
                        </Badge>
                      </Row>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

const MiniStat = ({
  icon: Icon,
  label,
  value,
  small,
}: {
  icon: any;
  label: string;
  value: number | string;
  small?: boolean;
}) => (
  <div className="rounded-md bg-surface/60 px-2 py-1.5 flex flex-col items-start gap-0.5">
    <div className="flex items-center gap-1 text-muted-foreground">
      <Icon className="w-3 h-3" />
      <span className="text-[9px] uppercase tracking-wider">{label}</span>
    </div>
    <span className={`font-display font-bold text-foreground tabular-nums truncate w-full ${small ? 'text-xs' : 'text-sm'}`}>
      {value}
    </span>
  </div>
);

const Row = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-surface/40 hover:bg-surface/70 transition-colors">
    {children}
  </div>
);

const EmptyRow = ({ text }: { text: string }) => (
  <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
    <Activity className="w-3.5 h-3.5 mr-2 opacity-50" />
    {text}
  </div>
);

export default StaffDrilldownSheet;