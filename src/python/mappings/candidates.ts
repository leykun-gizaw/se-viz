/**
 * The three candidate mappings of a recorded run onto SE-Viz steps (Phase 29 spike). Each is a
 * small pure function; `docs/PYTHON_TRACE_FORMAT.md` records which one won and why.
 *
 * - **A. Reuse the C model** ({@link mapA}): every step is an ordinary {@link Step} — names are
 *   cells, objects are heap blocks with an `objectKind` tag — so the existing memory canvas, diff,
 *   explanation panel and timeline consume it unchanged.
 * - **B. Separate payload** ({@link mapB}): a `view: 'python'` trace whose steps carry a Python
 *   Tutor–shaped `python` payload (frames of names, objects by id) and an empty `stack` / `heap`;
 *   it needs its own renderer.
 * - **C. Hybrid** ({@link mapC} + {@link adaptC}): B's payload is what the trace stores, and each
 *   step is adapted to A's shapes when it is rendered.
 *
 * The trace types here are spike-local: `language: 'python'` and `view: 'python'` are not in the
 * shared `Trace` type yet (Phase 30 adds whichever the decision needs).
 *
 * @packageDocumentation
 */
import type { Step } from '../../engine/trace/types.ts';
import type { PyEvent, PyFrame, PyObject, PyValue, RunResult } from '../protocol.ts';
import { stateToMemory, type PythonState } from './memory.ts';
import { callIds, planSteps, stdoutLines, type PlannedStep } from './plan.ts';

/** Spike-local trace wrapper (Phase 30 widens `TraceLanguage` to include `'python'`). */
export interface PyTrace<S extends Step = Step> {
  id: string;
  title: string;
  language: 'python';
  source: string;
  steps: S[];
  /** Candidate B / C only. */
  view?: 'python';
}

function baseStep(p: PlannedStep, index: number): Omit<Step, 'stack' | 'heap'> {
  const topFrame = p.snap.frames[p.snap.frames.length - 1];
  return {
    id: `py-${index}`,
    index,
    narration: p.narration,
    highlightedLines: [p.line],
    stdout: stdoutLines(p.snap.stdout),
    ...(topFrame ? { activeId: topFrame.id } : {}),
  };
}

/* ───────────────────────── A ───────────────────────── */

/** Candidate A: map a run straight to C-model steps. */
export function mapA(result: RunResult, source: string, id = 'python'): PyTrace {
  const calls = callIds(result);
  const steps = planSteps(result).map(
    (p, index): Step => ({
      ...baseStep(p, index),
      ...stateToMemory(p.snap, calls),
    }),
  );
  return { id, title: id, language: 'python', source, steps };
}

/* ───────────────────────── B ───────────────────────── */

/** One frame in candidate B's payload. */
export interface PythonFramePayload extends PyFrame {
  callId: number;
}

/** Candidate B's per-step payload, shaped like Python Tutor's: frames of names, objects by id. */
export interface PythonStepPayload {
  event: PyEvent;
  frames: PythonFramePayload[];
  /** Objects in first-reached order. */
  objects: { id: string; object: PyObject }[];
  returnValue?: PyValue;
  unwinding?: true;
  exception?: { type: string; message: string };
}

/** A candidate B step: memory regions empty, everything in `python`. */
export interface PythonStepB extends Step {
  python: PythonStepPayload;
}

/** Candidate B: a `view: 'python'` trace with a Python payload per step. */
export function mapB(result: RunResult, source: string, id = 'python'): PyTrace<PythonStepB> {
  const calls = callIds(result);
  const steps = planSteps(result).map((p, index): PythonStepB => {
    const { snap } = p;
    const python: PythonStepPayload = {
      event: snap.event,
      frames: snap.frames.map((f) => ({ ...f, callId: calls.get(f.id) ?? 0 })),
      objects: Object.entries(snap.objects).map(([oid, object]) => ({ id: oid, object })),
      ...(snap.returnValue ? { returnValue: snap.returnValue } : {}),
      ...(snap.unwinding ? { unwinding: true as const } : {}),
      ...(snap.exception ? { exception: snap.exception } : {}),
    };
    return { ...baseStep(p, index), stack: [], heap: [], python };
  });
  return { id, title: id, language: 'python', source, steps, view: 'python' };
}

/* ───────────────────────── C ───────────────────────── */

/** Candidate C stores exactly B's trace. */
export const mapC = mapB;

/** Candidate C's render-time adapter: B's payload → A's shapes, for the existing memory canvas. */
export function adaptC(step: PythonStepB): Step {
  const { python, ...rest } = step;
  const state: PythonState = {
    frames: python.frames,
    objects: Object.fromEntries(python.objects.map((o) => [o.id, o.object])),
    ...(python.returnValue ? { returnValue: python.returnValue } : {}),
  };
  const calls = new Map(python.frames.map((f) => [f.id, f.callId]));
  return { ...rest, ...stateToMemory(state, calls) };
}
