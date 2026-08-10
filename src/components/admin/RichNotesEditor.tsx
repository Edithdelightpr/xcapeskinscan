import { useEffect, useRef, useState, type ReactNode } from 'react';
import { List, ListOrdered, CheckSquare, Heading2, Minus, Eye, Pencil } from 'lucide-react';

interface RichNotesEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minRows?: number;
  compact?: boolean;
}

/**
 * Lightweight notes editor. Plain text under the hood (markdown-ish).
 * Toolbar inserts: bullets, numbered steps, checkboxes, heading, divider.
 * Smart Enter continues list prefixes; empty prefix line clears it.
 * Preview toggle renders the structured output read-only.
 */
export function RichNotesEditor({
  value,
  onChange,
  placeholder,
  minRows = 6,
  compact = false,
}: RichNotesEditorProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [previewing, setPreviewing] = useState(false);

  // auto-grow
  useEffect(() => {
    const el = ref.current;
    if (!el || previewing) return;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, minRows * 22) + 'px';
  }, [value, previewing, minRows]);

  const insertAtCursor = (snippet: string) => {
    const el = ref.current;
    if (!el) {
      onChange((value || '') + snippet);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const before = value.slice(0, start);
    const after = value.slice(end);
    // ensure snippet starts on its own line if needed
    const needsNewline = before.length > 0 && !before.endsWith('\n');
    const insert = (needsNewline ? '\n' : '') + snippet;
    const next = before + insert + after;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = before.length + insert.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const insertBullet = () => insertAtCursor('• ');
  const insertCheckbox = () => insertAtCursor('[ ] ');
  const insertHeading = () => insertAtCursor('## ');
  const insertDivider = () => insertAtCursor('---\n');
  const insertNumbered = () => {
    // figure out next number based on prior numbered lines just above cursor
    const el = ref.current;
    const cursor = el?.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const lines = before.split('\n');
    let n = 1;
    for (let i = lines.length - 1; i >= 0; i--) {
      const m = lines[i].match(/^(\d+)\.\s/);
      if (m) {
        n = parseInt(m[1], 10) + 1;
        break;
      }
      if (lines[i].trim() === '') break;
    }
    insertAtCursor(`${n}. `);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    const el = e.currentTarget;
    const cursor = el.selectionStart ?? 0;
    const before = value.slice(0, cursor);
    const after = value.slice(el.selectionEnd ?? cursor);
    const lineStart = before.lastIndexOf('\n') + 1;
    const currentLine = before.slice(lineStart);

    const bulletMatch = currentLine.match(/^(•\s|\[\s?\]\s|\[x\]\s)(.*)$/);
    const numMatch = currentLine.match(/^(\d+)\.\s(.*)$/);

    if (!bulletMatch && !numMatch) return;

    const rest = bulletMatch ? bulletMatch[2] : numMatch![2];
    if (rest.trim() === '') {
      // empty list line → clear prefix
      e.preventDefault();
      const next = before.slice(0, lineStart) + after;
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = lineStart;
        el.setSelectionRange(pos, pos);
      });
      return;
    }

    e.preventDefault();
    let prefix = '';
    if (bulletMatch) {
      prefix = bulletMatch[1].startsWith('[') ? '[ ] ' : '• ';
    } else if (numMatch) {
      prefix = `${parseInt(numMatch[1], 10) + 1}. `;
    }
    const insert = '\n' + prefix;
    const next = before + insert + after;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = before.length + insert.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const btn =
    'p-1.5 rounded-md bg-surface text-muted-foreground hover:text-foreground hover:bg-surface/80 transition-colors';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1 flex-wrap">
        <button type="button" onClick={insertBullet} title="Bullet" className={btn}>
          <List className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={insertNumbered} title="Numbered step" className={btn}>
          <ListOrdered className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={insertCheckbox} title="Checkbox" className={btn}>
          <CheckSquare className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={insertHeading} title="Heading" className={btn}>
          <Heading2 className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={insertDivider} title="Divider" className={btn}>
          <Minus className="w-3.5 h-3.5" />
        </button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{value.length} chars</span>
          <button
            type="button"
            onClick={() => setPreviewing((p) => !p)}
            className={btn}
            title={previewing ? 'Edit' : 'Preview'}
          >
            {previewing ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {previewing ? (
        <div
          className={`w-full bg-surface/60 border border-border/60 rounded-md px-3 py-2 text-sm text-foreground ${
            compact ? 'min-h-[60px]' : 'min-h-[120px]'
          }`}
        >
          {value.trim() ? renderNotes(value) : (
            <p className="text-muted-foreground italic text-xs">Nothing to preview yet.</p>
          )}
        </div>
      ) : (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={minRows}
          className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none leading-relaxed font-sans"
        />
      )}
    </div>
  );
}

