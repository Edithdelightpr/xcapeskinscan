import { useMemo, useState } from 'react';
import { MessageCircle, Phone, Mail, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  usePersonalizationRequests,
  useUpdatePersonalizationRequest,
  PERSONALIZATION_STATUSES,
  type PersonalizationRequest,
} from '@/hooks/useProductPersonalization';
import {
  CONCERN_GROUPS, CONCERN_DURATIONS, SKIN_FEEL, SYMPTOMS,
  REACTION_OPTIONS, PRACTITIONER_NOTES, labelFor, labelsFor,
} from '@/lib/personalizationOptions';

const Row = ({ label, value }: { label: string; value?: string }) =>
  value ? (
    <div className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      <span>{value}</span>
    </div>
  ) : null;

const RequestCard = ({ req }: { req: PersonalizationRequest }) => {
  const update = useUpdatePersonalizationRequest();
  const [notes, setNotes] = useState(req.staff_notes ?? '');
  const a = req.answers ?? {};
  const digits = req.phone.replace(/\D/g, '');

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{req.full_name}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(req.created_at).toLocaleString()} · {req.source}
            {req.page_path ? ` · ${req.page_path}` : ''}
          </p>
        </div>
        <Select
          value={req.status}
          onValueChange={(v) =>
            update.mutate({ id: req.id, status: v }, { onSuccess: () => toast.success('Status updated') })
          }
        >
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERSONALIZATION_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={req.preferred_contact === 'whatsapp' ? 'default' : 'outline'} asChild>
          <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer">
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </a>
        </Button>
        <Button size="sm" variant={req.preferred_contact === 'phone' ? 'default' : 'outline'} asChild>
          <a href={`tel:${req.phone}`}><Phone className="w-4 h-4" /> Call</a>
        </Button>
        {req.email && (
          <Button size="sm" variant={req.preferred_contact === 'email' ? 'default' : 'outline'} asChild>
            <a href={`mailto:${req.email}`}><Mail className="w-4 h-4" /> Email</a>
          </Button>
        )}
        <span className="text-xs text-muted-foreground self-center">
          Prefers {req.preferred_contact}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-x-6 gap-y-1 border-t border-border/50 pt-3">
        <Row label="Contact" value={`${req.phone}${req.email ? ` · ${req.email}` : ''}`} />
        <Row label="Wants help with" value={[...labelsFor(CONCERN_GROUPS, a.concerns), a.concern_other].filter(Boolean).join(', ')} />
        <Row label="Duration" value={labelFor(CONCERN_DURATIONS, a.duration)} />
        <Row label="Skin feels" value={labelFor(SKIN_FEEL, a.skin_feel)} />
        <Row label="Symptoms" value={[...labelsFor(SYMPTOMS, a.symptoms), a.symptoms_other].filter(Boolean).join(', ')} />
        <Row label="Current products" value={a.current_products} />
        <Row label="Past reaction" value={[labelFor(REACTION_OPTIONS, a.past_reaction), a.past_reaction_details].filter(Boolean).join(' — ')} />
        <Row label="Practitioner notes" value={labelsFor(PRACTITIONER_NOTES, a.practitioner_notes).join(', ')} />
      </div>

      <div className="space-y-2">
        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Internal notes (not visible to the client)"
        />
        {notes !== (req.staff_notes ?? '') && (
          <Button
            size="sm"
            onClick={() =>
              update.mutate({ id: req.id, staff_notes: notes }, { onSuccess: () => toast.success('Notes saved') })
            }
          >
            Save notes
          </Button>
        )}
      </div>
    </div>
  );
};

const AdminPersonalizationRequests = () => {
  const { data: requests = [], isLoading } = usePersonalizationRequests();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('all');

  const filtered = useMemo(
    () =>
      requests.filter((r) => {
        if (status !== 'all' && r.status !== status) return false;
        if (!q.trim()) return true;
        const t = q.toLowerCase();
        return (
          r.full_name.toLowerCase().includes(t) ||
          r.phone.includes(t) ||
          (r.email ?? '').toLowerCase().includes(t)
        );
      }),
    [requests, q, status],
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Product Personalization</h2>
        <p className="text-sm text-muted-foreground">
          Requests submitted from the Tropixa page. A practitioner reviews each one before recommending products.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone or email" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {PERSONALIZATION_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading requests…
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No personalization requests yet.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => <RequestCard key={r.id} req={r} />)}
        </div>
      )}
    </div>
  );
};

export default AdminPersonalizationRequests;
