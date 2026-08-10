import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import { Plus, Pencil, Archive, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  useXcapeContraindications,
  useSaveContraindication,
  useSetContraindicationStatus,
} from '@/hooks/useXcapeContraindications';
import type {
  ContraindicationSeverity,
  XcapeContraindication,
} from '@/lib/xcapeRules/types';
import { cn } from '@/lib/utils';

const SEVERITY_META: Record<ContraindicationSeverity, { label: string; className: string }> = {
  caution: { label: 'Caution', className: 'border-amber-500/50 text-amber-400' },
  warning: { label: 'Warning', className: 'border-orange-500/50 text-orange-400' },
  block: { label: 'Block', className: 'border-red-500/50 text-red-400' },
};

const TARGET_KINDS = [
  { value: 'protocol', label: 'Protocol' },
  { value: 'service', label: 'Service / treatment' },
  { value: 'product', label: 'Product' },
  { value: 'ingredient', label: 'Ingredient' },
] as const;

/**
 * XCAPE Contraindications — admin-managed safety flags attached to
 * protocols, services, products or ingredients. Active entries surface as
 * warnings next to rule proposals in the practitioner workflow.
 */
const XcapeAdminContraindications = () => {
  const { data: items = [], isLoading } = useXcapeContraindications();
  const saveMut = useSaveContraindication();
  const setStatusMut = useSetContraindicationStatus();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<XcapeContraindication | null>(null);

  const [name, setName] = useState('');
  const [targetKind, setTargetKind] = useState<XcapeContraindication['target_kind']>('ingredient');
  const [targetName, setTargetName] = useState('');
  const [severity, setSeverity] = useState<ContraindicationSeverity>('warning');
  const [message, setMessage] = useState('');
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setTargetKind(editing?.target_kind ?? 'ingredient');
    setTargetName(editing?.target_name ?? '');
    setSeverity(editing?.severity ?? 'warning');
    setMessage(editing?.message ?? '');
    setIsDemo(editing?.is_demo ?? false);
  }, [open, editing]);

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (c: XcapeContraindication) => {
    setEditing(c);
    setOpen(true);
  };

  const save = async (activate: boolean) => {
    if (!name.trim() || !message.trim()) {
      toast.error('Name and message are required');
      return;
    }
    try {
      const saved = await saveMut.mutateAsync({
        id: editing?.id,
        name: name.trim(),
        target_kind: targetKind,
        target_name: targetName.trim() || null,
        severity,
        message: message.trim(),
        is_demo: isDemo,
      });
      if (activate && saved.status !== 'active') {
        await setStatusMut.mutateAsync({ id: saved.id, status: 'active' });
      }
      toast.success(activate ? 'Contraindication saved & active' : 'Saved as draft');
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
        <title>Contraindications — XCAPE</title>
      </Helmet>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <XcapePageHeader
          title="Contraindications"
          description="Safety flags attached to protocols, treatments, products or ingredients. Active entries appear as warnings next to proposed solutions so the practitioner sees them before approving."
        />
        <Button onClick={openNew} className="glow-primary shrink-0">
          <Plus className="w-4 h-4 mr-1.5" /> New contraindication
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-foreground font-medium">No contraindications yet</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Add safety flags here (e.g. retinoids during pregnancy). Active entries warn practitioners
            inside the Recommendations step.
          </p>
          <Button onClick={openNew} variant="outline" className="mt-2">
            <Plus className="w-4 h-4 mr-1.5" /> Add the first entry
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((c) => {
            const meta = SEVERITY_META[c.severity];
            return (
              <li key={c.id} className="glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                    <Badge variant="outline" className={cn('text-[10px]', meta.className)}>
                      {meta.label}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] capitalize">{c.target_kind}</Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px]',
                        c.status === 'active'
                          ? 'border-emerald-500/50 text-emerald-400'
                          : 'border-border/60 text-muted-foreground',
                      )}
                    >
                      {c.status}
                    </Badge>
                  </div>
                  {c.target_name && (
                    <p className="text-xs text-muted-foreground">Applies to: {c.target_name}</p>
                  )}
                  <p className="text-xs text-muted-foreground line-clamp-2">{c.message}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => openEdit(c)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  {c.status !== 'active' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-emerald-400"
                      disabled={setStatusMut.isPending}
                      onClick={() => act(setStatusMut.mutateAsync({ id: c.id, status: 'active' }), 'Activated')}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Activate
                    </Button>
                  )}
                  {c.status !== 'archived' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      disabled={setStatusMut.isPending}
                      onClick={() => act(setStatusMut.mutateAsync({ id: c.id, status: 'archived' }), 'Archived')}
                    >
                      <Archive className="w-3.5 h-3.5 mr-1" /> Archive
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? `Edit — ${editing.name}` : 'New contraindication'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Active contraindications warn practitioners when a matching item is proposed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <FieldStack label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Retinoids in pregnancy" />
            </FieldStack>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldStack label="Applies to (kind)">
                <Select value={targetKind} onValueChange={(v) => setTargetKind(v as typeof targetKind)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TARGET_KINDS.map((k) => (
                      <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldStack>
              <FieldStack label="Applies to (name)">
                <Input value={targetName} onChange={(e) => setTargetName(e.target.value)} placeholder="e.g. Retinol" />
              </FieldStack>
            </div>
            <FieldStack label="Severity">
              <Select value={severity} onValueChange={(v) => setSeverity(v as ContraindicationSeverity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SEVERITY_META).map(([v, m]) => (
                    <SelectItem key={v} value={v}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldStack>
            <FieldStack label="Practitioner-facing message">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="e.g. Do not propose retinoid-based home care during pregnancy or breastfeeding."
              />
            </FieldStack>
            <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2.5">
              <div>
                <Label className="text-xs font-medium">Demonstration placeholder</Label>
                <p className="text-[11px] text-muted-foreground">For interface testing only.</p>
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

export default XcapeAdminContraindications;