/**
 * Read-only renderer for the same markdown-ish format the editor produces.
 * Recognises: ## heading, • bullet, N. numbered, [ ] / [x] checkbox, ---
 */
export function renderNotes(text: string): ReactNode {
  if (!text || !text.trim()) return null;
  const lines = text.split('\n');
  const out: ReactNode[] = [];
  let bulletBuf: string[] = [];
  let numBuf: string[] = [];
  let checkBuf: { checked: boolean; text: string }[] = [];

  const flushBullets = () => {
    if (bulletBuf.length) {
      out.push(
        <ul key={`b-${out.length}`} className="list-disc pl-5 space-y-0.5">
          {bulletBuf.map((b, i) => <li key={i}>{b}</li>)}
        </ul>,
      );
      bulletBuf = [];
    }
  };
  const flushNumbers = () => {
    if (numBuf.length) {
      out.push(
        <ol key={`n-${out.length}`} className="list-decimal pl-5 space-y-0.5">
          {numBuf.map((b, i) => <li key={i}>{b}</li>)}
        </ol>,
      );
      numBuf = [];
    }
  };
  const flushChecks = () => {
    if (checkBuf.length) {
      out.push(
        <ul key={`c-${out.length}`} className="space-y-0.5">
          {checkBuf.map((c, i) => (
            <li key={i} className="flex items-start gap-2">
              <span
                className={`mt-0.5 inline-flex w-3.5 h-3.5 shrink-0 rounded border ${
                  c.checked ? 'bg-primary border-primary' : 'border-border/60 bg-surface'
                }`}
              />
              <span className={c.checked ? 'line-through text-muted-foreground' : ''}>{c.text}</span>
            </li>
          ))}
        </ul>,
      );
      checkBuf = [];
    }
  };
  const flushAll = () => { flushBullets(); flushNumbers(); flushChecks(); };

  lines.forEach((raw, i) => {
    const line = raw;
    if (/^---\s*$/.test(line)) {
      flushAll();
      out.push(<hr key={`h-${i}`} className="my-2 border-border/40" />);
      return;
    }
    if (/^##\s+/.test(line)) {
      flushAll();
      out.push(<p key={`hd-${i}`} className="font-display font-bold text-foreground mt-2">{line.replace(/^##\s+/, '')}</p>);
      return;
    }
    let m;
    if ((m = line.match(/^•\s+(.*)$/))) {
      flushNumbers(); flushChecks();
      bulletBuf.push(m[1]);
      return;
    }
    if ((m = line.match(/^\d+\.\s+(.*)$/))) {
      flushBullets(); flushChecks();
      numBuf.push(m[1]);
      return;
    }
    if ((m = line.match(/^\[(\s|x)\]\s+(.*)$/))) {
      flushBullets(); flushNumbers();
      checkBuf.push({ checked: m[1] === 'x', text: m[2] });
      return;
    }
    flushAll();
    if (line.trim() === '') {
      out.push(<div key={`sp-${i}`} className="h-1.5" />);
    } else {
      out.push(<p key={`p-${i}`} className="text-sm leading-relaxed">{line}</p>);
    }
  });
  flushAll();
  return <div className="space-y-1">{out}</div>;
}