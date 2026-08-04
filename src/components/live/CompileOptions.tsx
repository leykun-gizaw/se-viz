/**
 * The compile-options picker (Phase 25) — the control next to **Run** where a student chooses the
 * `gcc` flags their program is built with.
 *
 * Deliberately thin: every rule about which combinations are legal lives in
 * `src/live/compileOptions.ts` (pure, unit-tested in the node environment this repo's tests use).
 * This file is layout, popover mechanics, and accessibility only.
 *
 * The dialect is a radio group rather than two checkboxes because the backend rejects two `-std=`
 * values — the illegal state is made unrepresentable instead of surfacing a 400.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DIALECT_CHOICES,
  TOGGLE_CHOICES,
  dialectOf,
  hasFlag,
  setDialect,
  setToggle,
  toggleCount,
  type CompileFlag,
  type DialectFlag,
  type ToggleFlag,
} from '../../live/compileOptions.ts';

export interface CompileOptionsProps {
  flags: readonly CompileFlag[];
  onChange: (flags: CompileFlag[]) => void;
  /** Disabled while a run is in flight, like the Run button. */
  disabled?: boolean;
}

export function CompileOptions({ flags, onChange, disabled = false }: CompileOptionsProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const dialectName = useId();
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  /**
   * The popover is **portalled to `document.body` and positioned `fixed`**, not absolutely
   * positioned inside the toolbar. The editor lives in a resizable panel that clips its overflow,
   * which cut the dialect radio group clean off the bottom; a portal escapes every such ancestor,
   * and `fixed` keeps it pinned to the trigger. This is also what makes it layer correctly in
   * presentation mode instead of being trapped behind (or inside) the presenting surface.
   */
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setAnchor({ top: r.bottom + 6, right: window.innerWidth - r.right });
    };
    place();
    window.addEventListener('resize', place);
    // Any scroll in any ancestor moves the trigger; re-anchor rather than drift away from it.
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  // Esc closes and returns focus to the trigger; a click anywhere outside closes without stealing
  // focus. Both are bound only while open, so the popover costs nothing when it isn't showing.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Deliberately NOT stopPropagation: outside presentation mode the global handler's "exit
      // presentation" is a no-op, and inside it a single Esc should both dismiss this and leave
      // the presentation rather than being swallowed here.
      close(true);
    };
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      // The panel is portalled, so "outside" means outside BOTH the trigger and the panel.
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      close(false);
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [open, close]);

  const count = toggleCount(flags);
  const dialect = dialectOf(flags);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={panelId}
        title="Choose the gcc flags your program is compiled with"
        className="flex items-center gap-1.5 rounded-md border border-hairline bg-surface-2 px-2.5 py-1 font-sans text-xs text-ink-muted transition-colors hover:bg-surface-3 focus:outline-none focus-visible:ring-1 focus-visible:ring-pointer disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span aria-hidden="true">⚙</span>
        Options
        <span className="font-mono text-ink-faint">· {count}</span>
      </button>

      {open && anchor
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="group"
              aria-label="Compile options"
              style={{ top: anchor.top, right: anchor.right }}
              // z-40 is deliberate: above the memory-view layers (cells z-10, arrows z-20,
              // tooltip z-30) but BELOW the presentation overlay (z-50). Pressing `f` with the
              // trigger focused enters presentation with the popover still open — at a higher
              // z-index it would float over the presentation. Here the overlay simply covers it.
              className="fixed z-40 max-h-[70vh] w-80 overflow-y-auto rounded-lg border border-hairline bg-surface p-3 shadow-lg"
            >
              <fieldset className="flex flex-col gap-2.5 border-0 p-0">
                <legend className="mb-1 font-sans text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                  Warnings
                </legend>
                {TOGGLE_CHOICES.map((choice) => (
                  <Row
                    key={choice.flag}
                    type="checkbox"
                    name={choice.flag}
                    checked={hasFlag(flags, choice.flag)}
                    onSelect={(on) => onChange(setToggle(flags, choice.flag as ToggleFlag, on))}
                    flag={choice.flag}
                    label={choice.label}
                    gloss={choice.gloss}
                  />
                ))}
              </fieldset>

              <p className="mt-2.5 border-t border-hairline pt-2.5 font-sans text-[11px] leading-snug text-ink-muted">
                <code className="se-code text-ink">-Werror</code> turns any warning into a compile
                error — you&rsquo;ll see the compiler output instead of the animation.
              </p>

              <fieldset className="mt-3 flex flex-col gap-2.5 border-0 border-t border-hairline p-0 pt-2.5">
                <legend className="mb-1 font-sans text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                  Language standard
                </legend>
                {DIALECT_CHOICES.map((choice) => (
                  <Row
                    key={choice.flag}
                    type="radio"
                    name={dialectName}
                    checked={dialect === choice.flag}
                    onSelect={() => onChange(setDialect(flags, choice.flag as DialectFlag))}
                    flag={choice.flag}
                    label={choice.label}
                    gloss={choice.gloss}
                  />
                ))}
              </fieldset>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

interface RowProps {
  type: 'checkbox' | 'radio';
  name: string;
  checked: boolean;
  onSelect: (checked: boolean) => void;
  flag: string;
  label: string;
  gloss: string;
}

/** One option: a real input (not a styled div), its flag, and the plain-language gloss. */
function Row({ type, name, checked, onSelect, flag, label, gloss }: RowProps) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={(e) => onSelect(e.target.checked)}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-pointer"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-baseline gap-1.5">
          <code className="se-code text-xs text-ink">{flag}</code>
          <span className="font-sans text-xs text-ink-muted">{label}</span>
        </span>
        <span className="font-sans text-[11px] leading-snug text-ink-faint">{gloss}</span>
      </span>
    </label>
  );
}
