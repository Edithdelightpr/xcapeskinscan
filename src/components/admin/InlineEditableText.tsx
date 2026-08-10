import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type CommonProps = {
  /** Whether the user has permission to edit. When false, renders read-only. */
  canEdit?: boolean;
  /** Tailwind classes applied to BOTH the read-only display and the input/textarea. */
  className?: string;
  /** Tailwind classes applied to the wrapper. */
  wrapperClassName?: string;
  /** Placeholder shown when value is empty. */
  placeholder?: string;
  /** Tooltip / aria label for the pencil button. */
  editLabel?: string;
  /** When true, allow saving an empty string (otherwise rejected). */
  allowEmpty?: boolean;
  /** When set, renders this prefix before the value (e.g. "₦"). */
  prefix?: string;
  /** When set, renders this suffix after the value (e.g. "/day"). */
  suffix?: string;
};

type TextProps = CommonProps & {
  kind?: 'text';
  value: string;
  onSave: (next: string) => void | Promise<void>;
  multiline?: boolean;
  /** Minimum number of textarea rows when multiline. */
  minRows?: number;
};

type NumberProps = CommonProps & {
  kind: 'number';
  value: number | undefined;
  onSave: (next: number | undefined) => void | Promise<void>;
  min?: number;
  step?: number;
  /** Optional formatter for the read-only display (e.g. naira). */
  format?: (v: number | undefined) => string;
};

type SelectProps<T extends string> = CommonProps & {
  kind: 'select';
  value: T;
  options: { value: T; label: string }[];
  onSave: (next: T) => void | Promise<void>;
};

export type InlineEditableProps<T extends string = string> =
  | TextProps
  | NumberProps
  | SelectProps<T>;

/**
 * Tiny click-to-edit primitive. Renders the value as text with a hover-revealed
 * pencil. Clicking the pencil swaps the text for an input that the user can
 * edit in place. Enter saves, Escape cancels, blur saves. Keeps progress,
 * status, and assignment context intact since callers wire it to existing
 * partial-update mutations.
 */
export function InlineEditableText(props: TextProps) {
  const { value, onSave, canEdit = true, className, wrapperClassName, placeholder, multiline, minRows = 2, allowEmpty, editLabel = 'Edit' } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if ('select' in inputRef.current) inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const next = (draft ?? '').trim();
    if (!allowEmpty && next.length === 0) {
      toast.error('Value cannot be empty');
      setDraft(value);
      setEditing(false);
      return;
    }
    if (next !== value) {
      try {
        void onSave(next);
      } catch {
        toast.error('Could not save change');
      }
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    } else if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
    }
  };

  if (editing && canEdit) {
    return (
      <div className={cn('flex items-start gap-1.5', wrapperClassName)}>
        {multiline ? (
          <textarea
            ref={(el) => (inputRef.current = el)}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            onBlur={commit}
            rows={minRows}
            placeholder={placeholder}
            className={cn(
              'flex-1 min-w-0 bg-surface border border-primary/40 rounded-md px-2 py-1.5 outline-none focus:border-primary',
              className
            )}
          />
        ) : (
          <input
            ref={(el) => (inputRef.current = el)}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            onBlur={commit}
            placeholder={placeholder}
            className={cn(
              'flex-1 min-w-0 bg-surface border border-primary/40 rounded-md px-2 py-1 outline-none focus:border-primary',
              className
            )}
          />
        )}
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); commit(); }}
          className="p-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
          title="Save"
          aria-label="Save"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); cancel(); }}
          className="p-1 rounded-md bg-surface text-muted-foreground hover:text-destructive transition-colors shrink-0"
          title="Cancel"
          aria-label="Cancel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const display = (value && value.length > 0) ? value : (placeholder ?? '—');
  return (
    <div className={cn('group inline-flex items-start gap-1.5 max-w-full', wrapperClassName)}>
      <span className={cn('break-words', !value && 'text-muted-foreground italic', className)}>
        {display}
      </span>
      {canEdit && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="p-0.5 rounded text-muted-foreground hover:text-primary transition-opacity opacity-60 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 shrink-0"
          title={editLabel}
          aria-label={editLabel}
        >
          <Pencil className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

export function InlineEditableNumber(props: NumberProps) {
  const { value, onSave, canEdit = true, className, wrapperClassName, placeholder, min = 0, step, prefix, suffix, format, editLabel = 'Edit' } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value?.toString() ?? '');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value?.toString() ?? '');
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    let next: number | undefined;
    if (trimmed === '') {
      next = undefined;
    } else {
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) {
        toast.error('Enter a valid number');
        setDraft(value?.toString() ?? '');
        setEditing(false);
        return;
      }
      if (min !== undefined && parsed < min) {
        toast.error(`Value must be ≥ ${min}`);
        setDraft(value?.toString() ?? '');
        setEditing(false);
        return;
      }
      next = parsed;
    }
    if (next !== value) {
      try { void onSave(next); } catch { toast.error('Could not save change'); }
    }
    setEditing(false);
  };

  const cancel = () => { setDraft(value?.toString() ?? ''); setEditing(false); };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    else if (e.key === 'Enter') { e.preventDefault(); commit(); }
  };

  if (editing && canEdit) {
    return (
      <div className={cn('inline-flex items-center gap-1', wrapperClassName)}>
        {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={commit}
          min={min}
          step={step}
          placeholder={placeholder}
          className={cn('w-20 bg-surface border border-primary/40 rounded px-2 py-0.5 outline-none focus:border-primary', className)}
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    );
  }

  const display = format ? format(value) : (value === undefined ? (placeholder ?? '—') : `${prefix ?? ''}${value}${suffix ?? ''}`);
  return (
    <span className={cn('group inline-flex items-center gap-1', wrapperClassName)}>
      <span className={cn(value === undefined && 'text-muted-foreground italic', className)}>{display}</span>
      {canEdit && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="p-0.5 rounded text-muted-foreground hover:text-primary transition-opacity opacity-60 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
          title={editLabel}
          aria-label={editLabel}
        >
          <Pencil className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}

export function InlineEditableSelect<T extends string>(props: SelectProps<T>) {
  const { value, options, onSave, canEdit = true, className, wrapperClassName, editLabel = 'Edit' } = props;
  const [editing, setEditing] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? value;

  if (editing && canEdit) {
    return (
      <select
        autoFocus
        value={value}
        onChange={(e) => { void onSave(e.target.value as T); setEditing(false); }}
        onBlur={() => setEditing(false)}
        className={cn('bg-surface border border-primary/40 rounded-md px-2 py-1 text-xs text-foreground outline-none focus:border-primary', className, wrapperClassName)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  return (
    <span className={cn('group inline-flex items-center gap-1', wrapperClassName)}>
      <span className={className}>{current}</span>
      {canEdit && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="p-0.5 rounded text-muted-foreground hover:text-primary transition-opacity opacity-60 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
          title={editLabel}
          aria-label={editLabel}
        >
          <Pencil className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}

export default InlineEditableText;