/**
 * Shared step planning for every candidate mapping (Phase 29 spike): which recorder snapshots
 * become SE-Viz steps, which line each step highlights, and a plain derived narration.
 *
 * **Timing.** A `sys.settrace` `line` event fires *before* its line runs, but an SE-Viz step is the
 * state *after* its highlighted line ran (Phase 16: `arrive` shows the line over the previous
 * step's memory, `apply` reveals this step's memory). So step *k* shows snapshot *i* and
 * highlights the line that ran between snapshot *i − 1* and snapshot *i*:
 * - after a `return` event, execution resumes in the caller: its line (the call site);
 * - otherwise, the line of the event before.
 *
 * A snapshot that directly follows a `call` event makes no step: nothing ran between entering a
 * function and reaching its first line, so the memory is identical. With a single snapshot (a
 * one-event run) that snapshot is the only step; with none (a syntax error) there are no steps.
 *
 * @packageDocumentation
 */
import type { PyFrame, PySnapshot, PyValue, RunResult } from '../protocol.ts';

export interface PlannedStep {
  /** The snapshot whose state this step shows. */
  snap: PySnapshot;
  /** The 1-based line that just ran. */
  line: number;
  narration: string;
}

/** The line execution was on after `prev`: the caller's line after a return, else `prev.line`. */
function lineAfter(prev: PySnapshot): number {
  if (prev.event === 'return' && prev.frames.length >= 2) {
    return prev.frames[prev.frames.length - 2].line;
  }
  return prev.line;
}

function top(snap: PySnapshot): PyFrame | undefined {
  return snap.frames[snap.frames.length - 1];
}

function short(value: PyValue | undefined): string {
  if (!value) return '';
  return value.kind === 'prim' ? value.repr : `a ${value.id}`;
}

function narrate(prev: PySnapshot | null, snap: PySnapshot, line: number): string {
  const frame = top(snap);
  const name = frame?.name ?? '<module>';
  switch (snap.event) {
    case 'call': {
      const args = (frame?.vars ?? [])
        .map((v) => `${v.name}=${v.value.kind === 'prim' ? v.value.repr : '…'}`)
        .join(', ');
      return `Line ${line} calls ${name}(${args}).`;
    }
    case 'return':
      if (snap.unwinding) return `${name} exits because of an exception.`;
      if (name === '<module>') return 'The program finished.';
      // A class body has no return value; a function always has one (None included).
      if (!snap.returnValue) return `${name} finishes.`;
      return `${name} returns ${short(snap.returnValue)}.`;
    case 'exception':
      return `Line ${line} raised ${snap.exception?.type ?? 'an exception'}: ${snap.exception?.message ?? ''}`;
    case 'line':
      if (prev?.event === 'return') return `Back in ${name}: line ${line} finishes.`;
      return `Line ${line} ran.`;
  }
}

/** Turn a run's snapshots into the step sequence every candidate mapping shares. */
export function planSteps(result: RunResult): PlannedStep[] {
  const snaps = result.steps;
  if (snaps.length === 0) return [];
  if (snaps.length === 1) {
    return [
      { snap: snaps[0], line: snaps[0].line, narration: narrate(null, snaps[0], snaps[0].line) },
    ];
  }
  const planned: PlannedStep[] = [];
  for (let i = 1; i < snaps.length; i++) {
    const prev = snaps[i - 1];
    if (prev.event === 'call') continue;
    const line = lineAfter(prev);
    planned.push({ snap: snaps[i], line, narration: narrate(prev, snaps[i], line) });
  }
  return planned;
}

/**
 * `callId` per frame id (the SE-Viz `StackFrame.callId`): the k-th activation of a function name
 * gets `k`, counting from 0, in first-seen order across the run.
 */
export function callIds(result: RunResult): Map<string, number> {
  const ids = new Map<string, number>();
  const perName = new Map<string, number>();
  for (const snap of result.steps) {
    for (const frame of snap.frames) {
      if (ids.has(frame.id)) continue;
      const n = perName.get(frame.name) ?? 0;
      ids.set(frame.id, n);
      perName.set(frame.name, n + 1);
    }
  }
  return ids;
}

/** Cumulative stdout as SE-Viz `Step.stdout` lines (a trailing partial line is kept). */
export function stdoutLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}
