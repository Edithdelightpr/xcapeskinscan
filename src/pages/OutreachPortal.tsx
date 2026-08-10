import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Clock, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import PhoneInput from '@/components/ui/PhoneInput';
import { isValidE164 } from '@/lib/phone';
import { useAuth } from '@/hooks/useAuth';
import {
  useMyAssignedActiveOutreaches, useSlugCaptureLead, useRecentOutreachCaptures,
  type OutreachSession,
} from '@/hooks/useOutreachSessions';
import { toast } from '@/hooks/use-toast';
import { outreachNextAction } from '@/lib/outreachNextAction';

/** Mobile-first portal for field staff to capture leads in real time. */
const OutreachPortal = () => {
  const { data: outreaches = [], isLoading } = useMyAssignedActiveOutreaches();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = outreaches.find((o) => o.id === selectedId) ?? null;

  return (
    <div className="theme-luxe min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <header className="px-4 py-4 max-w-2xl mx-auto flex items-center justify-between">
        <Link to="/admin" className="flex items-center gap-2 text-foreground/80 hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /><span className="text-sm">Admin</span>
        </Link>
        <span className="text-xs text-muted-foreground">Outreach Portal</span>
      </header>

      <main className="px-4 pb-20 max-w-2xl mx-auto space-y-4">
        {!selected ? (
          <>
            <h1 className="font-display text-2xl font-bold">Pick an outreach</h1>
            <p className="text-sm text-muted-foreground">Outreaches you're assigned to that are open today or upcoming.</p>
            {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!isLoading && outreaches.length === 0 && (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                No active outreaches assigned to you. Ask an admin to add you to a crew.
              </Card>
            )}
            <div className="space-y-2">
              {outreaches.map((o) => (
                <button key={o.id} className="block w-full text-left" onClick={() => setSelectedId(o.id)}>
                  <Card className="p-4 hover:border-primary/40 transition flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-display font-bold text-base truncate">{o.name}</div>
                      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{o.outreach_date}</span>
                        {o.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{o.location}</span>}
                        {(o.start_time || o.end_time) && (
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />
                            {o.start_time?.slice(0, 5) ?? '—'}→{o.end_time?.slice(0, 5) ?? '—'}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge className="uppercase text-[10px]">{o.status}</Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </Card>
                </button>
              ))}
            </div>
          </>
        ) : (
          <PortalCapture outreach={selected} onBack={() => setSelectedId(null)} />
        )}
      </main>
    </div>
  );
};

const PortalCapture = ({ outreach, onBack }: { outreach: OutreachSession; onBack: () => void }) => {
  const { user } = useAuth();
  const capture = useSlugCaptureLead();
  const { data: recent = [] } = useRecentOutreachCaptures(outreach.id, user?.id ?? null);

  const today = new Date().toISOString().slice(0, 10);
  const hhmm = new Date().toTimeString().slice(0, 5);
  const gating = useMemo(() => {
    if (outreach.status === 'cancelled') return { open: false, msg: 'Cancelled' };
    if (outreach.status === 'completed' || outreach.status === 'reconciled') return { open: false, msg: 'Closed' };
    if (!outreach.public_intake_enabled && outreach.status !== 'active') return { open: false, msg: 'Intake paused' };
    if (outreach.status === 'active') return { open: true, msg: '' };
    if (outreach.outreach_date > today) return { open: false, msg: 'Not started yet' };
    if (outreach.outreach_date < today) return { open: false, msg: 'Closed' };
    if (outreach.start_time && hhmm < outreach.start_time.slice(0, 5)) return { open: false, msg: 'Not started yet' };
    if (outreach.end_time && hhmm > outreach.end_time.slice(0, 5)) return { open: false, msg: 'Closed' };
    return { open: true, msg: '' };
  }, [outreach, today, hhmm]);

  const [form, setForm] = useState({
    full_name: '', phone: '', email: '', gender: '', main_skin_concern: '',
    interest_level: 'medium' as 'low' | 'medium' | 'high',
    wants_consultation: true, product_interest: '', notes: '',
    consent_status: 'granted' as 'granted' | 'denied',
  });
  const setField = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) return toast({ title: 'Name required', variant: 'destructive' });
    if (form.phone && !isValidE164(form.phone)) return toast({ title: 'Invalid phone', variant: 'destructive' });
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return toast({ title: 'Invalid email', variant: 'destructive' });
    try {
      await capture.mutateAsync({
        outreach_id: outreach.id,
        staff_id: user?.id ?? null,
        full_name: form.full_name.trim(),
        phone: form.phone || undefined,
        email: form.email.trim() || undefined,
        gender: form.gender || undefined,
        main_skin_concern: form.main_skin_concern || undefined,
        interest_level: form.interest_level,
        wants_consultation: form.wants_consultation,
        product_interest: form.product_interest || undefined,
        notes: form.notes || undefined,
        consent_status: form.consent_status,
      });
      toast({ title: 'Lead saved', description: 'Captured by you.' });
      setForm({
        full_name: '', phone: '', email: '', gender: '', main_skin_concern: '',
        interest_level: 'medium', wants_consultation: true, product_interest: '', notes: '',
        consent_status: 'granted',
      });
    } catch (err: any) {
      toast({ title: 'Capture failed', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-primary inline-flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> Pick another outreach
      </button>

      <Card className="p-4 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold">{outreach.name}</h2>
          <Badge className={'uppercase text-[10px] ' + (gating.open ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-amber-500/15 text-amber-700 font-semibold border-amber-500/40')}>
            {gating.open ? 'Open' : gating.msg || 'Closed'}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{outreach.outreach_date}</span>
          {outreach.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{outreach.location}</span>}
          {(outreach.start_time || outreach.end_time) && (
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />
              {outreach.start_time?.slice(0, 5) ?? '—'}→{outreach.end_time?.slice(0, 5) ?? '—'}
            </span>
          )}
        </div>
        <div className="text-[11px] pt-1.5 border-t border-border/30 mt-2">
          <span className="text-muted-foreground">Next: </span>
          <span className="font-semibold">{outreachNextAction(outreach.status).action}</span>
          <span className="text-muted-foreground"> · Owner: {outreachNextAction(outreach.status).owner}</span>
        </div>
      </Card>

      {gating.open ? (
        <form onSubmit={submit} className="space-y-3">
          <Card className="p-4 space-y-3">
            <div>
              <Label>Full name *</Label>
              <Input value={form.full_name} onChange={(e) => setField('full_name', e.target.value)} required maxLength={100} />
            </div>
            <div>
              <Label>Phone</Label>
              <PhoneInput value={form.phone} onChange={(v) => setField('phone', v)} />
            </div>
            <div>
              <Label>Email (optional)</Label>
              <Input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="you@email.com" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Sex</Label>
                <select value={form.gender} onChange={(e) => setField('gender', e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">—</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option>
                </select>
              </div>
              <div>
                <Label>Interest</Label>
                <Select value={form.interest_level} onValueChange={(v) => setField('interest_level', v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Main skin concern</Label>
              <Input value={form.main_skin_concern} onChange={(e) => setField('main_skin_concern', e.target.value)} />
            </div>
            <div>
              <Label>Wants consultation?</Label>
              <Select value={form.wants_consultation ? 'yes' : 'no'} onValueChange={(v) => setField('wants_consultation', v === 'yes')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Product interest</Label>
              <Input value={form.product_interest} onChange={(e) => setField('product_interest', e.target.value)} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
            </div>
            <div className="space-y-2 rounded-md border border-border/50 bg-surface/40 p-3">
              <p className="text-xs font-medium">Marketing contact preference</p>
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="radio" name="consent" checked={form.consent_status === 'granted'} onChange={() => setField('consent_status', 'granted')} />
                  Yes, you may contact me
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="radio" name="consent" checked={form.consent_status === 'denied'} onChange={() => setField('consent_status', 'denied')} />
                  No, do not contact me for marketing
                </label>
              </div>
            </div>
            <Button type="submit" disabled={capture.isPending} className="w-full">
              {capture.isPending ? 'Saving…' : 'Save lead'}
            </Button>
          </Card>
        </form>
      ) : (
        <Card className="p-4 text-sm text-muted-foreground">{gating.msg}</Card>
      )}

      <div>
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Your recent captures</h3>
        {recent.length === 0 ? (
          <p className="text-xs text-muted-foreground">None yet.</p>
        ) : (
          <div className="space-y-2">
            {recent.map((c: any) => (
              <Card key={c.id} className="p-3 flex items-center justify-between text-sm">
                <div>
                  <div className="font-semibold">{c.full_name}</div>
                  <div className="text-[11px] text-muted-foreground">{c.phone ?? '—'}</div>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OutreachPortal;