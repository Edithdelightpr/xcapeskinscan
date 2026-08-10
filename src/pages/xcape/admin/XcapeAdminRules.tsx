import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import {
  Plus, Pencil, Copy, UploadCloud, PauseCircle, PlayCircle, Archive, FlaskConical, History,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';
import RuleEditorDialog from '@/components/xcape/admin/RuleEditorDialog';
import {
  useXcapeRules,
  useDuplicateRule,
  usePublishRule,
  useSetRuleStatus,
} from '@/hooks/useXcapeRules';
import type { RuleStatus, XcapeRule } from '@/lib/xcapeRules/types';
import { cn } from '@/lib/utils';

const STATUS_META: Record<RuleStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'border-border/60 text-muted-foreground' },
  published: { label: 'Published', className: 'border-emerald-500/50 text-emerald-400' },
  inactive: { label: 'Inactive', className: 'border-amber-500/50 text-amber-400' },
  archived: { label: 'Archived', className: 'border-border/40 text-muted-foreground/60' },
};

/**
 * XCAPE Recommendation Rules — the admin criteria layer. Rules are edited
 * as drafts, published into immutable versions, and only published
 * non-demo rules ever reach the practitioner workflow.
 */
const XcapeAdminRules = () => {
  const { data: rules = [], isLoading } = useXcapeRules();
  const duplicateMut = useDuplicateRule();
  const publishMut = usePublishRule();
  const setStatusMut = useSetRuleStatus();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<XcapeRule | null>(null);

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (rule: XcapeRule) => {
    setEditing(rule);
    setEditorOpen(true);
  };

  const act = (promise: Promise<unknown>, success: string) =>
    promise
      .then(() => toast.success(success))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Action failed'));

  return (
    <div className="px-4 sm:px-6 py-8 max-w-6xl mx-auto space-y-5">
      <Helmet>
        <title>Recommendation Rules — XCAPE</title>
      </Helmet>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <XcapePageHeader
          title="Recommendation Rules"
          description="Versioned criteria that translate analysis findings and client intake data into proposed protocols, treatments and home care. The official XCAPE clinical criteria are supplied by the clinical owner; until then only explicitly published rules execute."
        />
        <Button onClick={openNew} className="glow-primary shrink-0">
          <Plus className="w-4 h-4 mr-1.5" /> New rule
        </Button>
      </div>

      <div className="rounded-xl border border-border/50 bg-surface/40 px-4 py-3 text-[11px] text-muted-foreground space-y-1">
        <p>
          <span className="text-foreground font-medium">Lifecycle:</span> draft → publish (creates an
          immutable version) → deactivate / reactivate → archive. Only{' '}
          <span className="text-foreground font-medium">published, non-demo</span> rules are evaluated
          in New Analysis. Published rules propose — the practitioner always decides.
        </p>
        <p>
          Manage the immutable snapshots on the{' '}
          <a href="/xcape/admin/rule-versions" className="text-primary underline underline-offset-2">
            Rule Versions
          </a>{' '}
          page, including the full audit trail.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading rules…</p>
      ) : rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center space-y-2">
          <p className="text-sm text-foreground font-medium">No recommendation rules yet</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            The final XCAPE clinical criteria will be supplied by the clinical owner. You can build the
            structure now — create a rule, publish it, and it becomes available to the Recommendations
            step. Mark test rules as demonstration placeholders so they never execute.
          </p>
          <Button onClick={openNew} variant="outline" className="mt-2">
            <Plus className="w-4 h-4 mr-1.5" /> Create the first rule
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {rules.map((rule) => {
            const meta = STATUS_META[rule.status];
            const groupCount = rule.draft_conditions?.groups?.length ?? 0;
            const outputBits = [
              (rule.draft_outputs?.protocol_ids?.length ?? 0) > 0 &&
                `${rule.draft_outputs!.protocol_ids!.length} protocol(s)`,
              (rule.draft_outputs?.services?.length ?? 0) > 0 &&
                `${rule.draft_outputs!.services!.length} service(s)`,
              (rule.draft_outputs?.products?.length ?? 0) > 0 &&
                `${rule.draft_outputs!.products!.length} product(s)`,
              rule.draft_outputs?.home_care && 'home care',
              rule.draft_outputs?.follow_up_weeks != null && 'follow-up',
            ].filter(Boolean);

            return (
              <li
                key={rule.id}
                className="glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">{rule.name}</p>
                    <Badge variant="outline" className={cn('text-[10px]', meta.className)}>
                      {meta.label}
                    </Badge>
                    {rule.current_version > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        v{rule.current_version}
                      </Badge>
                    )}
                    {rule.is_demo && (
                      <Badge variant="outline" className="text-[10px] border-violet-500/50 text-violet-400">
                        <FlaskConical className="w-3 h-3 mr-1" /> Demo — never executes
                      </Badge>
                    )}
                  </div>
                  {rule.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{rule.description}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Priority {rule.priority} · {groupCount} condition group(s)
                    {outputBits.length > 0 && ` · proposes ${outputBits.join(', ')}`}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => openEdit(rule)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    disabled={duplicateMut.isPending}
                    onClick={() => act(duplicateMut.mutateAsync(rule), 'Duplicated as a new draft')}
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" /> Duplicate
                  </Button>
                  {rule.status !== 'archived' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      disabled={publishMut.isPending}
                      onClick={() =>
                        act(
                          publishMut.mutateAsync({ rule }),
                          `Published as v${rule.current_version + 1}`,
                        )
                      }
                    >
                      <UploadCloud className="w-3.5 h-3.5 mr-1" /> Publish
                    </Button>
                  )}
                  {rule.status === 'published' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-amber-400"
                      disabled={setStatusMut.isPending}
                      onClick={() =>
                        act(setStatusMut.mutateAsync({ id: rule.id, status: 'inactive' }), 'Deactivated')
                      }
                    >
                      <PauseCircle className="w-3.5 h-3.5 mr-1" /> Deactivate
                    </Button>
                  )}
                  {rule.status === 'inactive' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-emerald-400"
                      disabled={setStatusMut.isPending}
                      onClick={() =>
                        act(setStatusMut.mutateAsync({ id: rule.id, status: 'published' }), 'Reactivated')
                      }
                    >
                      <PlayCircle className="w-3.5 h-3.5 mr-1" /> Reactivate
                    </Button>
                  )}
                  {rule.status !== 'archived' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      disabled={setStatusMut.isPending}
                      onClick={() =>
                        act(setStatusMut.mutateAsync({ id: rule.id, status: 'archived' }), 'Archived')
                      }
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

      <div className="flex justify-end">
        <Button asChild variant="link" className="text-xs text-muted-foreground">
          <a href="/xcape/admin/rule-versions">
            <History className="w-3.5 h-3.5 mr-1" /> View versions & audit trail
          </a>
        </Button>
      </div>

      <RuleEditorDialog open={editorOpen} onOpenChange={setEditorOpen} rule={editing} />
    </div>
  );
};

export default XcapeAdminRules;
