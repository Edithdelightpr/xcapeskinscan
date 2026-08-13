import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Sparkles, Check, Pencil, XCircle, AlertTriangle, ShieldAlert, UserCheck, RefreshCw, FlaskConical,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import RuleOutputsEditor from '@/components/xcape/admin/RuleOutputsEditor';
import { useXcapeRules, useXcapeRuleVersions } from '@/hooks/useXcapeRules';
import { useActiveXcapeProtocols } from '@/hooks/useXcapeProtocols';
import { useActiveContraindications } from '@/hooks/useXcapeContraindications';
import { useClientSafetyIntakes } from '@/hooks/useSafetyIntakes';
import {
  useAssessmentProposals,
  useCreateProposals,
  useDecideProposal,
} from '@/hooks/useXcapeProposals';
import { buildEvalContext, evaluateRules, selectExecutableRules } from '@/lib/xcapeRules/evaluate';
import { useProducts } from '@/hooks/useProducts';
import {
  useActiveCategoryCustomizations,
  useCreateFormulaSnapshot,
  useFormulaSnapshots,
} from '@/hooks/useXcapeCustomization';
import {
  CUSTOMIZATION_CATEGORIES,
  resolveDose,
  resolveFormula,
  type ResolvedFormula,
} from '@/lib/xcapeRules/customization';
import { useProtocolAlignments } from '@/hooks/useProductAlignments';
import { protocolFormulaLines, resolveProtocol } from '@/lib/xcapeRules/protocol';
import { scoresFromSkin } from '@/components/xcape/protocol/StaffProtocolPanel';
import type { RuleOutputs, XcapeProposal } from '@/lib/xcapeRules/types';
import type { SkinAnalysisPayload } from '@/hooks/useVisitAssessments';
import { cn } from '@/lib/utils';

/**
 * XCAPE proposals — the practitioner-facing half of the criteria layer.
 *
 * Evaluates ONLY published, non-demo rules against the current analysis +
 * intake context, renders each match as "Proposed by XCAPE" with the
 * findings that triggered it, and records accept / edit / reject decisions
 * with the exact rule version, practitioner identity and reason. Nothing is
 * applied to the assessment until the practitioner accepts.
 */

interface Props {
  clientId: string;
  /** Null until the assessment has been saved at least once. */
  assessmentId: string | null;
  ensureSaved: () => Promise<{ id: string }>;
  skin: SkinAnalysisPayload;
  redFlags: string;
  observation: string;
  /** Apply accepted proposal content into the wizard's recommendation state. */
  onApply: (outputs: RuleOutputs) => void;
}

const ProposalStatusBadge = ({ status }: { status: XcapeProposal['status'] }) => {
  const meta = {
    proposed: 'border-primary/50 text-primary',
    accepted: 'border-emerald-500/50 text-emerald-400',
    edited: 'border-emerald-500/50 text-emerald-400',
    rejected: 'border-red-500/50 text-red-400',
  }[status];
  const label = { proposed: 'Awaiting decision', accepted: 'Accepted', edited: 'Accepted with edits', rejected: 'Rejected' }[status];
  return (
    <Badge variant="outline" className={cn('text-[10px]', meta)}>
      {label}
    </Badge>
  );
};

const OutputsSummary = ({ outputs }: { outputs: RuleOutputs }) => {
  const bits: string[] = [];
  if (outputs.services?.length) bits.push(`Treatments: ${outputs.services.map((s) => s.name).join(', ')}`);
  if (outputs.products?.length) bits.push(`Products: ${outputs.products.map((p) => p.name).join(', ')}`);
  if (outputs.frequency) bits.push(`Frequency: ${outputs.frequency}`);
  if (outputs.duration) bits.push(`Duration: ${outputs.duration}`);
  if (outputs.sessions != null) bits.push(`Sessions: ${outputs.sessions}`);
  if (outputs.home_care) bits.push(`Home care: ${outputs.home_care}`);
  if (outputs.follow_up_weeks != null) bits.push(`Follow-up: ${outputs.follow_up_weeks} weeks`);
  if (bits.length === 0) return <p className="text-xs text-muted-foreground">No structured outputs on this proposal.</p>;
  return (
    <ul className="space-y-0.5">
      {bits.map((b, i) => (
        <li key={i} className="text-xs text-foreground">{b}</li>
      ))}
    </ul>
  );
};

