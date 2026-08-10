import { useMemo, useState, Fragment } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Info,
  ShieldCheck,
  Search,
  RefreshCw,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { formatNaira } from '@/lib/finance';
import {
  useOperationalTruthShadow,
  type IntegrityState,
  type OperationalTruthRow,
} from '@/hooks/useOperationalTruthShadow';

const INTEGRITY_VARIANT: Record<IntegrityState, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  complete: 'default',
  information_missing: 'secondary',
  conflicting_information: 'destructive',
  needs_staff_review: 'destructive',
  corrected: 'outline',
  legacy_unverified: 'outline',
};

const INTEGRITY_LABEL: Record<IntegrityState, string> = {
  complete: 'Complete',
  information_missing: 'Info missing',
  conflicting_information: 'Conflicting',
  needs_staff_review: 'Review',
  corrected: 'Corrected',
  legacy_unverified: 'Legacy',
};

const WARN_LABELS: Record<string, string> = {
  WARN_NO_SIGNOUT: 'Visit never signed out',
  WARN_MISSING_PRACTITIONER: 'No practitioner assigned',
  WARN_MONEY_WITHOUT_LINES: 'Money received but no lines recorded',
  WARN_LINES_WITHOUT_MONEY_NOT_PREPAID: 'Lines recorded, no money and no prior credit',
  WARN_OUTSTANDING_BALANCE: 'Balance outstanding after sign-out',
  WARN_HAS_REMOVED_LINES: 'Some visit lines were removed',
};

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : '—');
const fmtDT   = (d?: string | null) => (d ? new Date(d).toLocaleString() : '—');

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-4 text-sm py-1">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-medium">{value ?? '—'}</span>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-lg border border-border/50 bg-muted/10 p-3">
    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
    <div className="divide-y divide-border/30">{children}</div>
  </div>
);

