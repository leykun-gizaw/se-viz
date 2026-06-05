/**
 * SE-Viz Phase 1 — the engine workbench. Assembles the chrome (top bar + breadcrumb, transport),
 * the three synchronized panels, the semantic legend, a light/dark toggle, presentation mode, and a
 * minimal switcher across the four validation fixtures. Keyboard transport is global.
 */
import { useCallback, useMemo, useState } from 'react';
import { FIXTURES } from './content/fixtures/index.ts';
import { useTrace } from './engine/trace/useTrace.ts';
import { useKeyboardControls } from './hooks/useKeyboardControls.ts';
import { useTheme } from './hooks/useTheme.ts';
import { Legend } from './components/Legend.tsx';
import { PresentationMode } from './components/PresentationMode.tsx';
import { Stage } from './components/Stage.tsx';
import { TopBar } from './components/TopBar.tsx';

/** The player + chrome for a single trace. Remounted (keyed) when the fixture changes. */
function Workbench({
  fixtureIndex,
  onSelectFixture,
}: {
  fixtureIndex: number;
  onSelectFixture: (i: number) => void;
}) {
  const { theme, toggle } = useTheme();
  const [presenting, setPresenting] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  const player = useTrace(FIXTURES[fixtureIndex].trace);

  const handlers = useMemo(
    () => ({
      onPrev: player.prev,
      onNext: player.next,
      onTogglePlay: player.togglePlay,
      onHome: () => player.goTo(0),
      onEnd: () => player.goTo(player.total - 1),
      onToggleFullscreen: () => setPresenting((p) => !p),
      onExit: () => setPresenting(false),
    }),
    [player],
  );
  useKeyboardControls(handlers);

  if (presenting) {
    return <PresentationMode player={player} onExit={() => setPresenting(false)} />;
  }

  return (
    <div className="flex h-full flex-col bg-bg text-ink">
      <TopBar
        player={player}
        theme={theme}
        onToggleTheme={toggle}
        onEnterPresentation={() => setPresenting(true)}
      />

      {/* Fixture switcher + legend toggle (engine validation surface, not a curriculum shell). */}
      <div className="flex items-center justify-between gap-4 border-b border-hairline bg-surface px-4 py-1.5">
        <div className="flex items-center gap-1">
          {FIXTURES.map((f, i) => (
            <button
              key={f.trace.id}
              type="button"
              onClick={() => onSelectFixture(i)}
              className={`rounded-md px-3 py-1 font-sans text-xs transition-colors ${
                i === fixtureIndex
                  ? 'bg-surface-3 font-semibold text-ink'
                  : 'text-ink-muted hover:bg-surface-2'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
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
          Keys: ←/→ step · Space play/pause · Home/End ends · f presentation · Esc exit
        </span>
      </footer>
    </div>
  );
}

export default function App() {
  const [fixtureIndex, setFixtureIndex] = useState(0);
  const onSelectFixture = useCallback((i: number) => setFixtureIndex(i), []);
  return (
    <Workbench
      key={FIXTURES[fixtureIndex].trace.id}
      fixtureIndex={fixtureIndex}
      onSelectFixture={onSelectFixture}
    />
  );
}
