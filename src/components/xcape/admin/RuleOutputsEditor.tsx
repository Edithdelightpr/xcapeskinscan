import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FieldStack } from '@/components/admin/assessmentShared';
import { useServices } from '@/hooks/useServices';
import { useProducts } from '@/hooks/useProducts';
import { useActiveXcapeProtocols } from '@/hooks/useXcapeProtocols';
import type { DoseTier, RuleOutputs } from '@/lib/xcapeRules/types';
import {
  CUSTOMIZATION_CATEGORIES,
  PROVISIONAL_DOSE_TIERS,
  validateDoseTiers,
} from '@/lib/xcapeRules/customization';

/**
 * Structured editor for what a matching rule proposes. All fields are
 * optional; everything the admin enters here is shown to the practitioner
 * as a proposal (never applied automatically).
 */

interface Props {
  value: RuleOutputs;
  onChange: (v: RuleOutputs) => void;
}

const RuleOutputsEditor = ({ value, onChange }: Props) => {
  const { data: services = [] } = useServices({ activeOnly: true });
  const { data: products = [] } = useProducts();
  const { data: protocols = [] } = useActiveXcapeProtocols();
  const [svcPick, setSvcPick] = useState('');
  const [prodPick, setProdPick] = useState('');

  const activeProducts = useMemo(() => products.filter((p) => p.active), [products]);

  const addService = (id: string) => {
    const svc = services.find((s) => s.id === id);
    if (!svc) return;
    if ((value.services ?? []).some((s) => s.service_id === id)) return;
    onChange({
      ...value,
      services: [...(value.services ?? []), { service_id: svc.id, name: svc.name, sessions: null, note: null }],
    });
    setSvcPick('');
  };

  const addProduct = (id: string) => {
    const prod = activeProducts.find((p) => p.id === id);
    if (!prod) return;
    if ((value.products ?? []).some((p) => p.product_id === id)) return;
    onChange({
      ...value,
      products: [...(value.products ?? []), { product_id: prod.id, name: prod.name, note: null }],
    });
    setProdPick('');
  };

  const toggleProtocol = (id: string) => {
    const current = value.protocol_ids ?? [];
    onChange({
      ...value,
      protocol_ids: current.includes(id) ? current.filter((p) => p !== id) : [...current, id],
    });
  };

  const lines = (text: string) => text.split('\n').map((s) => s.trim()).filter(Boolean);
  const toText = (arr?: string[]) => (arr ?? []).join('\n');

  const tierErrors = value.customization ? validateDoseTiers(value.customization.dose_tiers) : [];

  const setTier = (i: number, patch: Partial<DoseTier>) => {
    if (!value.customization) return;
    onChange({
      ...value,
      customization: {
        ...value.customization,
        dose_tiers: value.customization.dose_tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)),
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Protocols */}
      <FieldStack label="Protocols to propose (from Protocol Library)">
        {protocols.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No active protocols yet — create them in the Protocol Library, then link them here.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {protocols.map((p) => {
              const selected = (value.protocol_ids ?? []).includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleProtocol(p.id)}
                  className={
                    selected
                      ? 'rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs text-foreground'
                      : 'rounded-full border border-border/50 px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40'
                  }
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        )}
      </FieldStack>

      {/* Services */}
      <FieldStack label="Treatments / services to propose">
        <div className="space-y-1.5">
          {(value.services ?? []).map((s, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">{s.name}</Badge>
              <Input
                type="number"
                min={1}
                value={s.sessions ?? ''}
                onChange={(e) =>
                  onChange({
                    ...value,
                    services: (value.services ?? []).map((old, idx) =>
                      idx === i ? { ...old, sessions: e.target.value ? Number(e.target.value) : null } : old,
                    ),
                  })
                }
                placeholder="Sessions"
                className="h-7 w-24 text-xs"
              />
              <Input
                value={s.note ?? ''}
                onChange={(e) =>
                  onChange({
                    ...value,
                    services: (value.services ?? []).map((old, idx) =>
                      idx === i ? { ...old, note: e.target.value || null } : old,
                    ),
                  })
                }
                placeholder="Note (optional)"
                className="h-7 flex-1 min-w-[140px] text-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() =>
                  onChange({ ...value, services: (value.services ?? []).filter((_, idx) => idx !== i) })
                }
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          <Select value={svcPick} onValueChange={addService}>
            <SelectTrigger className="h-8 text-xs w-full sm:w-[280px]">
              <SelectValue placeholder="+ Add service from catalogue" />
            </SelectTrigger>
            <SelectContent>
              {services.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FieldStack>

      {/* Products */}
      <FieldStack label="Products / home-care items to propose">
        <div className="space-y-1.5">
          {(value.products ?? []).map((p, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">{p.name}</Badge>
              <Input
                value={p.note ?? ''}
                onChange={(e) =>
                  onChange({
                    ...value,
                    products: (value.products ?? []).map((old, idx) =>
                      idx === i ? { ...old, note: e.target.value || null } : old,
                    ),
                  })
                }
                placeholder="Usage note (optional)"
                className="h-7 flex-1 min-w-[140px] text-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() =>
                  onChange({ ...value, products: (value.products ?? []).filter((_, idx) => idx !== i) })
                }
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          <Select value={prodPick} onValueChange={addProduct}>
            <SelectTrigger className="h-8 text-xs w-full sm:w-[280px]">
              <SelectValue placeholder="+ Add product from catalogue" />
            </SelectTrigger>
            <SelectContent>
              {activeProducts.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FieldStack>

      {/* Schedule */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <FieldStack label="Frequency">
          <Input
            value={value.frequency ?? ''}
            onChange={(e) => onChange({ ...value, frequency: e.target.value || null })}
            placeholder="e.g. weekly"
            className="h-8 text-xs"
          />
        </FieldStack>
        <FieldStack label="Duration">
          <Input
            value={value.duration ?? ''}
            onChange={(e) => onChange({ ...value, duration: e.target.value || null })}
            placeholder="e.g. 8 weeks"
            className="h-8 text-xs"
          />
        </FieldStack>
        <FieldStack label="Sessions">
          <Input
            type="number"
            min={1}
            value={value.sessions ?? ''}
            onChange={(e) => onChange({ ...value, sessions: e.target.value ? Number(e.target.value) : null })}
            placeholder="e.g. 6"
            className="h-8 text-xs"
          />
        </FieldStack>
        <FieldStack label="Follow-up (weeks)">
          <Input
            type="number"
            min={0}
            value={value.follow_up_weeks ?? ''}
            onChange={(e) =>
              onChange({ ...value, follow_up_weeks: e.target.value ? Number(e.target.value) : null })
            }
            placeholder="e.g. 4"
            className="h-8 text-xs"
          />
        </FieldStack>
      </div>

      <FieldStack label="Home-care guidance">
        <Textarea
          value={value.home_care ?? ''}
          onChange={(e) => onChange({ ...value, home_care: e.target.value || null })}
          placeholder="e.g. Gentle cleanser AM/PM, SPF 50 daily"
          rows={2}
          className="text-sm"
        />
      </FieldStack>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldStack label="Warnings (one per line)">
          <Textarea
            value={toText(value.warnings)}
            onChange={(e) => onChange({ ...value, warnings: lines(e.target.value) })}
            placeholder="e.g. Avoid active peels during pregnancy"
            rows={3}
            className="text-sm"
          />
        </FieldStack>
        <FieldStack label="Alternatives (one per line)">
          <Textarea
            value={toText(value.alternatives)}
            onChange={(e) => onChange({ ...value, alternatives: lines(e.target.value) })}
            placeholder="e.g. Hydrating facial instead of peel"
            rows={3}
            className="text-sm"
          />
        </FieldStack>
      </div>

      <FieldStack label="Rationale shown to the practitioner">
        <Textarea
          value={value.rationale ?? ''}
          onChange={(e) => onChange({ ...value, rationale: e.target.value || null })}
          placeholder="Explain why this rule proposes these options (e.g. which findings it responds to)"
          rows={2}
          className="text-sm"
        />
      </FieldStack>

      {/* Formula customization */}
      <div className="rounded-lg border border-border/50 p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-xs font-medium">Formula customization</Label>
            <p className="text-[11px] text-muted-foreground">
              When this rule matches, propose a concrete XCAPE formula for one analysis category. The
              kit, base product, active and companion come from the admin category mapping — the tiers
              below set the dose. Tiers stay provisional until clinically confirmed.
            </p>
          </div>
          <Switch
            checked={!!value.customization}
            onCheckedChange={(on) =>
              onChange({
                ...value,
                customization: on
                  ? {
                      category: CUSTOMIZATION_CATEGORIES[0].key,
                      dose_tiers: PROVISIONAL_DOSE_TIERS.map((t) => ({ ...t })),
                      instructions: null,
                      warnings: [],
                    }
                  : null,
              })
            }
          />
        </div>
        {value.customization && (
          <div className="space-y-3">
            <FieldStack label="Analysis category to customize">
              <Select
                value={value.customization.category}
                onValueChange={(v) =>
                  onChange({ ...value, customization: { ...value.customization!, category: v } })
                }
              >
                <SelectTrigger className="h-8 text-xs w-full sm:w-[280px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMIZATION_CATEGORIES.map((c) => (
                    <SelectItem key={c.key} value={c.key} className="text-xs">
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldStack>

            <FieldStack label="Dose tiers — score range → active dose (provisional, editable)">
              <div className="space-y-1.5">
                {value.customization.dose_tiers.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-muted-foreground">Score</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={t.score_min}
                      onChange={(e) => setTier(i, { score_min: Number(e.target.value) })}
                      className="h-7 w-16 text-xs"
                    />
                    <span className="text-[11px] text-muted-foreground">–</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={t.score_max}
                      onChange={(e) => setTier(i, { score_max: Number(e.target.value) })}
                      className="h-7 w-16 text-xs"
                    />
                    <span className="text-[11px] text-muted-foreground">→</span>
                    <Input
                      type="number"
                      step="0.1"
                      min={0}
                      value={t.dose_ml}
                      onChange={(e) => setTier(i, { dose_ml: Number(e.target.value) })}
                      className="h-7 w-20 text-xs"
                    />
                    <span className="text-[11px] text-muted-foreground">ml</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() =>
                        onChange({
                          ...value,
                          customization: {
                            ...value.customization!,
                            dose_tiers: value.customization!.dose_tiers.filter((_, idx) => idx !== i),
                          },
                        })
                      }
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    onChange({
                      ...value,
                      customization: {
                        ...value.customization!,
                        dose_tiers: [
                          ...value.customization!.dose_tiers,
                          { score_min: 0, score_max: 0, dose_ml: 1 },
                        ],
                      },
                    })
                  }
                >
                  + Add tier
                </Button>
              </div>
              {tierErrors.length > 0 && (
                <ul className="space-y-0.5 pt-1">
                  {tierErrors.map((e, i) => (
                    <li key={i} className="text-[11px] text-red-400">
                      {e}
                    </li>
                  ))}
                </ul>
              )}
            </FieldStack>

            <FieldStack label="Client-facing usage instructions (optional)">
              <Textarea
                value={value.customization.instructions ?? ''}
                onChange={(e) =>
                  onChange({
                    ...value,
                    customization: { ...value.customization!, instructions: e.target.value || null },
                  })
                }
                placeholder="e.g. Mix the active into the moisturizer, apply AM and PM"
                rows={2}
                className="text-sm"
              />
            </FieldStack>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2.5">
        <div>
          <Label className="text-xs font-medium">Requires human review</Label>
          <p className="text-[11px] text-muted-foreground">
            Flag this proposal as needing mandatory practitioner sign-off before use.
          </p>
        </div>
        <Switch
          checked={value.requires_human_review ?? false}
          onCheckedChange={(v) => onChange({ ...value, requires_human_review: v })}
        />
      </div>

      <div className="flex items-center gap-1 text-muted-foreground">
        <Plus className="w-3 h-3" />
        <p className="text-[10px]">
          Proposals are never applied automatically — the practitioner reviews, edits or rejects each one.
        </p>
      </div>
    </div>
  );
};

export default RuleOutputsEditor;
