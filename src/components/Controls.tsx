/**
 * Minimal presentation controls for Phase 0: step back, step forward, reset, and a step counter.
 * Autoplay / scrub / speed are deliberately out of scope until Phase 1.
 */
export interface ControlsProps {
  index: number;
  total: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
}

export function Controls({
  index,
  total,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onReset,
}: ControlsProps) {
  const buttonBase =
    'rounded-md px-4 py-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onPrev}
        disabled={!canPrev}
        className={`${buttonBase} bg-slate-700 text-slate-100 hover:bg-slate-600`}
      >
        ← Step back
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        className={`${buttonBase} bg-sky-600 text-white hover:bg-sky-500`}
      >
        Step forward →
      </button>
      <button
        type="button"
        onClick={onReset}
        className={`${buttonBase} bg-slate-800 text-slate-300 hover:bg-slate-700`}
      >
        Reset
      </button>
      <span className="ml-2 font-mono text-sm text-slate-400">
        Step {index + 1} / {total}
      </span>
    </div>
  );
}
