/**
 * Presentation / fullscreen mode — the PowerPoint-replacement surface. Hides the editing chrome
 * (fixture tabs, legend, theme), enlarges type, and keeps the three panels + a compact transport.
 * Keyboard-driven: ←/→ step, Space play/pause, Esc exit (wired globally in App).
 */
import type { TracePlayer } from '../engine/trace/useTrace.ts';
import { Stage } from './Stage.tsx';
import { Transport } from './Transport.tsx';

export function PresentationMode({ player, onExit }: { player: TracePlayer; onExit: () => void }) {
  const { trace } = player;
  const segments = [trace.course, trace.topic, trace.file].filter(Boolean) as string[];

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
            onClick={onExit}
            className="rounded-md border border-hairline bg-surface-2 px-3 py-1.5 font-sans text-xs text-ink hover:bg-surface-3"
            title="Exit presentation (Esc)"
          >
            Exit
          </button>
        </div>
      </header>
      <Stage player={player} presenting />
    </div>
  );
}
