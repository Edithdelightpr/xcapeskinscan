import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { FieldStack } from '@/components/admin/assessmentShared';
import RuleConditionBuilder from './RuleConditionBuilder';
import RuleOutputsEditor from './RuleOutputsEditor';
import { useSaveRuleDraft, usePublishRule } from '@/hooks/useXcapeRules';
import type { RuleConditions, RuleOutputs, XcapeRule } from '@/lib/xcapeRules/types';

/**
 * Full editor for a recommendation rule: identity, condition builder and
 * structured outputs. Saving always lands as a draft; publishing snapshots
 * the draft into an immutable version (handled by the parent list page).
 */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing rule to edit, or null to create a new one. */
  rule: XcapeRule | null;
  /** Called after a successful save so the parent can offer Publish next. */
  onSaved?: (rule: XcapeRule) => void;
}

const emptyConditions = (): RuleConditions => ({ groups: [] });
const emptyOutputs = (): RuleOutputs => ({});

const RuleEditorDialog = ({ open, onOpenChange, rule, onSaved }: Props) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('100');
  const [isDemo, setIsDemo] = useState(false);
  const [conditions, setConditions] = useState<RuleConditions>(emptyConditions());
  const [outputs, setOutputs] = useState<RuleOutputs>(emptyOutputs());

  const saveMut = useSaveRuleDraft();
  const publishMut = usePublishRule();

  useEffect(() => {
    if (!open) return;
    setName(rule?.name ?? '');
    setDescription(rule?.description ?? '');
    setPriority((rule?.priority ?? 100).toString());
    setIsDemo(rule?.is_demo ?? false);
    setConditions(rule?.draft_conditions ?? emptyConditions());
    setOutputs(rule?.draft_outputs ?? emptyOutputs());
  }, [open, rule]);

  const saveDraft = async (): Promise<XcapeRule | null> => {
    if (!name.trim()) {
      toast.error('Give the rule a name');
      return null;
    }
    try {
      const saved = await saveMut.mutateAsync({
        id: rule?.id,
        name: name.trim(),
        description: description.trim() || null,
        priority: Number(priority) || 100,
        draft_conditions: conditions,
        draft_outputs: outputs,
        is_demo: isDemo,
      });
      toast.success(rule ? 'Draft saved' : 'Rule created as draft');
      onSaved?.(saved);
      return saved;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
      return null;
    }
  };

  const handleSave = async () => {
    const saved = await saveDraft();
    if (saved) onOpenChange(false);
  };

  const handleSaveAndPublish = async () => {
    const saved = await saveDraft();
    if (!saved) return;
    try {
      await publishMut.mutateAsync({ rule: saved });
      toast.success(`Published as v${saved.current_version + 1}`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? `Saved, but publish failed: ${e.message}` : 'Publish failed');
    }
  };

  const pending = saveMut.isPending || publishMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {rule ? `Edit rule — ${rule.name}` : 'New recommendation rule'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Rules translate analysis findings and client intake data into proposed solutions. Nothing
            here executes until published — and even published rules only propose; the practitioner
            always makes the final decision.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Identity */}
          <section className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
              <FieldStack label="Rule name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Significant pigmentation — tropical protocol" />
              </FieldStack>
              <FieldStack label="Priority (lower = first)">
                <Input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
              </FieldStack>
            </div>
            <FieldStack label="Description">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this rule is for, in plain language"
                rows={2}
              />
            </FieldStack>
            <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2.5">
              <div>
                <Label className="text-xs font-medium">Demonstration placeholder</Label>
                <p className="text-[11px] text-muted-foreground">
                  Demo rules never execute — even when published — and never reach reports. Use only for
                  interface testing until the official XCAPE clinical criteria are supplied.
                </p>
              </div>
              <Switch checked={isDemo} onCheckedChange={setIsDemo} />
            </div>
          </section>

          {/* Conditions */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">When does this rule apply?</h3>
            <p className="text-[11px] text-muted-foreground">
              Groups are joined with AND. Inside a group choose whether all conditions must match or any
              one is enough.
            </p>
            <RuleConditionBuilder value={conditions} onChange={setConditions} />
          </section>

          {/* Outputs */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">What does it propose?</h3>
            <RuleOutputsEditor value={outputs} onChange={setOutputs} />
          </section>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" variant="secondary" onClick={handleSave} disabled={pending}>
            Save draft
          </Button>
          <Button type="button" onClick={handleSaveAndPublish} disabled={pending} className="glow-primary">
            {publishMut.isPending ? 'Publishing…' : 'Save & publish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RuleEditorDialog;
