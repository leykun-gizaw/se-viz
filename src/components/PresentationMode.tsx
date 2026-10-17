/**
 * Presentation / fullscreen mode — the PowerPoint-replacement surface. Hides the editing chrome
 * (fixture tabs, legend, theme), enlarges type, and keeps the three panels + a compact transport.
 * Keyboard-driven: ←/→ step, Space play/pause, Esc exit (wired globally in App).
 *
 * Phase 28: the presenter may also show the step explanation panel on the right. It is hidden by
 * default and the choice persists (`se-viz-present-explanation`), so it stays open next time only if
 * the presenter left it open. Everything else is unchanged.
 */
import type { TracePlayer } from '../engine/trace/useTrace.ts';
import { usePersistentState } from '../hooks/usePersistentState.ts';
import { Stage } from './Stage.tsx';
import { ExplanationPanel } from './studio/ExplanationPanel.tsx';
import { EXPLANATION } from './studio/panelLayout.ts';
import { Transport } from './Transport.tsx';

export function PresentationMode({
  player,
  onExit,
  explanationWidth = EXPLANATION.defaultWidth,
}: {
  player: TracePlayer;
  onExit: () => void;
  /** Width of the explanation panel when shown (the Studio panel's remembered width). */
  explanationWidth?: number;
}) {
  const { trace } = player;
  const segments = [trace.course, trace.topic, trace.file].filter(Boolean) as string[];
  const [showExplanation, setShowExplanation] = usePersistentState(
    'se-viz-present-explanation',
    false,
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <header className="flex items-center justify-between gap-4 border-b border-hairline bg-surface px-6 py-3">
        <nav
          aria-label="Lesson"
          className="flex items-center gap-2 font-sans text-sm text-ink-muted"
        >
          {segments.map((seg, i) => (
            <span key={seg} className="flex items-center gap-2">
              {i > 0 ? <span className="text-ink-faint">›</span> : null}
              <span className={i === segments.length - 1 ? 'font-semibold text-ink' : ''}>
                {seg}
              </span>
            </span>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <Transport player={player} compact />
          <button
            type="button"
            onClick={() => setShowExplanation((s) => !s)}
            aria-pressed={showExplanation}
            title={showExplanation ? 'Hide the step explanation' : 'Show the step explanation'}
            className={`rounded-md border px-3 py-1.5 font-sans text-xs transition-colors ${
              showExplanation
                ? 'border-pointer bg-pointer-soft text-pointer'
                : 'border-hairline bg-surface-2 text-ink hover:bg-surface-3'
            }`}
          >
            Explanation
          </button>
          <button
            type="button"
            onClick={onExit}
            className="rounded-md border border-hairline bg-surface-2 px-3 py-1.5 font-sans text-xs text-ink hover:bg-surface-3"
            title="Exit presentation (Esc)"
          >
            Exit
          </button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Stage player={player} presenting />
        </div>
        {showExplanation ? (
          <div style={{ width: explanationWidth, zoom: 1.15 }} className="min-h-0 shrink-0 border-l border-hairline">
            <ExplanationPanel player={player} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
