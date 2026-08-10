import { useState } from 'react';
import { useAppStore, TODAY } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Activity } from 'lucide-react';
import { useViewedStaffId } from '@/hooks/useViewedStaffId';
import { useDailyOpsMetrics } from '@/hooks/useDailyOpsMetrics';
import { formatNaira } from '@/lib/finance';

const RoleEOD = () => {
  const {
    staff, eodReports, submitEOD, routineInstances, routineTemplates, jobRoles,
  } = useAppStore();
  const activeStaffId = useViewedStaffId() ?? '';
  const [completed, setCompleted] = useState('');
  const [pending, setPending] = useState('');
  const [skipped, setSkipped] = useState('');
  const [issues, setIssues] = useState('');
  const [notes, setNotes] = useState('');
  const [extraAnswers, setExtraAnswers] = useState<Record<string, string>>({});
  const [justSubmitted, setJustSubmitted] = useState(false);

  const staffMember = staff.find((s) => s.id === activeStaffId);
  const assignedJobRole = staffMember?.jobRoleId
    ? jobRoles.find((r) => r.id === staffMember.jobRoleId)
    : undefined;
  const extraFields = assignedJobRole?.reportingFields ?? [];

  // Verified operational truth — derived from DB events, not typed.
  const { data: opsRows = [] } = useDailyOpsMetrics();
  const myOps = opsRows.find((r) => r.staff_user_id === activeStaffId);

  // Auto-summarize today's routine into prefill suggestions
  const todayInstances = routineInstances.filter((i) => i.date === TODAY && i.staffId === activeStaffId);
  const summary = (status: 'completed' | 'pending' | 'skipped') =>
    todayInstances
      .filter((i) => i.status === status)
      .map((i) => routineTemplates.find((t) => t.id === i.templateId)?.title)
      .filter(Boolean)
      .join('; ');

  const prefill = () => {
    setCompleted(summary('completed') || '');
    setPending(summary('pending') || '');
    setSkipped(
      todayInstances
        .filter((i) => i.status === 'skipped')
        .map((i) => {
          const t = routineTemplates.find((tt) => tt.id === i.templateId)?.title;
          return `${t}${i.skipReason ? ` (${i.skipReason})` : ''}`;
        })
        .join('; ')
    );
  };

  const handleSubmit = () => {
    const extraNotes = extraFields
      .map((q) => {
        const a = extraAnswers[q]?.trim();
        return a ? `${q}\n${a}` : '';
      })
      .filter(Boolean)
      .join('\n\n');
    const combinedNotes = [notes.trim(), extraNotes].filter(Boolean).join('\n\n');
    submitEOD({
      date: TODAY,
      staffId: activeStaffId,
      completed,
      pending,
      skipped,
      issues,
      notes: combinedNotes,
    });
    setJustSubmitted(true);
    setExtraAnswers({});
    setTimeout(() => setJustSubmitted(false), 3000);
  };

  const myReports = eodReports.filter((r) => r.staffId === activeStaffId).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">End-of-Day Report</h1>
          <p className="text-sm text-muted-foreground mt-1">{staffMember?.name} · {TODAY}</p>
        </div>
        <Button variant="outline" size="sm" onClick={prefill}>
          Prefill from today's routine
        </Button>
      </div>

      {myOps && (
        <div className="glass rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-display font-bold text-foreground">Today, automatically</h3>
            <span className="text-[10px] text-muted-foreground">— derived from your activity</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            {[
              { label: 'Leads contacted', v: myOps.leads_contacted },
              { label: 'Interactions', v: myOps.interactions_count },
              { label: 'Appts booked', v: myOps.appointments_booked },
              { label: 'Appts completed', v: myOps.appointments_completed },
              { label: 'No-shows', v: myOps.appointments_no_show },
              { label: 'Show-up rate', v: `${myOps.show_up_rate_pct}%` },
              { label: 'Revenue', v: formatNaira(Number(myOps.revenue_attributed)) },
              { label: 'Tasks verified', v: myOps.deliverables_verified },
            ].map((t) => (
              <div key={t.label} className="p-2 rounded-md bg-surface/50">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.label}</p>
                <p className="text-lg font-display font-bold text-foreground">{t.v}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            You don't need to type these — the system already knows. Use the fields below for qualitative notes only.
          </p>
        </div>
      )}

      <div className="glass rounded-xl p-6 space-y-4">
        {[
          { label: 'Completed', value: completed, set: setCompleted, placeholder: 'What got done today...' },
          { label: 'Pending', value: pending, set: setPending, placeholder: 'What still needs attention...' },
          { label: 'Skipped', value: skipped, set: setSkipped, placeholder: 'What was skipped and why...' },
          { label: 'Issues', value: issues, set: setIssues, placeholder: 'Problems encountered...' },
          { label: 'Continuity Notes', value: notes, set: setNotes, placeholder: 'Notes for tomorrow / handover...' },
        ].map((f) => (
          <div key={f.label} className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{f.label}</Label>
            <textarea
              value={f.value}
              onChange={(e) => f.set(e.target.value)}
              placeholder={f.placeholder}
              rows={2}
              className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none"
            />
          </div>
        ))}

        {extraFields.length > 0 && (
          <div className="pt-3 mt-3 border-t border-border/40 space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-primary font-semibold">
              Role-specific reporting · {assignedJobRole?.title}
            </p>
            {extraFields.map((q) => (
              <div key={q} className="space-y-1.5">
                <Label className="text-xs text-foreground">{q}</Label>
                <textarea
                  value={extraAnswers[q] ?? ''}
                  onChange={(e) => setExtraAnswers((s) => ({ ...s, [q]: e.target.value }))}
                  rows={2}
                  className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none"
                />
              </div>
            ))}
          </div>
        )}

        <Button onClick={handleSubmit} className="w-full glow-primary" disabled={justSubmitted}>
          {justSubmitted ? (
            <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Submitted</span>
          ) : (
            'Submit End-of-Day Report'
          )}
        </Button>
      </div>

      {myReports.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-display font-bold text-foreground text-sm">Previous Reports</h3>
          {myReports.slice(0, 5).map((r) => (
            <details key={r.id} className="glass rounded-xl p-4 group">
              <summary className="cursor-pointer flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{r.date}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(r.submittedAt).toLocaleString()}
                </span>
              </summary>
              <div className="mt-3 pt-3 border-t border-border/40 space-y-2 text-xs">
                {r.completed && <p><span className="text-green-400 font-semibold uppercase tracking-wider">Done:</span> <span className="text-foreground">{r.completed}</span></p>}
                {r.pending && <p><span className="text-muted-foreground font-semibold uppercase tracking-wider">Pending:</span> <span className="text-foreground">{r.pending}</span></p>}
                {r.skipped && <p><span className="text-destructive font-semibold uppercase tracking-wider">Skipped:</span> <span className="text-foreground">{r.skipped}</span></p>}
                {r.issues && <p><span className="text-accent-foreground font-semibold uppercase tracking-wider">Issues:</span> <span className="text-foreground">{r.issues}</span></p>}
                {r.notes && <p className="italic text-muted-foreground">{r.notes}</p>}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
};

export default RoleEOD;
