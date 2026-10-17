/**
 * What a live Python run shows (Phase 31): a worker {@link RunOutcome} mapped to either a playable
 * trace or an error without one. Pure, so every case is tested on fixtures.
 *
 * - **No steps and an error** (a `SyntaxError`, a load failure, a kill before the first step): an
 *   error panel; a syntax error also names the line (the editor highlights it).
 * - **A runtime exception** ends the trace on an extra final step that shows the exception type,
 *   message and line, with the traceback in the output panel.
 * - **A truncation** (step / time / output / size limit, or Stop) ends the trace on an extra final
 *   step, "Stopped after N steps", that says which limit it was.
 *
 * The extra final step keeps the last recorded state, so the memory view doesn't change on it.
 *
 * @packageDocumentation
 */
import type { Step, Trace } from '../../engine/trace/types.ts';
import type { RunOutcome } from '../client.ts';
import type { RecorderStop, RunError } from '../protocol.ts';
import { stdoutLines } from '../mappings/plan.ts';
import { recordingToTrace } from '../toTrace.ts';
import type { LiveLimits } from './limits.ts';

/** Why a trace stopped before the program finished. */
export type StopReason = 'steps' | 'time' | 'stdout' | 'size' | 'stopped';

/** How a playable trace ends, beyond the program finishing normally. */
export type LiveEnding =
  | { kind: 'exception'; type: string; message: string; line?: number }
  | {
      kind: 'stopped';
      reason: StopReason;
      /** Program steps shown before the "Stopped after N steps" step. */
      steps: number;
      /** The program caught the recorder's stop (a bare `except:`) and had to be killed. */
      swallowed?: boolean;
    };

/** An error shown without a trace. */
export interface LiveRunError {
  type: string;
  message: string;
  line?: number;
  /** 1-based column (syntax errors). */
  column?: number;
  /** Python's own rendering: the traceback, or the caret display of a syntax error. */
  detail?: string;
}

export type MappedRun =
  | { kind: 'trace'; trace: Trace; ending: LiveEnding | null }
  | { kind: 'error'; error: LiveRunError }
  /** Stopped (by the presenter) before the first step was recorded. */
  | { kind: 'stopped' };

/** The file name shown above the code. */
export const LIVE_PYTHON_FILE = 'main.py';

/** Plain-English name of each limit, for the final step and the banner. */
export function stopSentence(reason: StopReason, limits: LiveLimits, swallowed = false): string {
  const why = (() => {
    switch (reason) {
      case 'steps':
        return `the step limit (${limits.maxSteps}) was reached`;
      case 'time':
        return `the time limit (${limits.timeoutS} s) was reached`;
      case 'stdout':
        return `the output limit (${limits.maxStdoutLines} lines) was reached`;
      case 'size':
        return 'the recording grew too large to show';
      case 'stopped':
        return 'you pressed Stop';
    }
  })();
  return swallowed
    ? `${why}. The program caught the stop (a bare \`except:\`) and kept running, so it was ended at the time limit`
    : why;
}

/** "Stopped after N steps: <why>." */
export function stoppedHeadline(
  ending: Extract<LiveEnding, { kind: 'stopped' }>,
  limits: LiveLimits,
): string {
  const n = ending.steps;
  return `Stopped after ${n} ${n === 1 ? 'step' : 'steps'}: ${stopSentence(ending.reason, limits, ending.swallowed)}.`;
}

/** "KeyError: 'beans' (line 5)". */
export function exceptionHeadline(e: { type: string; message: string; line?: number }): string {
  const what = e.message ? `${e.type}: ${e.message}` : e.type;
  return e.line !== undefined ? `${what} (line ${e.line})` : what;
}

