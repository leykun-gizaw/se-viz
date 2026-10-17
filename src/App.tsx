/**
 * SE-Viz workbench (Phase 2), in the Studio layout (Phase 28): one resizable panel group of
 * **course map | stage | step explanation**. The course map lists modules from the catalog; the stage
 * is the player for the selected module — top bar + breadcrumb, the synchronized panels, the
 * narration card, the timeline, a legend toggle, light/dark toggle, presentation mode, and global
 * keyboard transport. The explanation panel follows the player's current beat.
 */
import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { allCatalogModules, CATALOG, firstModuleOfTopic } from './content/catalog.ts';
import { THEORY_BY_ID } from './content/theory.ts';
import type { Trace } from './engine/trace/types.ts';
import { useTrace } from './engine/trace/useTrace.ts';
import { useKeyboardControls } from './hooks/useKeyboardControls.ts';
import { useTheme, type Theme } from './hooks/useTheme.ts';
import { LIVE_CODING_ID, tracerConfig } from './live/config.ts';
import { LIVE_PYTHON_ID } from './python/live/config.ts';
import { ContentSidebar } from './components/ContentSidebar.tsx';
import { Legend } from './components/Legend.tsx';
import { PresentationMode } from './components/PresentationMode.tsx';
import { Stage } from './components/Stage.tsx';
import { TheoryDeck } from './components/TheoryDeck.tsx';
import { TopBar } from './components/TopBar.tsx';
import { ExplanationPanel } from './components/studio/ExplanationPanel.tsx';
import { COURSE_MAP, EXPLANATION } from './components/studio/panelLayout.ts';
import { StudioLayout } from './components/studio/StudioLayout.tsx';
import { useCourseMapNav } from './components/studio/useCourseMapNav.ts';
import { useSidePanel } from './components/studio/useSidePanel.ts';

/**
 * Lazy: Live Coding (and its CodeMirror dependency) loads only when the mode is opened, so the
 * production bundle — where the mode doesn't even exist (no `VITE_TRACER_URL`) — never pays for it.
 */
const LiveCodingView = lazy(() =>
  import('./components/live/LiveCodingView.tsx').then((m) => ({ default: m.LiveCodingView })),
);

/**
 * Lazy: Python live coding (Phase 31) — its editor (CodeMirror Python), the runner and, through the
 * runner's worker, Pyodide load only when the mode is opened. It runs in the browser, so it ships.
 */
const PythonLiveView = lazy(() =>
  import('./components/live/PythonLiveView.tsx').then((m) => ({ default: m.PythonLiveView })),
);

/** The stage's fallback while a lazy live-coding view loads. */
function LoadingEditor() {
  return (
    <div className="flex flex-1 items-center justify-center font-sans text-sm text-ink-muted">
      Loading the live editor…
    </div>
  );
}

