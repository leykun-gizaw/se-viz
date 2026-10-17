/**
 * Small hand-built Python steps for tests (Phase 30). A step is written as a raw recorder state
 * (frames of names, objects by id) and mapped through the real Phase 29 mapping, so the cell ids are
 * exactly the ones a recorded run produces (`f1.a`, `o1[0]`, `o2['corn']`, `o3.fuel`).
 *
 * Test-only: nothing in the app imports this file.
 *
 * @packageDocumentation
 */
import { stateToMemory } from '../../python/mappings/memory.ts';
import type { PyObject, PyValue } from '../../python/protocol.ts';
import type { Step, Trace } from './types.ts';

export const int = (n: number): PyValue => ({ kind: 'prim', type: 'int', repr: String(n) });
export const str = (s: string): PyValue => ({ kind: 'prim', type: 'str', repr: `'${s}'` });
export const none: PyValue = { kind: 'prim', type: 'NoneType', repr: 'None' };
export const ref = (id: string): PyValue => ({ kind: 'ref', id });

export const list = (...items: PyValue[]): PyObject => ({ kind: 'list', type: 'list', items });
export const tuple = (...items: PyValue[]): PyObject => ({ kind: 'tuple', type: 'tuple', items });
export const set = (...items: PyValue[]): PyObject => ({ kind: 'set', type: 'set', items });
export const dict = (...entries: [PyValue, PyValue][]): PyObject => ({
  kind: 'dict',
  type: 'dict',
  entries: entries.map(([key, value]) => ({ key, value })),
});
export const instance = (type: string, attrs: Record<string, PyValue>): PyObject => ({
  kind: 'instance',
  type,
  attrs: Object.entries(attrs).map(([name, value]) => ({ name, value })),
});
export const fn = (name: string, params: string[]): PyObject => ({
  kind: 'function',
  type: 'function',
  name,
  params,
});

/** One frame: `[id, function name, names]`; names keep their insertion order. */
export type FrameSpec = [id: string, name: string, vars: Record<string, PyValue>];

/** A Python step from raw state. `returnValue` goes into the top frame, as the mapping does. */
export function pyStep(
  index: number,
  frames: FrameSpec[],
  objects: Record<string, PyObject> = {},
  returnValue?: PyValue,
): Step {
  const state = {
    frames: frames.map(([id, name, vars]) => ({
      id,
      name,
      line: 1,
      vars: Object.entries(vars).map(([n, value]) => ({ name: n, value })),
    })),
    objects,
    ...(returnValue ? { returnValue } : {}),
  };
  const calls = new Map(frames.map(([id], i) => [id, i]));
  return {
    id: `s${index}`,
    index,
    narration: `step ${index}`,
    highlightedLines: [1],
    ...stateToMemory(state, calls),
  };
}

/** A Python trace around some steps (one source line per step is plenty for validation). */
export function pyTrace(steps: Step[], source = 'pass\n'): Trace {
  return { id: 'py', title: 'py', language: 'python', source, steps };
}