/** A final step that keeps `last`'s memory and output and says how the run ended. */
function finalStep(
  last: Step,
  narration: string,
  extraOutput: readonly string[] = [],
  line?: number,
): Step {
  const index = last.index + 1;
  const step: Step = {
    ...last,
    id: `py-${index}`,
    index,
    narration,
    highlightedLines: line !== undefined ? [line] : last.highlightedLines,
    stdout: [...(last.stdout ?? []), ...extraOutput],
  };
  // Authored-looking fields of the copied step would describe the wrong step.
  delete step.explain;
  delete step.coach;
  return step;
}

/** Python's tracebacks name the compiled file `<student>`; the editor calls it `main.py`. */
export function displayTraceback(text: string): string {
  return text.replaceAll('File "<student>"', `File "${LIVE_PYTHON_FILE}"`);
}

/** Which limit a recorder stop or a kill stands for (a depth stop is a RecursionError, not one). */
function reasonOf(stop: RecorderStop | undefined): StopReason | null {
  return stop === undefined || stop === 'depth' ? null : stop;
}

/**
 * Map a run's outcome to what the live view shows.
 *
 * @param outcome - What `PythonRunner.run` resolved with.
 * @param source - The program that ran (the trace keeps its own copy).
 * @param limits - The limits the run used (for the "Stopped after" wording).
 * @param id - A trace id unique per run.
 */
export function mapOutcome(
  outcome: RunOutcome,
  source: string,
  limits: LiveLimits,
  id: string,
): MappedRun {
  const { result } = outcome;
  const error: RunError | undefined = result.error;

  if (result.steps.length === 0) {
    if (outcome.stopped) return { kind: 'stopped' };
    if (error) {
      const timedOut = outcome.killed && error.type === 'TimeoutError';
      return {
        kind: 'error',
        error: {
          type: error.type,
          message: timedOut
            ? `${error.message} Nothing ran that the recorder could see (for example a loop inside a library call).`
            : error.message,
          ...(error.line !== undefined ? { line: error.line } : {}),
          ...(error.offset !== undefined ? { column: error.offset } : {}),
          ...(error.traceback ? { detail: displayTraceback(error.traceback) } : {}),
        },
      };
    }
    return {
      kind: 'error',
      error: { type: 'Nothing to show', message: 'The program has no statements to step through.' },
    };
  }

  const trace = recordingToTrace(result, source, {
    id,
    title: 'Live coding · Python',
    file: LIVE_PYTHON_FILE,
  });
  const steps = trace.steps;
  if (steps.length === 0) return { kind: 'error', error: { type: 'Nothing to show', message: '' } };
  const last = steps[steps.length - 1];
  const shown = steps.length;

  // Ended early: Stop, a kill at the time limit, or one of the recorder's own limits.
  let reason: StopReason | null = null;
  let swallowed = false;
  if (outcome.stopped) reason = 'stopped';
  else if (outcome.killed) {
    // The recorder had already stopped the program, which caught the stop and ran on untraced.
    const earlier = reasonOf(outcome.recorderStop);
    reason = earlier ?? 'time';
    swallowed = earlier !== null;
  } else if (result.truncated) reason = result.truncated;

  if (reason !== null) {
    const ending: LiveEnding = {
      kind: 'stopped',
      reason,
      steps: shown,
      ...(swallowed ? { swallowed: true } : {}),
    };
    steps.push(finalStep(last, stoppedHeadline(ending, limits)));
    return { kind: 'trace', trace, ending };
  }

  if (error) {
    const ending: LiveEnding = {
      kind: 'exception',
      type: error.type,
      message: error.message,
      ...(error.line !== undefined ? { line: error.line } : {}),
    };
    const traceback = error.traceback
      ? stdoutLines(displayTraceback(error.traceback))
      : [exceptionHeadline(error)];
    steps.push(
      finalStep(
        last,
        `${exceptionHeadline(error)}. The program stopped here with an uncaught exception.`,
        traceback,
        error.line,
      ),
    );
    return { kind: 'trace', trace, ending };
  }

  return { kind: 'trace', trace, ending: null };
}
