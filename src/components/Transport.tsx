/**
 * Transport controls: reset · step-back · play/pause · step-forward, plus a scrub bar, a speed
 * selector, and the `Step k / N` readout. Mirrors the design's top-bar control cluster. Keyboard
 * shortcuts (←/→/Space/Home/End) are wired globally in App via `useKeyboardControls`.
 */
import type { TracePlayer } from '../engine/trace/useTrace.ts';

function IconButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-md border text-ink transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        active
          ? 'border-pointer bg-pointer text-white'
          : 'border-hairline bg-surface-2 hover:bg-surface-3'
      }`}
    >
      {children}
    </button>
  );
}

export interface TransportProps {
  player: TracePlayer;
  /** Hide the scrub + speed (compact mode, e.g. presentation). */
  compact?: boolean;
}

export function Transport({ player, compact = false }: TransportProps) {
  const { index, total, canPrev, canNext, isPlaying, beatLabel, supportsBeats, mode } = player;

  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-xs text-ink-muted">
        Step <span className="font-semibold text-ink">{index + 1}</span> / {total}
        {beatLabel ? <span className="text-ink-faint"> · {beatLabel}</span> : null}
      </span>

      {!compact ? (
        <input
          type="range"
          min={0}
          max={total - 1}
          value={index}
          aria-label="Scrub steps"
          onChange={(e) => player.goTo(Number(e.target.value))}
          className="h-1 w-40 cursor-pointer appearance-none rounded-full bg-surface-3 accent-pointer"
        />
      ) : null}

      <div className="flex items-center gap-1.5">
        <IconButton label="Reset" onClick={player.reset} disabled={index === 0 && !isPlaying}>
          {/* reset / rewind-to-start */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 5v14M18 6l-9 6 9 6V6z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </IconButton>
        <IconButton label="Step back" onClick={player.prev} disabled={!canPrev}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 5l-7 7 7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </IconButton>
        <IconButton
          label={isPlaying ? 'Pause' : 'Play'}
          onClick={player.togglePlay}
          active={isPlaying}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M7 5l12 7-12 7V5z" />
            </svg>
          )}
        </IconButton>
        <IconButton label="Step forward" onClick={player.next} disabled={!canNext}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M9 5l7 7-7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </IconButton>
      </div>

      {!compact ? (
        <button
          type="button"
          onClick={() => player.setSpeedIndex((player.speedIndex + 1) % player.speeds.length)}
          className="rounded-md border border-hairline bg-surface-2 px-2 py-1 font-mono text-xs text-ink-muted hover:bg-surface-3"
          title="Playback speed"
        >
          {player.speed.label}
        </button>
      ) : null}

      {!compact && supportsBeats ? (
        <button
          type="button"
          onClick={player.toggleMode}
          aria-pressed={mode === 'two-beat'}
          title={`Execute-to-reveal stepping: ${mode === 'two-beat' ? 'on' : 'off'} — split each step into "about to run" then "ran" (b)`}
          className={`rounded-md border px-2 py-1 font-sans text-xs transition-colors ${
            mode === 'two-beat'
              ? 'border-pointer bg-pointer-soft text-pointer'
              : 'border-hairline bg-surface-2 text-ink-muted hover:bg-surface-3'
          }`}
        >
          Reveal {mode === 'two-beat' ? 'on' : 'off'}
        </button>
      ) : null}
    </div>
  );
}
