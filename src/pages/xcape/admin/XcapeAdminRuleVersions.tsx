import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import { Eye, PauseCircle, PlayCircle, Archive } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';
import { useXcapeRules, useXcapeRuleVersions, useSetVersionStatus, useXcapeRuleAudit } from '@/hooks/useXcapeRules';
import type { VersionStatus, XcapeRuleVersion } from '@/lib/xcapeRules/types';
import { cn } from '@/lib/utils';

const STATUS_META: Record<VersionStatus, { label: string; className: string }> = {
  published: { label: 'Published', className: 'border-emerald-500/50 text-emerald-400' },
  inactive: { label: 'Inactive', className: 'border-amber-500/50 text-amber-400' },
  archived: { label: 'Archived', className: 'border-border/40 text-muted-foreground/60' },
};

/**
 * XCAPE Rule Versions — every publish creates an immutable snapshot.
 * Practitioners only ever see the version their proposal was generated
 * from; retiring a version stops future use without rewriting history.
 */
const XcapeAdminRuleVersions = () => {
  const { data: rules = [] } = useXcapeRules();
  const { data: versions = [], isLoading } = useXcapeRuleVersions();
  const setStatusMut = useSetVersionStatus();
  const [viewing, setViewing] = useState<XcapeRuleVersion | null>(null);
  const { data: audit = [] } = useXcapeRuleAudit(viewing?.rule_id);

  const ruleName = (id: string) => rules.find((r) => r.id === id)?.name ?? 'Unknown rule';

  const act = (promise: Promise<unknown>, success: string) =>
    promise
      .then(() => toast.success(success))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Action failed'));

  return (
    <div className="px-4 sm:px-6 py-8 max-w-6xl mx-auto space-y-5">
      <Helmet>
        <title>Rule Versions — XCAPE</title>
      </Helmet>
      <XcapePageHeader
        title="Rule Versions & Publishing"
        description="Immutable snapshots created at every publish. Practitioner proposals always reference the exact rule version used, so decisions stay traceable even after criteria change."
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading versions…</p>
      ) : versions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center">
          <p className="text-sm text-foreground font-medium">No published versions yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Publish a rule from Recommendation Rules to create the first snapshot.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {versions.map((v) => {
            const meta = STATUS_META[v.status];
            return (
              <li key={v.id} className="glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {ruleName(v.rule_id)}
                    </p>
                    <Badge variant="secondary" className="text-[10px]">v{v.version}</Badge>
                    <Badge variant="outline" className={cn('text-[10px]', meta.className)}>
                      {meta.label}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Published {new Date(v.published_at).toLocaleString()}
                    {v.change_note && ` · ${v.change_note}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setViewing(v)}>
                    <Eye className="w-3.5 h-3.5 mr-1" /> View
                  </Button>
                  {v.status === 'published' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-amber-400"
                      onClick={() =>
                        act(setStatusMut.mutateAsync({ id: v.id, status: 'inactive' }), 'Version retired')
                      }
                    >
                      <PauseCircle className="w-3.5 h-3.5 mr-1" /> Retire
                    </Button>
                  )}
                  {v.status === 'inactive' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-emerald-400"
                      onClick={() =>
                        act(setStatusMut.mutateAsync({ id: v.id, status: 'published' }), 'Version reactivated')
                      }
                    >
                      <PlayCircle className="w-3.5 h-3.5 mr-1" /> Reactivate
                    </Button>
                  )}
                  {v.status !== 'archived' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={() =>
                        act(setStatusMut.mutateAsync({ id: v.id, status: 'archived' }), 'Version archived')
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

      {/* Version snapshot viewer + audit trail */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">
                  {ruleName(viewing.rule_id)} — v{viewing.version}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Immutable snapshot · published {new Date(viewing.published_at).toLocaleString()}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Conditions
                  </h4>
                  <pre className="rounded-lg bg-surface/60 border border-border/40 p-3 text-[11px] overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(viewing.conditions, null, 2)}
                  </pre>
                </section>
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Outputs
                  </h4>
                  <pre className="rounded-lg bg-surface/60 border border-border/40 p-3 text-[11px] overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(viewing.outputs, null, 2)}
                  </pre>
                </section>
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Audit trail
                  </h4>
                  {audit.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No audit entries.</p>
                  ) : (
                    <ul className="space-y-1">
                      {audit.map((a: { id: string; action: string; created_at: string }) => (
                        <li key={a.id} className="text-[11px] text-muted-foreground flex gap-2">
                          <span className="text-foreground font-medium capitalize">{a.action}</span>
                          <span>{new Date(a.created_at).toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default XcapeAdminRuleVersions;
