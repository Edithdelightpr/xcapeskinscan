import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  CONDITION_FIELDS,
  OPERATOR_LABELS,
  fieldDef,
  type ConditionOperator,
  type RuleCondition,
  type RuleConditions,
} from '@/lib/xcapeRules/types';

/**
 * Visual condition builder for XCAPE recommendation rules.
 * Groups are joined with AND; each group is ALL (AND) or ANY (OR).
 * Admins never see or edit raw JSON.
 */

interface Props {
  value: RuleConditions;
  onChange: (v: RuleConditions) => void;
}

const NO_VALUE_OPS: ConditionOperator[] = ['is_true', 'is_false', 'present', 'absent'];

const emptyCondition = (): RuleCondition => ({
  field: CONDITION_FIELDS[0].key,
  operator: fieldDef(CONDITION_FIELDS[0].key)!.operators[0],
  value: '',
});

const ConditionRow = ({
  condition,
  onChange,
  onRemove,
}: {
  condition: RuleCondition;
  onChange: (c: RuleCondition) => void;
  onRemove: () => void;
}) => {
  const def = fieldDef(condition.field);
  const needsValue = !NO_VALUE_OPS.includes(condition.operator);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={condition.field}
        onValueChange={(f) => {
          const d = fieldDef(f);
          onChange({ field: f, operator: d?.operators[0] ?? 'contains', value: '' });
        }}
      >
        <SelectTrigger className="w-[200px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Array.from(new Set(CONDITION_FIELDS.map((f) => f.group))).map((group) => (
            <div key={group}>
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </p>
              {CONDITION_FIELDS.filter((f) => f.group === group).map((f) => (
                <SelectItem key={f.key} value={f.key} className="text-xs">
                  {f.label}
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={condition.operator}
        onValueChange={(op) => onChange({ ...condition, operator: op as ConditionOperator })}
      >
        <SelectTrigger className="w-[150px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(def?.operators ?? []).map((op) => (
            <SelectItem key={op} value={op} className="text-xs">
              {OPERATOR_LABELS[op]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {needsValue &&
        (def?.kind === 'select' && condition.operator !== 'in' ? (
          <Select
            value={condition.value ?? ''}
            onValueChange={(v) => onChange({ ...condition, value: v })}
          >
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              {(def.options ?? []).map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={condition.value ?? ''}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
            placeholder={
              condition.operator === 'in'
                ? 'comma-separated, e.g. I, II'
                : condition.operator === 'between'
                  ? 'e.g. 40-60'
                  : def?.placeholder ?? 'Value'
            }
            className="w-[200px] h-8 text-xs"
          />
        ))}

      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove}>
        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
      </Button>
    </div>
  );
};

const RuleConditionBuilder = ({ value, onChange }: Props) => {
  const groups = value.groups ?? [];

  const setGroup = (i: number, g: RuleConditions['groups'][number]) =>
    onChange({ groups: groups.map((old, idx) => (idx === i ? g : old)) });

  return (
    <div className="space-y-3">
      {groups.length === 0 && (
        <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border/60 p-3">
          No conditions yet — a rule without conditions never runs. Add a group below to define when
          this rule applies.
        </p>
      )}

      {groups.map((group, gi) => (
        <div key={gi} className="rounded-xl border border-border/50 bg-surface/40 p-3 space-y-2.5">
          {gi > 0 && (
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary text-center">
              — and —
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-border/50 p-0.5">
              {(['all', 'any'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setGroup(gi, { ...group, combinator: c })}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-colors',
                    group.combinator === c
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {c === 'all' ? 'All must match' : 'Any can match'}
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => onChange({ groups: groups.filter((_, idx) => idx !== gi) })}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove group
            </Button>
          </div>

          <div className="space-y-2">
            {group.conditions.map((cond, ci) => (
              <div key={ci} className="flex items-start gap-2">
                {ci > 0 && (
                  <span className="text-[10px] font-bold uppercase text-muted-foreground pt-2 w-8 shrink-0">
                    {group.combinator === 'all' ? 'and' : 'or'}
                  </span>
                )}
                <div className="flex-1">
                  <ConditionRow
                    condition={cond}
                    onChange={(c) =>
                      setGroup(gi, {
                        ...group,
                        conditions: group.conditions.map((old, idx) => (idx === ci ? c : old)),
                      })
                    }
                    onRemove={() =>
                      setGroup(gi, {
                        ...group,
                        conditions: group.conditions.filter((_, idx) => idx !== ci),
                      })
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => setGroup(gi, { ...group, conditions: [...group.conditions, emptyCondition()] })}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add condition
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-xs"
        onClick={() => onChange({ groups: [...groups, { combinator: 'all', conditions: [emptyCondition()] }] })}
      >
        <Plus className="w-3.5 h-3.5 mr-1" /> Add AND group
      </Button>
    </div>
  );
};

export default RuleConditionBuilder;
