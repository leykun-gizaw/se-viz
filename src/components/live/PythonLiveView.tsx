/**
 * Python live coding (Phase 31): type Python, press **Run**, and step through it in the normal
 * player with the step explanation panel. Everything runs in the browser: Pyodide in a Web Worker
 * (`src/python/worker.ts`), recorded by `recorder.py`, mapped with the Phase 30 contract
 * (`recordingToTrace`). No backend, so unlike C live coding this mode always ships.
 *
 * Layout mirrors C live coding (`LiveCodingView`), which it does not change: a slim header, the
 * editor card (CodeMirror Python, the limits, Reset, Run / Stop, and a stdin box for `input()`), a
 * draggable split, then the outcome: a status card while Python or packages load and while the
 * program runs, an error panel for a syntax error (the editor marks the line), or the player.
 *
 * The run state machine is pure (`src/python/live/runState.ts`); so is the mapping from a worker
 * result to what is shown (`src/python/live/outcome.ts`).
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';
import type { Trace } from '../../engine/trace/types.ts';
import { useTrace } from '../../engine/trace/useTrace.ts';
import { useKeyboardControls } from '../../hooks/useKeyboardControls.ts';
import { usePersistentState } from '../../hooks/usePersistentState.ts';
import type { Theme } from '../../hooks/useTheme.ts';
import { DEFAULT_PYTHON_PROGRAM } from '../../python/live/defaultProgram.ts';
import {
  clampLimit,
  DEFAULT_LIVE_LIMITS,
  LIMIT_RANGES,
  parseStoredLimits,
  toRunLimits,
  type LiveLimits,
} from '../../python/live/limits.ts';
import {
  exceptionHeadline,
  LIVE_PYTHON_FILE,
  mapOutcome,
  stoppedHeadline,
  type LiveEnding,
  type LiveRunError,
} from '../../python/live/outcome.ts';
import { PY_LIMITS_KEY, PY_SOURCE_KEY, PY_STDIN_KEY, stdinLines } from '../../python/live/input.ts';
import { detectPackages, packageList } from '../../python/live/packages.ts';
import { liveRunner } from '../../python/live/runner.ts';
import {
  canRun,
  canStop,
  initialPyRunState,
  pyRunReducer,
  type PyRunStatus,
} from '../../python/live/runState.ts';
import { PYODIDE_VERSION } from '../../python/version.ts';
import { PresentationMode } from '../PresentationMode.tsx';
import { Stage } from '../Stage.tsx';
import { ExplanationPanel } from '../studio/ExplanationPanel.tsx';
import { RailButton } from '../studio/StudioLayout.tsx';
import { Mark, ThemeToggle } from '../TopBar.tsx';
import { Transport } from '../Transport.tsx';
import { CodeEditor } from './CodeEditor.tsx';
import { PYTHON_EXTRAS, PYTHON_LANGUAGE } from './pythonLanguage.ts';

/** How long typing pauses before the editor text is saved. */
const SAVE_DELAY_MS = 400;

/** Seconds since this mounted, ticking: the loading / running status shows it. */
function Elapsed() {
  const [start] = useState(() => performance.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    const t = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono tabular-nums text-ink-faint">
      {((now - start) / 1000).toFixed(1)} s
    </span>
  );
}

/** A status card for the loading and running phases: what is happening, and an elapsed timer. */
function StatusCard({ status }: { status: PyRunStatus }) {
  let title = '';
  let note = '';
  if (status.phase === 'loading-runtime') {
    title = `Loading Python (Pyodide ${PYODIDE_VERSION})…`;
    note = 'The first load downloads the runtime; later loads come from the browser cache.';
  } else if (status.phase === 'loading-packages') {
    title = `Loading ${packageList(status.packages)}…`;
    note = 'Each package loads once; later runs reuse it.';
  } else if (status.phase === 'running') {
    title = 'Running…';
    note =
      status.snapshots > 0
        ? `${status.snapshots.toLocaleString('en-US')} ${status.snapshots === 1 ? 'step' : 'steps'} recorded so far. Stop ends the run and keeps them.`
        : 'Stop ends the run and keeps the steps recorded so far.';
  }
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div
        role="status"
        aria-live="polite"
        className="flex w-full max-w-md flex-col gap-2.5 rounded-lg border border-hairline bg-surface px-5 py-4"
      >
        <div className="flex items-baseline justify-between gap-3 font-sans text-sm">
          <span className="font-semibold text-ink">{title}</span>
          <Elapsed key={status.phase} />
        </div>
        <div
          className="se-progress h-1 overflow-hidden rounded-full bg-surface-3"
          aria-hidden="true"
        >
          <div className="se-progress-bar h-full w-1/3 rounded-full bg-pointer" />
        </div>
        <p className="font-sans text-xs text-ink-muted">{note}</p>
      </div>
    </div>
  );
}