const XcapeProposalsPanel = ({
  clientId,
  assessmentId,
  ensureSaved,
  skin,
  redFlags,
  observation,
  onApply,
}: Props) => {
  const { data: rules = [] } = useXcapeRules();
  const { data: versions = [] } = useXcapeRuleVersions();
  const { data: protocols = [] } = useActiveXcapeProtocols();
  const { data: contraindications = [] } = useActiveContraindications();
  const { data: intakes = [] } = useClientSafetyIntakes(clientId);
  const { data: proposals = [] } = useAssessmentProposals(assessmentId);
  const createMut = useCreateProposals();
  const decideMut = useDecideProposal();
  const { data: products = [] } = useProducts();
  const { data: categoryMaps = [] } = useActiveCategoryCustomizations();
  const { data: formulaSnapshots = [] } = useFormulaSnapshots(assessmentId);
  const snapshotMut = useCreateFormulaSnapshot();
  const { alignments } = useProtocolAlignments();

  /** Deterministic protocol resolved from the approved scores + admin
   *  alignment. Snapshotted per approved formula so the issued report keeps
   *  the exact face/body lines that were true at approval time. */
  const protocolResult = useMemo(
    () =>
      resolveProtocol({
        scores: scoresFromSkin(skin),
        alignments,
      }),
    [skin, alignments],
  );

  const [rejecting, setRejecting] = useState<XcapeProposal | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [editing, setEditing] = useState<XcapeProposal | null>(null);
  const [editOutputs, setEditOutputs] = useState<RuleOutputs>({});
  const [editReason, setEditReason] = useState('');

  const latestIntake = intakes[0] ?? null;

  const ctx = useMemo(
    () =>
      buildEvalContext({
        skin,
        redFlags: redFlags.split(',').map((s) => s.trim()).filter(Boolean),
        observation,
        intake: latestIntake,
      }),
    [skin, redFlags, observation, latestIntake],
  );

  const executable = useMemo(() => selectExecutableRules(rules, versions), [rules, versions]);

  const productById = (id: string | null | undefined) => products.find((p) => p.id === id);

  const categoryLabel = (key: string) =>
    CUSTOMIZATION_CATEGORIES.find((c) => c.key === key)?.label ?? key;

  /** Resolve a proposal's customization output into a concrete formula using
   *  the active admin mapping and the practitioner-approved category score. */
  const formulaFor = (outputs: RuleOutputs): ResolvedFormula | null => {
    const c = outputs.customization;
    if (!c) return null;
    const mapping = categoryMaps.find((m) => m.category === c.category);
    const raw = ctx[`score.${c.category}`];
    return resolveFormula(c, mapping, typeof raw === 'number' ? raw : null);
  };

  /** Evaluate live (without persisting) so the practitioner sees what would
   *  match before generating traceable proposal records. */
  const previewMatches = useMemo(() => {
    const alreadyProposed = new Set(proposals.map((p) => p.rule_version_id));
    return evaluateRules(executable, ctx).filter((m) => !alreadyProposed.has(m.version.id));
  }, [executable, ctx, proposals]);

  /** Contraindications relevant to a proposal's outputs. */
  const warningsFor = (outputs: RuleOutputs): string[] => {
    const names = [
      ...(outputs.services ?? []).map((s) => s.name),
      ...(outputs.products ?? []).map((p) => p.name),
      ...(outputs.protocols_text ?? []).map((p) => p.name),
      ...(outputs.protocol_ids ?? []).map((id) => protocols.find((p) => p.id === id)?.name ?? ''),
    ]
      .filter(Boolean)
      .map((n) => n.toLowerCase());
    const hits = contraindications.filter((c) => {
      if (!c.target_name) return false;
      const target = c.target_name.toLowerCase();
      return names.some((n) => n.includes(target) || target.includes(n));
    });
    return [
      ...hits.map((c) => `${c.name}: ${c.message}`),
      ...(outputs.warnings ?? []),
    ];
  };

  const generate = async () => {
    try {
      const saved = await ensureSaved();
      if (previewMatches.length === 0) {
        toast.info(
          executable.length === 0
            ? 'No published XCAPE criteria yet — professional review required.'
            : 'No published rule matched this analysis — professional review required.',
        );
        return;
      }
      await createMut.mutateAsync({
        assessmentId: saved.id,
        clientId,
        matches: previewMatches,
        engineVersion: skin.engine ? 'xcape-engine-v1' : null,
      });
      toast.success(`${previewMatches.length} proposal(s) generated — review each one below`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate proposals');
    }
  };

  const decide = async (
    p: XcapeProposal,
    status: 'accepted' | 'edited' | 'rejected',
    reason: string | null,
    finalResult: RuleOutputs | null,
  ) => {
    if (!assessmentId) return;
    try {
      await decideMut.mutateAsync({ id: p.id, assessmentId, status, reason: reason ?? undefined, finalResult });
      if (status === 'rejected') {
        toast.success('Proposal rejected — reason recorded');
        return;
      }
      const outputs = finalResult ?? p.proposal;
      const formula = formulaFor(outputs);
      if (formula && !formulaSnapshots.some((s) => s.proposal_id === p.id)) {
        // The approved formula is snapshotted immutably — catalogue prices or
        // rule changes later never rewrite it. This snapshot is what flows to
        // the report, cart and order.
        await snapshotMut.mutateAsync({
          assessmentId,
          proposalId: p.id,
          clientId,
          formula,
          names: {
            kit_name: productById(formula.kit_product_id)?.name ?? null,
            kit_unit_price: productById(formula.kit_product_id)?.selling_price ?? null,
            base_product_name: productById(formula.base_product_id)?.name ?? null,
            active_name: productById(formula.active_product_id)?.name ?? null,
            companion_name: productById(formula.companion_product_id)?.name ?? null,
          },
          protocolLines: protocolFormulaLines(protocolResult).filter(
            (l) => l.category === formula.category,
          ),
          protocolVersion: protocolResult.version,
          rule: { rule_id: p.rule_id, rule_version_id: p.rule_version_id, rule_version: p.rule_version },
          decisionReason: reason,
        });
      }
      onApply(outputs);
      toast.success(status === 'edited' ? 'Edited proposal accepted & applied' : 'Proposal accepted & applied');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Decision failed');
    }
  };

  const submitReject = () => {
    if (!rejecting) return;
    if (!rejectReason.trim()) {
      toast.error('A reason is required when rejecting a proposal');
      return;
    }
    decide(rejecting, 'rejected', rejectReason.trim(), null);
    setRejecting(null);
    setRejectReason('');
  };

  const submitEdit = () => {
    if (!editing) return;
    if (!editReason.trim()) {
      toast.error('A reason is required when changing a proposal');
      return;
    }
    decide(editing, 'edited', editReason.trim(), editOutputs);
    setEditing(null);
    setEditReason('');
  };

  const pendingCount = proposals.filter((p) => p.status === 'proposed').length;

  return (
    <section className="glass rounded-xl p-5 space-y-4 border-l-2 border-l-primary/60">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" /> XCAPE proposed solutions
          </h2>
          <p className="text-[11px] text-muted-foreground max-w-2xl">
            Published XCAPE criteria are evaluated against this analysis and the client's intake.
            Every proposal is labelled, traceable to an exact rule version, and only applied when you
            accept it. Proposals are suggestions — never a diagnosis.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs shrink-0"
          disabled={createMut.isPending || !skin.engine}
          onClick={generate}
          title={!skin.engine ? 'Complete the analysis first (step 3–4)' : undefined}
        >
          <RefreshCw className={cn('w-3.5 h-3.5 mr-1', createMut.isPending && 'animate-spin')} />
          {proposals.length > 0 ? 'Check for new proposals' : 'Generate proposals'}
        </Button>
      </div>

      {executable.length === 0 && (
        <div className="rounded-lg border border-dashed border-border/60 p-4 text-center">
          <p className="text-xs text-foreground font-medium">Professional review required</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            No published XCAPE criteria exist yet. Select recommendations manually below — nothing is
            fabricated.
          </p>
        </div>
      )}

      {executable.length > 0 && proposals.length === 0 && previewMatches.length === 0 && (
        <div className="rounded-lg border border-dashed border-border/60 p-4">
          <p className="text-[11px] text-muted-foreground">
            {executable.length} published rule(s) available. Generate proposals to evaluate them against
            this analysis, or select recommendations manually below.
          </p>
        </div>
      )}

      {pendingCount > 0 && (
        <p className="text-[11px] text-amber-400">
          {pendingCount} proposal(s) awaiting your decision — the report should only be generated after
          each is accepted, edited or rejected.
        </p>
      )}

      {/* Live preview of rules that would match but have no proposal record yet */}
      {previewMatches.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {previewMatches.length} rule(s) currently match this analysis — generate proposals to review
          them formally.
        </p>
      )}

      {/* Proposal cards */}
      <div className="space-y-3">
        {proposals.map((p) => {
          const effectiveOutputs = p.status === 'edited' && p.final_result ? p.final_result : p.proposal;
          const warnings = warningsFor(effectiveOutputs);
          const formula = formulaFor(effectiveOutputs);
          const customizationOut = effectiveOutputs.customization ?? null;
          // A customization proposal without an active category mapping shows
          // its matched protocol/dose logic for review but can NOT be
          // approved — no formula, no snapshot, no purchase path.
          const mappingMissing = !!customizationOut && !formula;
          const rawCategoryScore = customizationOut ? ctx[`score.${customizationOut.category}`] : null;
          const pendingDose =
            customizationOut && typeof rawCategoryScore === 'number'
              ? resolveDose(customizationOut.dose_tiers, rawCategoryScore)
              : null;
          const snapshot = formulaSnapshots.find((s) => s.proposal_id === p.id);
          const linkedProtocols = (p.proposal.protocol_ids ?? [])
            .map((id) => protocols.find((pr) => pr.id === id))
            .filter(Boolean);
          const awaiting = p.status === 'proposed';

          return (
            <article
              key={p.id}
              className={cn(
                'rounded-xl border p-4 space-y-3',
                awaiting ? 'border-primary/40 bg-primary/5' : 'border-border/40 bg-surface/30',
              )}
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{p.rule_name ?? 'XCAPE rule'}</p>
                    {p.rule_version != null && (
                      <Badge variant="secondary" className="text-[10px]">rule v{p.rule_version}</Badge>
                    )}
                    <ProposalStatusBadge status={p.status} />
                    {(p.proposal.requires_human_review) && (
                      <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-400">
                        <UserCheck className="w-3 h-3 mr-1" /> Human review required
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-primary font-semibold">
                    Proposed by XCAPE — pending practitioner approval
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(p.created_at).toLocaleString()}
                </p>
              </div>

              {/* Why it matched */}
              {p.matched_reasons.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Triggered by these findings
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {p.matched_reasons.map((r, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] font-normal">
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {p.proposal.rationale && (
                <p className="text-xs text-muted-foreground italic">{p.proposal.rationale}</p>
              )}

              {linkedProtocols.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Protocols
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {linkedProtocols.map((pr) => (
                      <Badge key={pr!.id} variant="secondary" className="text-[10px]">
                        {pr!.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <OutputsSummary outputs={effectiveOutputs} />

              {/* XCAPE customization formula — resolved from the rule tiers,
                  the admin category mapping and the approved category score. */}
              {formula ? (
                <div className="rounded-lg border border-primary/30 bg-surface/40 p-3 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FlaskConical className="w-3.5 h-3.5 text-primary" />
                    <p className="text-xs font-semibold text-foreground">
                      XCAPE customization formula — {categoryLabel(formula.category)}
                    </p>
                    {formula.is_demo && (
                      <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-400">
                        Demo mapping
                      </Badge>
                    )}
                    {snapshot && (
                      <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-400">
                        Formula saved
                      </Badge>
                    )}
                  </div>
                  <ul className="text-[11px] text-foreground space-y-0.5">
                    <li>Kit: {productById(formula.kit_product_id)?.name ?? '— not mapped —'}</li>
                    <li>Customize: {productById(formula.base_product_id)?.name ?? '— not mapped —'}</li>
                    <li>
                      Active: {productById(formula.active_product_id)?.name ?? '— not mapped —'}
                      {formula.dose_ml != null
                        ? ` — ${formula.dose_ml} ml`
                        : ' — dose unresolved (score outside tiers)'}
                    </li>
                    {formula.requires_companion && (
                      <li>
                        Companion (required): {productById(formula.companion_product_id)?.name ?? '— not mapped —'}
                        {formula.companion_dose_ml != null ? ` — ${formula.companion_dose_ml} ml` : ''}
                      </li>
                    )}
                    {formula.score != null && (
                      <li className="text-muted-foreground">
                        Based on an approved {categoryLabel(formula.category)} score of {formula.score}/100
                      </li>
                    )}
                  </ul>
                  {formula.instructions && (
                    <p className="text-[11px] text-muted-foreground">{formula.instructions}</p>
                  )}
                </div>
              ) : (
                customizationOut && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
                      <p className="text-xs font-semibold text-amber-300">
                        XCAPE product/kit mapping required — {categoryLabel(customizationOut.category)}
                      </p>
                    </div>
                    <ul className="text-[11px] text-foreground space-y-0.5">
                      {pendingDose && typeof rawCategoryScore === 'number' && (
                        <li>
                          Dose logic: score {rawCategoryScore}/100 → tier{' '}
                          {pendingDose.tier.score_min}–{pendingDose.tier.score_max} →{' '}
                          {pendingDose.dose_ml} ml
                        </li>
                      )}
                      {(customizationOut.dose_tiers?.length ?? 0) > 0 && (
                        <li className="text-muted-foreground">
                          Tiers:{' '}
                          {customizationOut.dose_tiers
                            .map((t) => `${t.score_min}–${t.score_max} ⇒ ${t.dose_ml} ml`)
                            .join(' · ')}
                        </li>
                      )}
                    </ul>
                    <p className="text-[11px] text-amber-300">
                      The matched protocol and dose logic are shown for review, but this formula
                      cannot be approved or purchased until an admin activates the category mapping
                      under Products &amp; Ingredients → Kits &amp; Customization. Product identity,
                      concentration, max-safe-dose, contraindication and final kit mapping await
                      catalogue completion.
                    </p>
                  </div>
                )
              )}

              {(p.proposal.alternatives?.length ?? 0) > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Alternatives: {p.proposal.alternatives!.join(' · ')}
                </p>
              )}

              {warnings.length > 0 && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 space-y-1">
                  {warnings.map((w, i) => (
                    <p key={i} className="text-[11px] text-amber-300 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {w}
                    </p>
                  ))}
                </div>
              )}

              {p.decision_reason && (
                <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Decision reason: {p.decision_reason}
                </p>
              )}

              {awaiting && (
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <Button
                    type="button"
                    size="sm"
                    className="text-xs glow-primary"
                    disabled={decideMut.isPending || mappingMissing}
                    title={mappingMissing ? 'XCAPE product/kit mapping required — an admin must activate the category mapping before this formula can be approved' : undefined}
                    onClick={() => decide(p, 'accepted', null, null)}
                  >
                    <Check className="w-3.5 h-3.5 mr-1" /> Accept & apply
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    disabled={decideMut.isPending || mappingMissing}
                    title={mappingMissing ? 'XCAPE product/kit mapping required — an admin must activate the category mapping before this formula can be approved' : undefined}
                    onClick={() => {
                      setEditing(p);
                      setEditOutputs(p.proposal);
                      setEditReason('');
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Edit & accept
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-xs text-red-400"
                    disabled={decideMut.isPending}
                    onClick={() => {
                      setRejecting(p);
                      setRejectReason('');
                    }}
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                  </Button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Reject dialog — reason mandatory */}
      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Reject proposal</DialogTitle>
            <DialogDescription className="text-xs">
              A reason is required — it becomes part of the audit trail for this recommendation.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder="Why is this proposal not appropriate for this client?"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={submitReject} disabled={decideMut.isPending}>
              Reject proposal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog — reason mandatory */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Edit proposal before accepting</DialogTitle>
            <DialogDescription className="text-xs">
              Adjust the proposal, then explain the change. Both the original proposal and your edited
              result are kept in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <RuleOutputsEditor value={editOutputs} onChange={setEditOutputs} />
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Reason for the change (required)
              </p>
              <Textarea
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                rows={2}
                placeholder="e.g. Reduced sessions — client sensitivity"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="button" onClick={submitEdit} disabled={decideMut.isPending} className="glow-primary">
              Accept edited proposal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default XcapeProposalsPanel;
