import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { CalendarDays, Check, Copy, Link2, Plus, RefreshCw, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  useClientEvents,
  useCreateClientEvent,
  useCreateInvitation,
  useEventInvitations,
  useResetInvitationToken,
  type ClientEventRow,
} from '@/hooks/useEventInvitations';
import ClientSearchPicker from '@/components/admin/ClientSearchPicker';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const STATUS_TONE: Record<string, string> = {
  pending: 'bg-surface text-muted-foreground border-border/50',
  accepted: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  declined: 'bg-destructive/10 text-destructive border-destructive/30',
};

/** One-time invite link banner shown right after a link is created/reset. */
const LinkBanner = ({ url, onDismiss }: { url: string; onDismiss: () => void }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed — select the link manually');
    }
  };
  return (
    <div className="rounded-xl border border-accent/30 bg-accent/10 p-3 space-y-2">
      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <Link2 className="w-3.5 h-3.5" /> Invite link — shown once, share it now
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-[11px] bg-surface rounded-lg px-2 py-1.5 truncate border border-border/50">
          {url}
        </code>
        <Button type="button" size="sm" variant="outline" onClick={copy} className="shrink-0">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDismiss} className="shrink-0 text-xs">
          Done
        </Button>
      </div>
    </div>
  );
};

const CreateEventForm = ({ onCreated }: { onCreated: (id: string) => void }) => {
  const { user } = useAuth();
  const createEvent = useCreateClientEvent();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [notes, setNotes] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date || !start || !end) {
      toast.error('Title, date, start and end time are required');
      return;
    }
    if (!user?.id) return;
    try {
      const created = await createEvent.mutateAsync({
        title: title.trim(),
        start_time: new Date(`${date}T${start}`).toISOString(),
        end_time: new Date(`${date}T${end}`).toISOString(),
        notes: notes.trim() || null,
        created_by: user.id,
      });
      toast.success('Event created');
      setTitle(''); setDate(''); setStart(''); setEnd(''); setNotes('');
      onCreated(created.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create event');
    }
  };

  return (
    <form onSubmit={submit} className="glass rounded-2xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Plus className="w-4 h-4" /> New client event
      </h2>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. XCAPE Skin Day — Lekki" className="bg-surface border-border/60" required />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-surface border-border/60" required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Start</Label>
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="bg-surface border-border/60" required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">End</Label>
          <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="bg-surface border-border/60" required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Location / notes</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Venue, directions, what to bring…" className="bg-surface border-border/60" />
      </div>
      <Button type="submit" disabled={createEvent.isPending} className="w-full">
        {createEvent.isPending ? 'Creating…' : 'Create event'}
      </Button>
    </form>
  );
};

const InvitationsPanel = ({ event }: { event: ClientEventRow }) => {
  const { user } = useAuth();
  const { data: invitations = [], isLoading } = useEventInvitations(event.id);
  const createInvitation = useCreateInvitation();
  const resetToken = useResetInvitationToken();
  const [pick, setPick] = useState<string | null>(null);
  const [freshLink, setFreshLink] = useState<string | null>(null);

  const invite = async () => {
    if (!pick || !user?.id) return;
    try {
      const { url } = await createInvitation.mutateAsync({
        event_id: event.id,
        client_id: pick,
        created_by: user.id,
      });
      setFreshLink(url);
      setPick(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create invitation');
    }
  };

  const regenerate = async (id: string) => {
    try {
      const { url } = await resetToken.mutateAsync({ id, event_id: event.id });
      setFreshLink(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to regenerate link');
    }
  };

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Invitations — {event.title}</h2>
        <p className="text-xs text-muted-foreground">
          {new Date(event.start_time).toLocaleString()} · each client gets a private link to accept or decline.
        </p>
      </div>

      {freshLink && <LinkBanner url={freshLink} onDismiss={() => setFreshLink(null)} />}

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Invite a client</Label>
        <ClientSearchPicker value={pick} onChange={(id) => setPick(id)} />
        <Button
          type="button"
          onClick={invite}
          disabled={!pick || createInvitation.isPending}
          className="w-full"
          variant="outline"
        >
          <UserPlus className="w-3.5 h-3.5 mr-1.5" />
          {createInvitation.isPending ? 'Creating…' : 'Create invite link'}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading invitations…</p>
      ) : invitations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No invitations yet.</p>
      ) : (
        <ul className="divide-y divide-border/40">
          {invitations.map((inv) => (
            <li key={inv.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {inv.client?.full_name ?? 'Client'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  link ·{inv.token_prefix}…
                  {inv.responded_at && ` · responded ${new Date(inv.responded_at).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${STATUS_TONE[inv.response_status] ?? ''}`}>
                  {inv.response_status}
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  title="Regenerate link (old link stops working)"
                  disabled={resetToken.isPending}
                  onClick={() => regenerate(inv.id)}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * XCAPE Events — staff surface for client-facing events and their
 * invitation/RSVP links. Separate from the internal staff broadcast calendar.
 */
const XcapeEvents = () => {
  const { data: events = [], isLoading } = useClientEvents();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = events.find((e) => e.id === selectedId) ?? events[0] ?? null;

  return (
    <div className="px-4 sm:px-6 py-8 max-w-7xl mx-auto space-y-5">
      <Helmet>
        <title>Events — XCAPE</title>
      </Helmet>
      <XcapePageHeader
        title="Client Events"
        description="Create client-facing events and send private invitation links. Clients accept or decline from their link — responses show up here."
      />

      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-5 items-start">
        <div className="space-y-5">
          <CreateEventForm onCreated={(id) => setSelectedId(id)} />

          <div className="glass rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CalendarDays className="w-4 h-4" /> Events
            </h2>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading events…</p>
            ) : events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No client events yet — create the first one above.</p>
            ) : (
              <ul className="space-y-2">
                {events.map((ev) => (
                  <li key={ev.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(ev.id)}
                      className={`w-full text-left rounded-xl border p-3 transition-colors ${
                        selected?.id === ev.id
                          ? 'border-accent/50 bg-accent/10'
                          : 'border-border/50 bg-surface hover:bg-surface-hover'
                      }`}
                    >
                      <p className="text-sm font-medium text-foreground truncate">{ev.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(ev.start_time).toLocaleString()}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {selected ? (
          <InvitationsPanel event={selected} />
        ) : (
          <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
            Create an event to start inviting clients.
          </div>
        )}
      </div>
    </div>
  );
};

export default XcapeEvents;
