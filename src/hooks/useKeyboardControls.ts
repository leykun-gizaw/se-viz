/**
 * Global keyboard transport. Bindings (documented in the report and the on-screen hint):
 *   ←/→        step back / forward
 *   Space      play / pause
 *   Home/End   jump to first / last step
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
  onToggleFullscreen?: () => void;
  onExit?: () => void;
}

export function useKeyboardControls(handlers: KeyboardControlHandlers): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

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
