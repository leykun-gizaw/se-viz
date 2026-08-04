/**
 * Live Coding mode (Phase 23): type your own C, hit **Run**, and the app POSTs it to the SE-Viz
 * Tracer backend and plays the returned trace in the **existing player** — same `useTrace`,
 * `Transport`, `Stage` (memory view, inline values, two-beat stepping), and presentation mode as
 * every curriculum module. No renderer fork.
 *
 * Layout, top to bottom: a slim header (mark + "Live coding" breadcrumb + theme toggle), the
 * editor card (CodeMirror, stdin field, Run), then the outcome — a console-style error panel
 * (compile errors show the raw gcc messages: students must see *why* it didn't compile), a
 * truncation banner when the tracer cut the run short, or the player on success. The run state
 * machine itself is pure and lives in `src/live/runState.ts`.
 */
import { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';
import type { Trace } from '../../engine/trace/types.ts';
import { useTrace } from '../../engine/trace/useTrace.ts';
import { useKeyboardControls } from '../../hooks/useKeyboardControls.ts';
import { usePersistentState } from '../../hooks/usePersistentState.ts';
import type { Theme } from '../../hooks/useTheme.ts';
import {
  COMPILE_FLAGS_KEY,
  DEFAULT_FLAGS,
  parseStoredFlags,
  type CompileFlag,
} from '../../live/compileOptions.ts';
import { DEFAULT_PROGRAM } from '../../live/defaultProgram.ts';
import {
  errorHeadline,
  INITIAL_RUN_STATE,
  runReducer,
  truncationBanner,
  warningsHeadline,
  werrorExplanation,
} from '../../live/runState.ts';
import { postTrace, type LiveError } from '../../live/tracerClient.ts';
import { PresentationMode } from '../PresentationMode.tsx';
import { Stage } from '../Stage.tsx';
import { Mark, ThemeToggle } from '../TopBar.tsx';
import { Transport } from '../Transport.tsx';
import { CodeEditor } from './CodeEditor.tsx';
import { CompileOptions } from './CompileOptions.tsx';

/**
 * Console-style failure panel. Only compile errors expose the raw backend details (gcc output).
 *
 * When `-Werror` was on, an explanation goes **above** the gcc output: otherwise a student reads
 * "your program did not compile" over what is only a warning and concludes the tool is broken.
 * `invalid_request` shows the backend's own message — the UI can only produce allowlisted flag
 * combinations, so seeing one means the two allowlists have drifted, and that must be diagnosable.
 */
function ErrorPanel({ error, flags }: { error: LiveError; flags: readonly CompileFlag[] }) {
  const isCompile = error.code === 'compile_error';
  const werror = werrorExplanation(error.code, flags);
  return (
    <div className="flex max-h-52 flex-col overflow-hidden rounded-lg border border-danger/40 bg-surface">
      <div className="border-b border-hairline px-4 py-1.5">
        <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-danger">
          {isCompile ? 'Compiler output' : 'Run failed'}
        </span>
      </div>
      <div className="flex min-h-0 flex-col gap-1.5 overflow-auto px-4 py-2.5">
        <span className="font-sans text-sm text-ink">{errorHeadline(error.code)}</span>
        {werror ? (
          <span className="font-sans text-xs text-ink-muted">
            <code className="se-code text-ink">-Werror</code>
            {werror.replace('-Werror', '')}
          </span>
        ) : null}
        {error.code === 'invalid_request' ? (
          <span className="font-sans text-xs text-ink-muted">{error.message}</span>
        ) : null}
        {isCompile && error.details ? (
          <pre className="se-code whitespace-pre-wrap text-xs leading-5 text-danger">
            {error.details}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The non-fatal counterpart to {@link ErrorPanel}: the program compiled and ran, but gcc had
 * something to say. This is what makes the `-Wall`/`-Wextra` defaults observable — without it,
 * ticking the default boxes changes nothing a student can see.
 *
 * A native `<details>`, **open by default**: the header and count are visible without interaction
 * (the spec's requirement), and the text itself is too, because a warning a student has to click
 * to discover is a warning they will not read. They can collapse it.
 */
function WarningsPanel({ warnings }: { warnings: string }) {
  return (
    <details
      open
      className="flex max-h-44 flex-col overflow-hidden rounded-lg border border-active/50 bg-surface"
    >
      <summary className="cursor-pointer list-none border-b border-hairline px-4 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-wider text-active">
        ⚠ {warningsHeadline(warnings)}
      </summary>
      <div className="max-h-32 overflow-auto px-4 py-2.5">
        <pre className="se-code whitespace-pre-wrap text-xs leading-5 text-ink-muted">
          {warnings}
        </pre>
      </div>
    </details>
  );
}

/** The compile command the run actually used — teaching surface, not chrome. */
function CompiledWith({ flags }: { flags: readonly string[] }) {
  return (
    <div className="flex items-center gap-2 border-b border-hairline bg-surface px-4 py-1">
      {/* Not "Compiled with" — that is the warnings panel's header, and the two sit one above the
          other when a run warns. */}
      <span className="font-sans text-[10px] uppercase tracking-wider text-ink-faint">
        Compile command
      </span>
      <code className="se-code truncate text-[11px] text-ink-muted">
        gcc {flags.join(' ')} …
      </code>
    </div>
  );
}

/**
 * The existing player bound to one returned trace. Remounted per successful run (keyed on the run
 * seq) so each run starts at step 0. Keyboard transport and presentation mode work exactly as in
 * the curriculum workbench; typing in the editor never triggers them (the global hook ignores
 * editable targets).
 */
function LivePlayer({ trace }: { trace: Trace }) {
  // Breadcrumb metadata only (presentation mode shows it); the trace itself is untouched.
  const decorated = useMemo(
    () => ({ ...trace, course: 'Live coding', file: trace.file ?? 'live.c' }),
    [trace],
  );
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
    return <PresentationMode player={player} onExit={() => setPresenting(false)} />;
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-hairline bg-surface px-4 py-1.5">
        <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
          Execution
        </span>
        <Transport player={player} />
      </div>
      <Stage player={player} />
    </div>
  );
}

export interface LiveCodingViewProps {
  theme: Theme;
  onToggleTheme: () => void;
}

export function LiveCodingView({ theme, onToggleTheme }: LiveCodingViewProps) {
  const [state, dispatch] = useReducer(runReducer, INITIAL_RUN_STATE);
  // The editor owns the document; React only needs the latest text at Run time, so a ref (not
  // state) avoids re-rendering the whole view on every keystroke.
  const sourceRef = useRef(DEFAULT_PROGRAM);
  const inflightRef = useRef(false);
  const [stdin, setStdin] = useState('');

  // The student's flag selection, remembered across reloads. `usePersistentState` returns whatever
  // JSON was in storage, so it is typed `unknown` and re-validated here on every read: a stale key
  // from an older build or a hand-edited value falls back to the defaults rather than posting a
  // flag the backend would reject.
  const [storedFlags, setStoredFlags] = usePersistentState<unknown>(COMPILE_FLAGS_KEY, [
    ...DEFAULT_FLAGS,
  ]);
  const flags = useMemo(() => parseStoredFlags(storedFlags), [storedFlags]);

  const { status } = state;
  const loading = status.phase === 'loading';
  // Persisted, draggable editor↕result split (same mechanism as the Stage's code/memory split).
  const split = useDefaultLayout({ id: 'se-viz-live-split', storage: localStorage });

  // `flags` is a dependency, so each render's `run` closes over the selection as it stands at click
  // time. Changing the picker mid-run cannot relabel the result: the launched flags were already
  // handed to the reducer, and `state.flags` — not this variable — is what the result is labelled
  // with. (CodeEditor keeps ⌘/Ctrl+Enter pointed at the latest `run` via its own effect-synced ref.)
  const run = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    dispatch({ type: 'run', flags });
    const result = await postTrace(sourceRef.current, {
      ...(stdin === '' ? {} : { stdin }),
      flags,
    });
    inflightRef.current = false;
    dispatch({ type: 'settled', result });
  }, [stdin, flags]);

  // What to print in "Compiled with": the backend's echo when it sent one, else what we sent.
  const shownFlags =
    status.phase === 'success' ? (status.appliedFlags ?? state.flags) : state.flags;
  const settled = status.phase === 'success' || status.phase === 'error';

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg">
      <header className="flex items-center justify-between gap-4 border-b border-hairline bg-surface px-4 py-2.5">
        <div className="flex items-center gap-4">
          <Mark />
          <span className="h-4 w-px bg-hairline" />
          <nav aria-label="Lesson" className="flex items-center gap-2 font-sans text-xs">
            <span className="font-semibold text-ink">Live coding</span>
          </nav>
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
                live.c
              </span>
              <div className="ml-auto flex items-center gap-3">
                <CompileOptions
                  flags={flags}
                  onChange={(next) => setStoredFlags(next)}
                  disabled={loading}
                />
                <label className="flex items-center gap-1.5 font-sans text-xs text-ink-muted">
                  stdin
                  <input
                    type="text"
                    value={stdin}
                    onChange={(e) => setStdin(e.target.value)}
                    placeholder="(optional)"
                    className="w-44 rounded-md border border-hairline bg-surface-2 px-2 py-1 font-mono text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-pointer"
                  />
                </label>
                <button
                  type="button"
                  onClick={run}
                  disabled={loading}
                  title="Run (⌘/Ctrl+Enter)"
                  className="flex items-center gap-1.5 rounded-md border border-pointer bg-pointer px-3.5 py-1 font-sans text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
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
            <div className="min-h-0 flex-1">
              <CodeEditor
                initialDoc={DEFAULT_PROGRAM}
                onChange={(doc) => (sourceRef.current = doc)}
                onRun={run}
              />
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
            {settled ? <CompiledWith flags={shownFlags} /> : null}

            {status.phase === 'error' ? (
              <div className="px-4 pt-4">
                <ErrorPanel error={status.error} flags={state.flags} />
              </div>
            ) : null}

            {status.phase === 'success' && status.warnings !== undefined ? (
              <div className="px-4 pt-3">
                <WarningsPanel warnings={status.warnings} />
              </div>
            ) : null}

            {status.phase === 'success' && status.truncated ? (
              <div className="border-b border-hairline bg-active-soft px-4 py-2 font-sans text-xs text-ink">
                ⚠ {truncationBanner(status.truncated)}
              </div>
            ) : null}

            {status.phase === 'success' ? (
              <LivePlayer key={state.seq} trace={status.trace} />
            ) : status.phase === 'error' ? (
              <div className="flex-1" />
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-center font-sans text-sm text-ink-muted">
                {loading
                  ? 'Compiling and running your program…'
                  : 'Write a C program above and press Run (⌘/Ctrl+Enter) to watch it execute step by step.'}
              </div>
            )}
          </div>
        </Panel>
      </Group>
    </div>
  );
}
