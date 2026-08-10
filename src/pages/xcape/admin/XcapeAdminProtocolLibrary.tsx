import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import { Plus, Pencil, Copy, Archive, CheckCircle2, FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldStack } from '@/components/admin/assessmentShared';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';
import {
  useXcapeProtocols,
  useSaveProtocol,
  useDuplicateProtocol,
  useSetProtocolStatus,
} from '@/hooks/useXcapeProtocols';
import type { XcapeProtocol } from '@/lib/xcapeRules/types';
import { cn } from '@/lib/utils';

/**
 * XCAPE Protocol Library — admin-managed treatment & home-care protocols.
 * Active protocols become linkable outputs inside recommendation rules and
 * browsable by practitioners at /xcape/protocols.
 */
const XcapeAdminProtocolLibrary = () => {
  const { data: protocols = [], isLoading } = useXcapeProtocols();
  const saveMut = useSaveProtocol();
  const duplicateMut = useDuplicateProtocol();
  const setStatusMut = useSetProtocolStatus();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<XcapeProtocol | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [stepsText, setStepsText] = useState('');
  const [frequency, setFrequency] = useState('');
  const [duration, setDuration] = useState('');
  const [sessions, setSessions] = useState('');
  const [homeCare, setHomeCare] = useState('');
  const [followUpWeeks, setFollowUpWeeks] = useState('');
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setDescription(editing?.description ?? '');
    setCategory(editing?.category ?? '');
    setStepsText((editing?.steps ?? []).join('\n'));
    setFrequency(editing?.frequency ?? '');
    setDuration(editing?.duration ?? '');
    setSessions(editing?.sessions?.toString() ?? '');
    setHomeCare(editing?.home_care ?? '');
    setFollowUpWeeks(editing?.follow_up_weeks?.toString() ?? '');
    setIsDemo(editing?.is_demo ?? false);
  }, [open, editing]);

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (p: XcapeProtocol) => {
    setEditing(p);
    setOpen(true);
  };

  const save = async (activate: boolean) => {
    if (!name.trim()) {
      toast.error('Give the protocol a name');
      return;
    }
    try {
      const saved = await saveMut.mutateAsync({
        id: editing?.id,
        name: name.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        steps: stepsText.split('\n').map((s) => s.trim()).filter(Boolean),
        frequency: frequency.trim() || null,
        duration: duration.trim() || null,
        sessions: sessions ? Number(sessions) : null,
        home_care: homeCare.trim() || null,
        follow_up_weeks: followUpWeeks ? Number(followUpWeeks) : null,
        is_demo: isDemo,
      });
      if (activate && saved.status !== 'active') {
        await setStatusMut.mutateAsync({ id: saved.id, status: 'active' });
      }
      toast.success(activate ? 'Protocol saved & active' : 'Protocol saved as draft');
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const act = (promise: Promise<unknown>, success: string) =>
    promise
      .then(() => toast.success(success))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Action failed'));

  const pending = saveMut.isPending || setStatusMut.isPending;

  return (
    <div className="px-4 sm:px-6 py-8 max-w-6xl mx-auto space-y-5">
      <Helmet>
        <title>Protocol Library — XCAPE</title>
      </Helmet>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <XcapePageHeader
          title="Protocol Library"
          description="Treatment and home-care protocols that recommendation rules can propose. Active protocols are also visible to practitioners under Protocols. Clinical content is supplied by the clinical owner — no authoritative rules are pre-seeded."
        />
        <Button onClick={openNew} className="glow-primary shrink-0">
          <Plus className="w-4 h-4 mr-1.5" /> New protocol
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading protocols…</p>
      ) : protocols.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center space-y-2">
          <p className="text-sm text-foreground font-medium">No protocols yet</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Create protocols here, activate them, then link them as outputs in Recommendation Rules.
          </p>
          <Button onClick={openNew} variant="outline" className="mt-2">
            <Plus className="w-4 h-4 mr-1.5" /> Create the first protocol
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {protocols.map((p) => (
            <li key={p.id} className="glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px]',
                      p.status === 'active'
                        ? 'border-emerald-500/50 text-emerald-400'
                        : p.status === 'draft'
                          ? 'border-border/60 text-muted-foreground'
                          : 'border-border/40 text-muted-foreground/60',
                    )}
                  >
                    {p.status}
                  </Badge>
                  {p.category && (
                    <Badge variant="secondary" className="text-[10px]">{p.category}</Badge>
                  )}
                  {p.is_demo && (
                    <Badge variant="outline" className="text-[10px] border-violet-500/50 text-violet-400">
                      <FlaskConical className="w-3 h-3 mr-1" /> Demo
                    </Badge>
                  )}
                </div>
                {p.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {[
                    p.steps.length > 0 && `${p.steps.length} step(s)`,
                    p.frequency,
                    p.duration,
                    p.sessions != null && `${p.sessions} session(s)`,
                    p.follow_up_weeks != null && `follow-up ${p.follow_up_weeks}w`,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'No schedule set'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => openEdit(p)}>
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  disabled={duplicateMut.isPending}
                  onClick={() => act(duplicateMut.mutateAsync(p), 'Duplicated as draft')}
                >
                  <Copy className="w-3.5 h-3.5 mr-1" /> Duplicate
                </Button>
                {p.status !== 'active' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs text-emerald-400"
                    disabled={setStatusMut.isPending}
                    onClick={() => act(setStatusMut.mutateAsync({ id: p.id, status: 'active' }), 'Activated')}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Activate
                  </Button>
                )}
                {p.status !== 'archived' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    disabled={setStatusMut.isPending}
                    onClick={() => act(setStatusMut.mutateAsync({ id: p.id, status: 'archived' }), 'Archived')}
                  >
                    <Archive className="w-3.5 h-3.5 mr-1" /> Archive
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? `Edit protocol — ${editing.name}` : 'New protocol'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Protocols are proposed by rules and reviewed by practitioners. Save as draft until the
              content is approved for use.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
              <FieldStack label="Protocol name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tropical pigmentation reset" />
              </FieldStack>
              <FieldStack label="Category">
                <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Pigmentation" />
              </FieldStack>
            </div>
            <FieldStack label="Description">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What this protocol does and when it applies" />
            </FieldStack>
            <FieldStack label="Steps (one per line)">
              <Textarea value={stepsText} onChange={(e) => setStepsText(e.target.value)} rows={4} placeholder={'e.g. Week 1: barrier repair\nWeek 2–4: brightening phase'} />
            </FieldStack>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <FieldStack label="Frequency">
                <Input value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="weekly" />
              </FieldStack>
              <FieldStack label="Duration">
                <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="8 weeks" />
              </FieldStack>
              <FieldStack label="Sessions">
                <Input type="number" min={1} value={sessions} onChange={(e) => setSessions(e.target.value)} placeholder="6" />
              </FieldStack>
              <FieldStack label="Follow-up (weeks)">
                <Input type="number" min={0} value={followUpWeeks} onChange={(e) => setFollowUpWeeks(e.target.value)} placeholder="4" />
              </FieldStack>
            </div>
            <FieldStack label="Home-care guidance">
              <Textarea value={homeCare} onChange={(e) => setHomeCare(e.target.value)} rows={2} placeholder="e.g. Gentle cleanser AM/PM, SPF 50 daily" />
            </FieldStack>
            <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2.5">
              <div>
                <Label className="text-xs font-medium">Demonstration placeholder</Label>
                <p className="text-[11px] text-muted-foreground">
                  Marked as demo for interface testing; keep draft-only until official clinical content arrives.
                </p>
              </div>
              <Switch checked={isDemo} onCheckedChange={setIsDemo} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" variant="secondary" onClick={() => save(false)} disabled={pending}>
              Save draft
            </Button>
            <Button type="button" onClick={() => save(true)} disabled={pending} className="glow-primary">
              Save & activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default XcapeAdminProtocolLibrary;
