/**
 * Global keyboard transport. Bindings (documented in the report and the on-screen hint):
 *   ←/→        step back / forward (one beat in two-beat mode)
 *   Space      play / pause
 *   Home/End   jump to first / last step
 *   b          toggle execute-to-reveal (two-beat) vs single-beat stepping
 *   f          toggle presentation (fullscreen) mode
 *   Esc        exit presentation mode
 *
 * Key events are ignored while typing in a form field.
 */
import { useEffect } from 'react';

export interface KeyboardControlHandlers {
  onPrev: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onHome: () => void;
  onEnd: () => void;
  onToggleStepMode?: () => void;
  onToggleFullscreen?: () => void;
  onExit?: () => void;
}

export function useKeyboardControls(handlers: KeyboardControlHandlers): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Ignore while typing in a form field, or when the resizable-panel divider is focused — it
      // owns ←/→ to resize, so we must not also step the trace.
      if (
        target &&
        (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.closest('[data-separator]'))
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handlers.onPrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handlers.onNext();
          break;
        case ' ':
        case 'Spacebar':
          e.preventDefault();
          handlers.onTogglePlay();
          break;
        case 'Home':
          e.preventDefault();
          handlers.onHome();
          break;
        case 'End':
          e.preventDefault();
          handlers.onEnd();
          break;
        case 'b':
        case 'B':
          handlers.onToggleStepMode?.();
          break;
        case 'f':
        case 'F':
          handlers.onToggleFullscreen?.();
          break;
        case 'Escape':
          handlers.onExit?.();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlers]);
}