/** A run that produced no trace: a syntax error, a load failure, a kill before any step. */
function ErrorPanel({ error }: { error: LiveRunError }) {
  const syntax =
    /Error$/.test(error.type) && error.line !== undefined && error.detail?.includes('^');
  const load = error.type === 'LoadError' || error.type === 'InternalError';
  return (
    <div className="flex max-h-72 flex-col overflow-hidden rounded-lg border border-danger/40 bg-surface">
      <div className="border-b border-hairline px-4 py-1.5">
        <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-danger">
          {syntax ? 'Syntax error' : load ? 'Python could not run' : 'Run failed'}
        </span>
      </div>
      <div className="flex min-h-0 flex-col gap-1.5 overflow-auto px-4 py-2.5">
        <span className="font-sans text-sm text-ink">
          <code className="se-code text-danger">{error.type}</code>
          {error.message ? <>: {error.message}</> : null}
        </span>
        {error.line !== undefined ? (
          <span className="font-sans text-xs text-ink-muted">
            Line {error.line}
            {error.column !== undefined ? `, column ${error.column}` : ''}
            {syntax ? ' (marked in the editor). Nothing ran: fix it and press Run.' : ''}
          </span>
        ) : null}
        {load ? (
          <span className="font-sans text-xs text-ink-muted">
            Python loads from the Pyodide CDN. Check the connection, then press Run to try again.
          </span>
        ) : null}
        {error.detail ? (
          <pre className="se-code whitespace-pre-wrap text-xs leading-5 text-danger">
            {error.detail}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

/** The banner above the player when the trace ends early: an exception, or a limit / Stop. */
function EndingBanner({ ending, limits }: { ending: LiveEnding; limits: LiveLimits }) {
  if (ending.kind === 'exception') {
    return (
      <div className="border-b border-hairline bg-danger-soft px-4 py-2 font-sans text-xs text-ink">
        <span className="font-semibold text-danger">Uncaught exception · </span>
        {exceptionHeadline(ending)}. The last step shows where the program stopped.
      </div>
    );
  }
  return (
    <div className="border-b border-hairline bg-active-soft px-4 py-2 font-sans text-xs text-ink">
      ⚠ {stoppedHeadline(ending, limits)} The last step marks where it stopped.
    </div>
  );
}

/** The explanation column before there is anything to explain. */
function ExplanationPlaceholder({ onCollapse }: { onCollapse: () => void }) {
  return (
    <aside aria-label="Step explanation" className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-2.5">
        <h2 className="font-sans text-sm font-semibold text-ink">Step explanation</h2>
        <RailButton
          label="Collapse the step explanation"
          direction="right"
          expanded={true}
          onClick={onCollapse}
        />
      </div>
      <p className="px-4 py-3 font-sans text-[13px] leading-relaxed text-ink-muted">
        Run a program to step through it. Each step is explained here.
      </p>
    </aside>
  );
}

/** One editable limit: a compact number field, clamped to its range when it loses focus. */
function LimitField({
  label,
  unit,
  limitKey,
  value,
  onCommit,
}: {
  label: string;
  unit?: string;
  limitKey: keyof LiveLimits;
  value: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);
  // Follow outside changes (another tab, a reset) without an effect.
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(String(value));
  }
  const { min, max } = LIMIT_RANGES[limitKey];
  const commit = () => {
    const next = clampLimit(limitKey, draft);
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };
  return (
    <label
      className="flex items-center gap-1 font-sans text-[11px] text-ink-muted"
      title={`${label}: ${min}–${max}${unit ? ` ${unit}` : ''}`}
    >
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
        aria-label={`${label} limit`}
        className="w-14 rounded-md border border-hairline bg-surface-2 px-1.5 py-0.5 text-right font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-pointer [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {unit ? <span className="text-ink-faint">{unit}</span> : null}
    </label>
  );
}

/**
 * The player bound to one run's trace, remounted per run (keyed on the run seq) so each run starts
 * at step 0. It portals the step explanation panel into the Studio's right-hand slot.
 */
function PythonPlayer({
  trace,
  explanationSlot,
  onCollapseExplanation,
  explanationWidth,
}: {
  trace: Trace;
  explanationSlot: HTMLElement | null;
  onCollapseExplanation: () => void;
  explanationWidth: number;
}) {
  const decorated = useMemo(() => ({ ...trace, course: 'Live coding · Python' }), [trace]);
  const player = useTrace(decorated);
  const [presenting, setPresenting] = useState(false);

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
      <div className="flex items-center justify-between gap-4 border-b border-hairline bg-surface px-4 py-1.5">
        <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
          Execution
        </span>
        <Transport player={player} showScrub={false} />
      </div>
      <Stage player={player} />
      {explanationSlot
        ? createPortal(
            <ExplanationPanel player={player} onCollapse={onCollapseExplanation} />,
            explanationSlot,
          )
        : null}
    </div>
  );
}

export interface PythonLiveViewProps {
  theme: Theme;
  onToggleTheme: () => void;
  /** Where the Studio layout wants the explanation panel (null while it is collapsed). */
  explanationSlot: HTMLElement | null;
  onCollapseExplanation: () => void;
  explanationWidth: number;
}

let runCounter = 0;

export function PythonLiveView({
  theme,
  onToggleTheme,
  explanationSlot,
  onCollapseExplanation,
  explanationWidth,
}: PythonLiveViewProps) {
  const runner = liveRunner();
  const [state, dispatch] = useReducer(pyRunReducer, runner.ready, initialPyRunState);
  const { status } = state;

  // Persisted: the program, the stdin box and the limits. Stored values are `unknown` (another
  // build or a hand edit may have written them) and re-validated on every read.
  const [storedSource, setStoredSource] = usePersistentState<unknown>(
    PY_SOURCE_KEY,
    DEFAULT_PYTHON_PROGRAM,
  );
  const initialSource = typeof storedSource === 'string' ? storedSource : DEFAULT_PYTHON_PROGRAM;
  const [storedStdin, setStoredStdin] = usePersistentState<unknown>(PY_STDIN_KEY, '');
  const stdin = typeof storedStdin === 'string' ? storedStdin : '';
  const [storedLimits, setStoredLimits] = usePersistentState<unknown>(PY_LIMITS_KEY, {
    ...DEFAULT_LIVE_LIMITS,
  });
  const limits = useMemo(() => parseStoredLimits(storedLimits), [storedLimits]);

  // The editor owns the document; Run reads the latest text from a ref. Saving waits for a pause in
  // typing, so a keystroke doesn't re-render the view.
  const sourceRef = useRef(initialSource);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveNow = useCallback(() => {
    if (saveTimer.current !== null) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    setStoredSource(sourceRef.current);
  }, [setStoredSource]);
  // The syntax-error mark belongs to the text that ran: the first edit after a run (or a Reset)
  // clears it, so it never lands on a line of different text. One re-render per run at most.
  const [edited, setEdited] = useState(false);
  const editedRef = useRef(false);
  const markEdited = useCallback(() => {
    if (editedRef.current) return;
    editedRef.current = true;
    setEdited(true);
  }, []);
  const onEdit = useCallback(
    (doc: string) => {
      markEdited();
      sourceRef.current = doc;
      if (saveTimer.current !== null) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(saveNow, SAVE_DELAY_MS);
    },
    [markEdited, saveNow],
  );
  // Reset remounts the editor with the default program.
  const [editorKey, setEditorKey] = useState(0);
  const [editorDoc, setEditorDoc] = useState(initialSource);
  const reset = () => {
    sourceRef.current = DEFAULT_PYTHON_PROGRAM;
    markEdited();
    saveNow();
    setEditorDoc(DEFAULT_PYTHON_PROGRAM);
    setEditorKey((k) => k + 1);
  };

  // Preload Pyodide as soon as the mode opens, so the first Run doesn't wait for it.
  const inFlight = useRef(false);
  useEffect(() => {
    if (runner.ready) return;
    dispatch({ type: 'preload' });
    void runner.preload().then((outcome) => {
      if (outcome.ok) dispatch({ type: 'runtime-ready' });
      else if (!outcome.stopped) dispatch({ type: 'runtime-failed', message: outcome.message });
    });
  }, [runner]);
  // Leaving the mode mid-run stops the run (the loaded runtime is kept for next time otherwise),
  // and saves the text.
  useEffect(
    () => () => {
      if (inFlight.current) runner.stop();
      if (saveTimer.current !== null) {
        clearTimeout(saveTimer.current);
        try {
          localStorage.setItem(PY_SOURCE_KEY, JSON.stringify(sourceRef.current));
        } catch {
          /* persistence is best-effort */
        }
      }
    },
    [runner],
  );

  const run = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    editedRef.current = false;
    setEdited(false);
    saveNow();
    const source = sourceRef.current;
    const usedLimits = limits;
    const packages = detectPackages(source);
    dispatch({ type: 'run', pending: packages.filter((p) => !runner.loadedPackages.has(p)) });
    const outcome = await runner.run(
      { source, stdin: stdinLines(stdin), limits: toRunLimits(usedLimits), packages },
      {
        onPackages: (p) => dispatch({ type: 'packages', packages: p }),
        onRunning: () => dispatch({ type: 'running' }),
        onProgress: (n) => dispatch({ type: 'progress', snapshots: n }),
      },
    );
    inFlight.current = false;
    runCounter += 1;
    dispatch({
      type: 'settled',
      run: mapOutcome(outcome, source, usedLimits, `live-python-${runCounter}`),
      workerGone: outcome.killed,
    });
  }, [limits, runner, saveNow, stdin]);

  const stop = () => {
    runner.stop();
    if (!inFlight.current) dispatch({ type: 'stop' });
  };

  // A syntax error marks its line in the editor until the text changes.
  const errorLine =
    !edited && status.phase === 'error' && status.error.line !== undefined
      ? status.error.line
      : null;

  const split = useDefaultLayout({ id: 'se-viz-live-python-split', storage: localStorage });
  const busy =
    status.phase === 'loading-runtime' ||
    status.phase === 'loading-packages' ||
    status.phase === 'running';
  const runtimeNote =
    state.runtime === 'ready'
      ? 'Python ready'
      : state.runtime === 'loading'
        ? 'Loading Python…'
        : 'Python loads on Run';

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg">
      <header className="flex items-center justify-between gap-4 border-b border-hairline bg-surface px-4 py-2.5">
        <div className="flex items-center gap-4">
          <Mark />
          <span className="h-4 w-px bg-hairline" />
          <nav aria-label="Lesson" className="flex items-center gap-2 font-sans text-xs">
            <span className="font-semibold text-ink">Live coding · Python</span>
          </nav>
          <span
            className={`rounded-md border px-2 py-0.5 font-sans text-[11px] ${
              state.runtime === 'ready'
                ? 'border-changed/40 text-changed'
                : 'border-hairline text-ink-faint'
            }`}
          >
            {runtimeNote}
          </span>
        </div>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </header>

      <Group
        orientation="vertical"
        className="flex min-h-0 flex-1 flex-col"
        defaultLayout={split.defaultLayout}
        onLayoutChange={split.onLayoutChange}
      >
        <Panel id="editor" defaultSize="42%" minSize="15%" maxSize="85%" className="min-h-0">
          <section className="flex h-full min-h-0 flex-col bg-surface">
            <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-2">
              <span className="font-mono text-[11px] text-ink-faint">&lt;/&gt;</span>
              <span className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">
                {LIVE_PYTHON_FILE}
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-3">
                <fieldset
                  disabled={state.inFlight}
                  className="flex items-center gap-2.5 border-0 p-0 disabled:opacity-60"
                >
                  <legend className="sr-only">Run limits</legend>
                  <LimitField
                    label="Steps"
                    limitKey="maxSteps"
                    value={limits.maxSteps}
                    onCommit={(v) => setStoredLimits({ ...limits, maxSteps: v })}
                  />
                  <LimitField
                    label="Time"
                    unit="s"
                    limitKey="timeoutS"
                    value={limits.timeoutS}
                    onCommit={(v) => setStoredLimits({ ...limits, timeoutS: v })}
                  />
                  <LimitField
                    label="Output"
                    unit="lines"
                    limitKey="maxStdoutLines"
                    value={limits.maxStdoutLines}
                    onCommit={(v) => setStoredLimits({ ...limits, maxStdoutLines: v })}
                  />
                </fieldset>
                <button
                  type="button"
                  onClick={reset}
                  disabled={state.inFlight}
                  title="Replace the editor text with the default program"
                  className="rounded-md border border-hairline bg-surface-2 px-2.5 py-1 font-sans text-xs text-ink-muted transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reset
                </button>
                {canStop(state) ? (
                  <button
                    type="button"
                    onClick={stop}
                    title="Stop: end the run (or the load) now"
                    className="flex items-center gap-1.5 rounded-md border border-danger/60 bg-danger-soft px-3 py-1 font-sans text-xs font-semibold text-danger transition-opacity hover:opacity-90"
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <rect x="5" y="5" width="14" height="14" rx="2" />
                    </svg>
                    Stop
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void run()}
                  disabled={!canRun(state)}
                  title="Run (⌘/Ctrl+Enter)"
                  className="flex items-center gap-1.5 rounded-md border border-pointer bg-pointer px-3.5 py-1 font-sans text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {state.inFlight ? (
                    'Running…'
                  ) : (
                    <>
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M7 5l12 7-12 7V5z" />
                      </svg>
                      Run
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1">
              <div className="min-h-0 min-w-0 flex-1">
                <CodeEditor
                  key={editorKey}
                  initialDoc={editorDoc}
                  language={PYTHON_LANGUAGE}
                  extensions={PYTHON_EXTRAS}
                  ariaLabel="Python source editor"
                  errorLine={errorLine}
                  onChange={onEdit}
                  onRun={() => void run()}
                />
              </div>
              <label className="flex w-52 shrink-0 flex-col border-l border-hairline">
                <span className="border-b border-hairline px-3 py-1.5 font-sans text-[11px] text-ink-muted">
                  <span className="font-semibold uppercase tracking-wider text-ink-faint">
                    stdin
                  </span>
                  <span className="text-ink-faint"> · one line per input()</span>
                </span>
                <textarea
                  value={stdin}
                  onChange={(e) => setStoredStdin(e.target.value)}
                  placeholder="(optional)"
                  spellCheck={false}
                  className="min-h-0 flex-1 resize-none bg-transparent px-3 py-2 font-mono text-xs leading-5 text-ink placeholder:text-ink-faint focus:outline-none"
                />
              </label>
            </div>
          </section>
        </Panel>

        <Separator
          aria-label="Resize the editor and result panels"
          className="group relative flex h-2 items-center justify-center"
        >
          <div className="h-px w-full bg-hairline transition-colors group-hover:bg-pointer group-focus-visible:bg-pointer" />
          <div className="pointer-events-none absolute h-1 w-8 rounded-full bg-hairline-strong transition-colors group-hover:bg-pointer" />
        </Separator>

        <Panel id="result" minSize="15%" className="min-h-0">
          <div className="flex h-full min-h-0 flex-col">
            {status.phase === 'done' ? (
              <>
                {status.ending ? <EndingBanner ending={status.ending} limits={limits} /> : null}
                <PythonPlayer
                  key={state.seq}
                  trace={status.trace}
                  explanationSlot={explanationSlot}
                  onCollapseExplanation={onCollapseExplanation}
                  explanationWidth={explanationWidth}
                />
              </>
            ) : busy ? (
              <StatusCard status={status} />
            ) : status.phase === 'error' ? (
              <div className="px-4 pt-4">
                <ErrorPanel error={status.error} />
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-center font-sans text-sm text-ink-muted">
                {status.phase === 'stopped'
                  ? 'Stopped before the program recorded any steps. Press Run to start again.'
                  : 'Write Python above and press Run (⌘/Ctrl+Enter) to watch it execute step by step.'}
              </div>
            )}
          </div>
        </Panel>
      </Group>

      {status.phase !== 'done' && explanationSlot
        ? createPortal(
            <ExplanationPlaceholder onCollapse={onCollapseExplanation} />,
            explanationSlot,
          )
        : null}
    </div>
  );
}
