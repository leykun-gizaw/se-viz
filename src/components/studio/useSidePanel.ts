/**
 * `useSidePanel` (Phase 28) — one collapsible, resizable Studio side panel (course map or step
 * explanation), persisted with {@link usePersistentState} under `se-viz-<spec.id>`.
 *
 * The persisted {@link SidePanelState} is the source of truth. `react-resizable-panels` owns the
 * pointer drag; when a drag settles the hook reads the panel's pixel size back. Keyboard resizing,
 * the collapse button and the rail's expand button go through the pure rules in `panelLayout.ts` and
 * are then applied to the library panel imperatively.
 */
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { usePanelRef, type PanelSize } from 'react-resizable-panels';
import { usePersistentState } from '../../hooks/usePersistentState.ts';
import {
  collapse,
  defaultState,
  expand,
  keyboardResize,
  sanitizeState,
  stateFromPixels,
  type SidePanelSpec,
  type SidePanelState,
} from './panelLayout.ts';

/** The localStorage key a panel's state is persisted under. */
export const storageKey = (spec: SidePanelSpec) => `se-viz-${spec.id}`;

export interface SidePanelControls {
  spec: SidePanelSpec;
  state: SidePanelState;
  panelRef: ReturnType<typeof usePanelRef>;
  /** Collapse to the rail. */
  collapse: () => void;
  /** Restore from the rail to the remembered width. */
  expand: () => void;
  /** Panel `onResize`: flips the collapsed flag live while dragging through the rail threshold. */
  onResize: (size: PanelSize) => void;
  /** Group `onLayoutChanged`: records the settled width after a drag. */
  onSettled: () => void;
  /** Separator `onKeyDownCapture`: our keyboard rules (pre-empting the library's 5% steps). */
  onSeparatorKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
}

export function useSidePanel(spec: SidePanelSpec): SidePanelControls {
  const [raw, setRaw] = usePersistentState<unknown>(storageKey(spec), defaultState(spec));
  const state = useMemo(() => sanitizeState(spec, raw), [spec, raw]);
  const panelRef = usePanelRef();
  // Latest state for callbacks fired by the library outside React's render cycle.
  const latest = useRef(state);
  useLayoutEffect(() => {
    latest.current = state;
  }, [state]);

  // True while `apply` drives the library panel imperatively.
  const applying = useRef(false);

  const commit = useCallback(
    (next: SidePanelState) => {
      const cur = latest.current;
      if (cur.width === next.width && cur.collapsed === next.collapsed) return;
      latest.current = next;
      setRaw(next);
    },
    [setRaw],
  );

  /** Persist `next` and move the library panel to match it. */
  const apply = useCallback(
    (next: SidePanelState) => {
      commit(next);
      const panel = panelRef.current;
      if (!panel) return;
      // The library reports the layout change synchronously, before the panel has its new size;
      // `onSettled` must not read that stale size back over the state we just committed.
      applying.current = true;
      try {
        if (next.collapsed) panel.collapse();
        else panel.resize(`${next.width}px`);
      } finally {
        applying.current = false;
      }
    },
    [commit, panelRef],
  );

  const doCollapse = useCallback(() => apply(collapse(latest.current)), [apply]);
  const doExpand = useCallback(() => apply(expand(spec, latest.current)), [apply, spec]);

  const onResize = useCallback(
    (size: PanelSize) => {
      const collapsed = size.inPixels <= spec.railWidth + 1;
      if (collapsed !== latest.current.collapsed) {
        commit(collapsed ? collapse(latest.current) : { ...latest.current, collapsed: false });
      }
    },
    [commit, spec.railWidth],
  );

  const onSettled = useCallback(() => {
    const panel = panelRef.current;
    if (!panel || applying.current) return;
    commit(stateFromPixels(spec, latest.current, panel.getSize().inPixels));
  }, [commit, panelRef, spec]);

  const onSeparatorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const next = keyboardResize(spec, latest.current, e.key, e.shiftKey);
      if (!next) return;
      // Capture phase: runs before the library's own keydown listener, which skips handled events.
      e.preventDefault();
      apply(next);
    },
    [apply, spec],
  );

  return {
    spec,
    state,
    panelRef,
    collapse: doCollapse,
    expand: doExpand,
    onResize,
    onSettled,
    onSeparatorKeyDown,
  };
}
