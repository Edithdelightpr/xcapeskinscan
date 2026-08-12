import { Check, Focus, Sun, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SCAN_VIEWS, type Guidance, type ScanViewId } from '@/lib/scan/scanQuality';

export type FlowStep = 'capture' | 'analyze' | 'report';

interface Props {
  /** Which of the three top-level steps is live. */
  step: FlowStep;
  /** Views already verified server-side. */
  done: ScanViewId[];
  /** The view currently being captured (omit outside the capture step). */
  current?: ScanViewId | null;
  /** Thumbnails of accepted views, keyed by view id. */
  thumbs?: Partial<Record<ScanViewId, string>>;
  /** Live on-device guidance — drives the quality readouts. */
  guidance?: Guidance | null;
  /** 0–1 hold-still progress. */
  stability?: number;
  onSwitchToUpload?: () => void;
}

const STEPS: { id: FlowStep; label: string; dot: string; tint: string }[] = [
  { id: 'capture', label: 'Capture', dot: 'bg-amber-500', tint: 'bg-amber-50 border-amber-100' },
  { id: 'analyze', label: 'Analyze', dot: 'bg-sky-500', tint: 'bg-sky-50 border-sky-100' },
  { id: 'report', label: 'Report', dot: 'bg-emerald-500', tint: 'bg-emerald-50 border-emerald-100' },
];

type Signal = 'good' | 'almost' | 'waiting';

const SIGNAL_TEXT: Record<Signal, string> = {
  good: 'Good',
  almost: 'Almost there',
  waiting: 'Waiting',
};

const SIGNAL_DOT: Record<Signal, string> = {
  good: 'bg-emerald-500',
  almost: 'bg-amber-500',
  waiting: 'bg-muted-foreground/40',
};

/** Derives the three plain-language readouts from the real guidance code. */
function readouts(guidance: Guidance | null | undefined, stability: number) {
  if (!guidance) {
    return { lighting: 'waiting' as Signal, position: 'waiting' as Signal, hold: 'waiting' as Signal };
  }
  const c = guidance.code;
  const lighting: Signal = c === 'lighting_low' || c === 'lighting_glare' ? 'almost' : 'good';
  const positionIssues: string[] = [
    'no_face',
    'multiple_faces',
    'move_closer',
    'move_back',
    'center',
    'face_forward',
    'turn_left',
    'turn_right',
    'turn_back',
  ];
  const position: Signal = positionIssues.includes(c) ? 'almost' : 'good';
  const hold: Signal = guidance.ok ? (stability > 0.15 ? 'good' : 'almost') : 'waiting';
  return { lighting, position, hold };
}

/**
 * The side rail of the public analysis flow: top-level steps, the three
 * standardised views with their live state, and the on-device quality
 * readouts. Presentation only — every value comes from real capture state.
 */
const PublicFlowPanel = ({
  step,
  done,
  current,
  thumbs,
  guidance,
  stability = 0,
  onSwitchToUpload,
}: Props) => {
  const r = readouts(guidance, stability);
  const rows = [
    { icon: Sun, label: 'Lighting', signal: r.lighting },
    { icon: Focus, label: 'Position', signal: r.position },
    { icon: Activity, label: 'Stability', signal: r.hold },
  ];

  return (
    <aside className="rounded-3xl border border-border bg-card p-4 sm:p-5" aria-label="Analysis progress">
      <ol className="space-y-2.5">
        {STEPS.map((s, i) => {
          const active = s.id === step;
          return (
            <li
              key={s.id}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors',
                active ? s.tint : 'border-transparent bg-muted/40',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  active ? 'bg-foreground text-background' : 'bg-background text-muted-foreground',
                )}
              >
                {i + 1}
              </span>
              <span className={cn('flex-1 text-sm font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>
                {s.label}
              </span>
              <span className={cn('h-2 w-2 rounded-full', active ? s.dot : 'bg-transparent')} aria-hidden />
            </li>
          );
        })}
      </ol>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {SCAN_VIEWS.map((v) => {
          const isDone = done.includes(v.id);
          const isActive = current === v.id;
          const thumb = thumbs?.[v.id];
          return (
            <figure key={v.id} className="space-y-1.5 text-center">
              <figcaption className="text-xs font-medium text-muted-foreground">{v.label}</figcaption>
              <div
                className={cn(
                  'relative aspect-[4/5] overflow-hidden rounded-2xl border bg-muted/40',
                  isActive ? 'border-amber-400 ring-2 ring-amber-200' : 'border-border',
                )}
              >
                {thumb ? (
                  <img src={thumb} alt={`${v.label} view captured`} className="h-full w-full object-cover" />
                ) : (
                  <svg viewBox="0 0 40 50" className="h-full w-full text-muted-foreground/40" aria-hidden>
                    <ellipse cx="20" cy="22" rx="10" ry="13" fill="none" stroke="currentColor" strokeWidth="1" />
                    <path d="M8 50 Q20 34 32 50" fill="none" stroke="currentColor" strokeWidth="1" />
                  </svg>
                )}
                {isDone && (
                  <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check className="h-3 w-3" aria-hidden />
                    <span className="sr-only">captured</span>
                  </span>
                )}
              </div>
            </figure>
          );
        })}
      </div>

      {step === 'capture' && (
        <dl className="mt-5 space-y-3 border-t border-border pt-5">
          {rows.map(({ icon: Icon, label, signal }) => (
            <div key={label} className="flex items-center gap-3">
              <Icon className="h-4 w-4 shrink-0 text-foreground" aria-hidden />
              <dt className="flex-1 text-sm text-foreground">{label}</dt>
              <dd className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className={cn('h-2 w-2 rounded-full', SIGNAL_DOT[signal])} aria-hidden />
                {SIGNAL_TEXT[signal]}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-5 space-y-2 border-t border-border pt-5">
        <p className="text-sm text-muted-foreground">
          Once all three views are captured, analysis and report generation begin automatically.
        </p>
        {onSwitchToUpload && (
          <button
            type="button"
            onClick={onSwitchToUpload}
            className="min-h-[44px] text-sm font-medium text-foreground underline underline-offset-4"
          >
            Upload photos instead
          </button>
        )}
        <p className="text-xs text-muted-foreground">
          Your photos are stored privately and deleted within 24 hours.
        </p>
      </div>
    </aside>
  );
};

export default PublicFlowPanel;