const RowDetails = ({ r }: { r: OperationalTruthRow }) => (
  <div className="grid gap-3 md:grid-cols-2">
    <Section title="Identity">
      <Row label="Client" value={r.client_name} />
      <Row label="Phone" value={r.client_phone} />
      <Row label="Email" value={r.client_email} />
      <Row label="Location" value={r.client_location} />
    </Section>

    <Section title="Visit evidence">
      <Row label="Reason" value={r.visit_reason} />
      <Row label="Outcome" value={r.visit_outcome} />
      <Row label="Status" value={r.visit_status} />
      <Row label="Sign in" value={fmtDT(r.sign_in_time)} />
      <Row label="Sign out" value={fmtDT(r.sign_out_time)} />
      <Row label="Duration" value={r.duration_minutes ? `${r.duration_minutes} min` : '—'} />
    </Section>

    <Section title="Clinical evidence">
      <Row label="Practitioner" value={r.practitioner_id ?? '—'} />
      <Row label="Signed-in by" value={r.signed_in_by_staff_id ?? '—'} />
      <Row label="Signed-out by" value={r.signed_out_by_staff_id ?? '—'} />
      <Row label="Treatments delivered" value={`${r.treatment_count} · ${formatNaira(r.treatment_value)}`} />
      <Row label="Products sold" value={`${r.product_count} · ${formatNaira(r.product_value)}`} />
      <Row label="Complimentary" value={r.complimentary_count > 0
        ? `${r.complimentary_count} · ${formatNaira(r.complimentary_value)}`
        : '—'} />
    </Section>

    <Section title="Financial evidence">
      <Row label="Standard value" value={formatNaira(r.standard_value)} />
      <Row label="Explicit discount" value={r.explicit_discount_value > 0 ? formatNaira(r.explicit_discount_value) : '—'} />
      <Row label="Prior credit used" value={r.prior_credit_used > 0 ? formatNaira(r.prior_credit_used) : '—'} />
      <Row label="New money received" value={formatNaira(r.new_money_received)} />
      <Row label="Outstanding" value={r.outstanding_amount != null ? formatNaira(r.outstanding_amount) : '—'} />
      <Row label="Payment method" value={r.payment_method} />
      <Row label="Payment status" value={r.payment_status} />
      <Row label="Visit total (final)" value={r.visit_final_total != null ? formatNaira(r.visit_final_total) : '—'} />
    </Section>

    <Section title="Treatment plan state">
      <Row label="Next planned date" value={fmtDate(r.next_schedule_date)} />
      <Row label="Next schedule item" value={r.next_schedule_item_id ?? '—'} />
    </Section>

    <Section title="Appointment / follow-up">
      <Row label="Next appointment" value={r.next_appointment_id
        ? `${fmtDate(r.next_appointment_date)} ${r.next_appointment_time ?? ''}`
        : '—'} />
      <Row label="Status" value={r.next_appointment_status} />
      <Row label="Treatment" value={r.next_appointment_treatment} />
    </Section>

    <Section title="Live report status">
      <Row label="Report available" value={r.report_available ? 'Yes' : 'No'} />
      <Row label="Report created" value={fmtDT(r.report_created_at)} />
    </Section>

    <Section title="Missing facts & warnings">
      {(r.warnings ?? []).length === 0 ? (
        <div className="text-sm text-muted-foreground py-1">No warnings.</div>
      ) : (
        <ul className="space-y-1.5 py-1">
          {(r.warnings ?? []).map((w) => (
            <li key={w} className="flex items-start gap-2 text-sm">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-amber-500 shrink-0" />
              <span>
                <span className="font-mono text-[11px] text-muted-foreground mr-1">{w}</span>
                {WARN_LABELS[w] ?? w}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>

    <Section title="Source / provenance">
      <Row label="Op id" value={<span className="font-mono text-xs">{r.op_id}</span>} />
      <Row label="Provenance" value={r.op_provenance} />
      <Row label="Visit id" value={<span className="font-mono text-xs">{r.visit_id}</span>} />
      <Row label="Amended" value={fmtDT(r.amended_at)} />
      <Row label="Amendment reason" value={r.amendment_reason} />
      <Row label="Removed" value={fmtDT(r.removed_at)} />
    </Section>
  </div>
);

const OperationalTruthShadow = () => {
  const [search, setSearch]     = useState('');
  const [outcome, setOutcome]   = useState<string>('');
  const [integrity, setIntegrity] = useState<string>('');
  const [warning, setWarning]   = useState<string>('');
  const [from, setFrom]         = useState<string>('');
  const [to, setTo]             = useState<string>('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [mobileRow, setMobileRow] = useState<OperationalTruthRow | null>(null);

  const { data = [], isLoading, refetch, isFetching } = useOperationalTruthShadow({
    from: from || null,
    to: to || null,
    outcome: outcome || null,
    integrity: (integrity || null) as IntegrityState | null,
    warningCode: warning || null,
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return data;
    return data.filter((r) =>
      [r.client_name, r.client_phone, r.client_email, r.visit_id]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(s)),
    );
  }, [data, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
        <ShieldCheck className="w-4 h-4 mt-0.5 text-primary shrink-0" />
        <div className="space-y-0.5">
          <div className="font-semibold">Shadow view: this page does not change financial or clinical records.</div>
          <div className="text-xs text-muted-foreground">
            Every row is projected live from existing visit, finance, treatment-plan and inventory tables.
            Warnings and integrity flags surface gaps for review only — no correction happens here.
          </div>
        </div>
      </div>

      <Card className="p-3 grid grid-cols-2 md:grid-cols-6 gap-2">
        <div className="col-span-2 md:col-span-2 flex items-center gap-2 border border-border/40 rounded-md px-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client, phone, email…"
            className="border-0 shadow-none focus-visible:ring-0 px-0 h-9"
          />
        </div>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
        <Input type="date" value={to}   onChange={(e) => setTo(e.target.value)}   className="h-9" />
        <Select value={outcome || 'any'} onValueChange={(v) => setOutcome(v === 'any' ? '' : v)}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Outcome" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any outcome</SelectItem>
            <SelectItem value="completed_consultation">Consultation</SelectItem>
            <SelectItem value="booked_appointment">Booked</SelectItem>
            <SelectItem value="treatment_completed">Treatment completed</SelectItem>
            <SelectItem value="purchased_product">Purchased product</SelectItem>
            <SelectItem value="no_conversion">No conversion</SelectItem>
            <SelectItem value="follow_up_required">Follow-up required</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Select value={integrity || 'any'} onValueChange={(v) => setIntegrity(v === 'any' ? '' : v)}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Integrity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any integrity</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
            <SelectItem value="information_missing">Info missing</SelectItem>
            <SelectItem value="conflicting_information">Conflicting</SelectItem>
            <SelectItem value="needs_staff_review">Needs review</SelectItem>
            <SelectItem value="corrected">Corrected</SelectItem>
            <SelectItem value="legacy_unverified">Legacy</SelectItem>
          </SelectContent>
        </Select>
        <Select value={warning || 'any'} onValueChange={(v) => setWarning(v === 'any' ? '' : v)}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Warning" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any warning</SelectItem>
            {Object.keys(WARN_LABELS).map((w) => (
              <SelectItem key={w} value={w}>{WARN_LABELS[w]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="col-span-2 md:col-span-1">
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </Card>

      <Card className="overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-6"></th>
                <th className="text-left px-3 py-2">Date / time</th>
                <th className="text-left px-3 py-2">Client</th>
                <th className="text-left px-3 py-2">Outcome</th>
                <th className="text-right px-3 py-2">Treatments</th>
                <th className="text-right px-3 py-2">Products</th>
                <th className="text-right px-3 py-2">Credit used</th>
                <th className="text-right px-3 py-2">New money</th>
                <th className="text-left px-3 py-2">Next step</th>
                <th className="text-left px-3 py-2">Integrity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading && (
                <tr><td colSpan={10} className="text-center p-6 text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={10} className="text-center p-6 text-muted-foreground">No visits match these filters.</td></tr>
              )}
              {filtered.map((r) => {
                const open = expanded === r.op_id;
                return (
                  <Fragment key={r.op_id}>
                    <tr
                      className="hover:bg-muted/20 cursor-pointer"
                      onClick={() => setExpanded(open ? null : r.op_id)}
                    >
                      <td className="px-2">
                        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div>{fmtDate(r.visit_date)}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.sign_in_time ? new Date(r.sign_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.client_name ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">{r.client_phone ?? ''}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{r.visit_outcome ?? r.visit_status}</td>
                      <td className="px-3 py-2 text-right">
                        <div>{r.treatment_count}</div>
                        <div className="text-xs text-muted-foreground">{r.treatment_value ? formatNaira(r.treatment_value) : '—'}</div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div>{r.product_count}</div>
                        <div className="text-xs text-muted-foreground">{r.product_value ? formatNaira(r.product_value) : '—'}</div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.prior_credit_used > 0 ? formatNaira(r.prior_credit_used) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.new_money_received > 0 ? formatNaira(r.new_money_received) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.next_appointment_id ? (
                          <span>Appt {fmtDate(r.next_appointment_date)}</span>
                        ) : r.next_schedule_date ? (
                          <span>Plan {fmtDate(r.next_schedule_date)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={INTEGRITY_VARIANT[r.integrity_state]} className="capitalize">
                          {INTEGRITY_LABEL[r.integrity_state]}
                        </Badge>
                        {(r.warnings?.length ?? 0) > 0 && (
                          <span className="ml-1 inline-flex items-center text-amber-500" title={r.warnings!.join(', ')}>
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-muted/10">
                        <td colSpan={10} className="p-4">
                          <RowDetails r={r} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile list */}
        <div className="md:hidden divide-y divide-border/40">
          {filtered.map((r) => (
            <button
              key={r.op_id}
              onClick={() => setMobileRow(r)}
              className="w-full text-left p-3 flex items-center justify-between gap-3 hover:bg-muted/10"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{r.client_name ?? '—'}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {fmtDate(r.visit_date)} · {r.visit_outcome ?? r.visit_status}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm">
                  {r.new_money_received > 0 ? formatNaira(r.new_money_received) : '—'}
                </div>
                <Badge variant={INTEGRITY_VARIANT[r.integrity_state]} className="capitalize text-[10px]">
                  {INTEGRITY_LABEL[r.integrity_state]}
                </Badge>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="p-6 text-center text-muted-foreground text-sm">No visits.</div>
          )}
        </div>
      </Card>

      <Sheet open={!!mobileRow} onOpenChange={(o) => !o && setMobileRow(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{mobileRow?.client_name ?? 'Visit'}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">{mobileRow && <RowDetails r={mobileRow} />}</div>
        </SheetContent>
      </Sheet>

      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <Info className="w-3 h-3" />
        Showing up to 200 most recent visits. Refine filters to narrow results.
      </div>
    </div>
  );
};

export default OperationalTruthShadow;