/** The player + chrome for one module. Remounted (keyed on trace id) when the selection changes. */
function Workbench({
  trace,
  theme,
  onToggleTheme,
  explanationSlot,
  onCollapseExplanation,
  explanationWidth,
}: {
  trace: Trace;
  theme: Theme;
  onToggleTheme: () => void;
  /** Where the Studio layout wants the explanation panel (null while it is collapsed). */
  explanationSlot: HTMLElement | null;
  onCollapseExplanation: () => void;
  /** The explanation panel's width, reused when presentation mode shows it. */
  explanationWidth: number;
}) {
  const [presenting, setPresenting] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const player = useTrace(trace);

  const handlers = useMemo(
    () => ({
      onPrev: player.prev,
      onNext: player.next,
      onTogglePlay: player.togglePlay,
      onHome: () => player.goTo(0),
      onEnd: () => player.goTo(player.total - 1),
      onToggleStepMode: player.toggleMode,
      onToggleFullscreen: () => setPresenting((p) => !p),
      onExit: () => setPresenting(false),
    }),
    [player],
  );
  useKeyboardControls(handlers);

  if (presenting) {
    return (
      <PresentationMode
        player={player}
        onExit={() => setPresenting(false)}
        explanationWidth={explanationWidth}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar
        player={player}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onEnterPresentation={() => setPresenting(true)}
      />

      <div className="flex items-center justify-end border-b border-hairline bg-surface px-4 py-1.5">
        <button
          type="button"
          onClick={() => setShowLegend((s) => !s)}
          className="rounded-md border border-hairline bg-surface-2 px-3 py-1 font-sans text-xs text-ink-muted hover:bg-surface-3"
        >
          {showLegend ? 'Hide legend' : 'Legend'}
        </button>
      </div>

      {showLegend ? (
        <div className="border-b border-hairline bg-surface px-5 py-4">
          <Legend />
        </div>
      ) : null}

      <Stage player={player} />

      <footer className="border-t border-hairline bg-surface px-4 py-1.5">
        <span className="font-mono text-[10px] text-ink-faint">
          Keys: ←/→ step · Space play/pause · Home/End ends · b reveal mode · f presentation · Esc
          exit
        </span>
      </footer>

      {explanationSlot
        ? createPortal(
            <ExplanationPanel player={player} onCollapse={onCollapseExplanation} />,
            explanationSlot,
          )
        : null}
    </div>
  );
}

export default function App() {
  const modules = useMemo(() => allCatalogModules(), []);
  const [selectedId, setSelectedId] = useState(modules[0].trace.id);
  const onSelect = useCallback((id: string) => setSelectedId(id), []);
  const { theme, toggle } = useTheme();
  const courseMap = useSidePanel(COURSE_MAP);
  const courseMapNav = useCourseMapNav(CATALOG, selectedId);
  const explanation = useSidePanel(EXPLANATION);
  const [explanationSlot, setExplanationSlot] = useState<HTMLDivElement | null>(null);

  // Live Coding (Phase 23) exists only when a tracer backend is configured — production today has
  // none, so the entry (and the whole mode) is hidden there rather than shipping a dead feature.
  const liveCodingEnabled = useMemo(() => tracerConfig() !== null, []);
  const liveCoding = liveCodingEnabled && selectedId === LIVE_CODING_ID;
  // Python live coding (Phase 31) needs no backend, so it is always available.
  const livePython = selectedId === LIVE_PYTHON_ID;

  // A selection is a live-coding mode, a theory doc (synthetic id), or a module (trace id).
  const theoryDoc = liveCoding || livePython ? null : (THEORY_BY_ID.get(selectedId) ?? null);
  const selectedModule = modules.find((m) => m.trace.id === selectedId) ?? modules[0];

  const firstModule = theoryDoc ? firstModuleOfTopic(theoryDoc.course, theoryDoc.topic) : null;

  // Only the player has a step to explain; theory decks and C live coding get a two-panel layout.
  // Python live coding plays its runs in the player, so it keeps the explanation panel.
  const hasPlayer = !liveCoding && !theoryDoc;
  const explanationTarget = hasPlayer && !explanation.state.collapsed ? explanationSlot : null;

  return (
    <div className="flex h-full bg-bg text-ink">
      <StudioLayout
        courseMap={courseMap}
        explanation={hasPlayer ? explanation : null}
        onExplanationSlot={setExplanationSlot}
        sidebar={
          <ContentSidebar
            courses={CATALOG}
            selectedId={
              liveCoding
                ? LIVE_CODING_ID
                : livePython
                  ? LIVE_PYTHON_ID
                  : theoryDoc
                    ? theoryDoc.id
                    : selectedModule.trace.id
            }
            onSelect={onSelect}
            collapsed={courseMap.state.collapsed}
            onCollapse={courseMap.collapse}
            onExpand={courseMap.expand}
            liveCodingEnabled={liveCodingEnabled}
            nav={courseMapNav}
          />
        }
      >
        {liveCoding ? (
          <Suspense fallback={<LoadingEditor />}>
            <LiveCodingView theme={theme} onToggleTheme={toggle} />
          </Suspense>
        ) : livePython ? (
          <Suspense fallback={<LoadingEditor />}>
            <PythonLiveView
              theme={theme}
              onToggleTheme={toggle}
              explanationSlot={explanationTarget}
              onCollapseExplanation={explanation.collapse}
              explanationWidth={explanation.state.width}
            />
          </Suspense>
        ) : theoryDoc ? (
          <TheoryDeck
            key={theoryDoc.id}
            doc={theoryDoc}
            firstModule={
              firstModule ? { id: firstModule.trace.id, label: firstModule.label } : null
            }
            theme={theme}
            onToggleTheme={toggle}
            onSelect={onSelect}
          />
        ) : (
          <Workbench
            key={selectedModule.trace.id}
            trace={selectedModule.trace}
            theme={theme}
            onToggleTheme={toggle}
            explanationSlot={explanationTarget}
            onCollapseExplanation={explanation.collapse}
            explanationWidth={explanation.state.width}
          />
        )}
      </StudioLayout>
    </div>
  );
}
