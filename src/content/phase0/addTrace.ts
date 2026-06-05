/**
 * Phase 0 vertical slice — a hand-authored, known-correct trace for `add(x, y)`.
 *
 * This is the one example that proves the traces-first architecture end to end: it walks the call
 * stack through `main` calling `add`, including the push of the `add` frame on call and its pop on
 * return. Every step is a full memory snapshot (see {@link Trace}); the engine diffs adjacent
 * steps to animate.
 *
 * Only scalars and stack frames are used here — heap is empty — but the trace conforms to the same
 * {@link Trace} contract every later phase will use.
 */

import type { Cell, ScalarCell, StackFrame, Step, Trace } from '../../engine/trace/types.ts';
import { ADD_SOURCE } from './source.ts';

/** Convenience builder for an `int` scalar cell with a fixed display address. */
function intCell(id: string, name: string, value: number | null, address: string): ScalarCell {
  return { kind: 'scalar', id, name, type: 'int', value, address };
}

// Stable display addresses. `main`'s frame sits higher in memory; `add`'s frame is lower because
// the stack grows downward on the call into `add`.
const ADDR = {
  x: '0x7ffeefbff5a8',
  y: '0x7ffeefbff5a4',
  z: '0x7ffeefbff5a0',
  a: '0x7ffeefbff584',
  b: '0x7ffeefbff580',
  sum: '0x7ffeefbff57c',
} as const;

/** Build the `main` frame with whichever of its locals exist at a given step. */
function mainFrame(vars: Cell[]): StackFrame {
  return { id: 'main#0', name: 'main', callId: 0, variables: vars };
}

/** Build the `add` frame with whichever of its locals exist at a given step. */
function addFrame(vars: Cell[]): StackFrame {
  return { id: 'add#0', name: 'add', callId: 0, variables: vars };
}

const x3 = (): ScalarCell => intCell('main.x', 'x', 3, ADDR.x);
const y4 = (): ScalarCell => intCell('main.y', 'y', 4, ADDR.y);
const zUninit = (): ScalarCell => intCell('main.z', 'z', null, ADDR.z);
const z7 = (): ScalarCell => intCell('main.z', 'z', 7, ADDR.z);
const a3 = (): ScalarCell => intCell('add.a', 'a', 3, ADDR.a);
const b4 = (): ScalarCell => intCell('add.b', 'b', 4, ADDR.b);
const sum7 = (): ScalarCell => intCell('add.sum', 'sum', 7, ADDR.sum);

const steps: Step[] = [
  {
    id: 'main-enter',
    index: 0,
    narration: 'Program starts. A stack frame for main is created.',
    highlightedLines: [7],
    stack: [mainFrame([])],
    heap: [],
  },
  {
    id: 'decl-x',
    index: 1,
    narration: 'Declare int x and store the value 3 in main’s frame.',
    highlightedLines: [9],
    stack: [mainFrame([x3()])],
    heap: [],
  },
  {
    id: 'decl-y',
    index: 2,
    narration: 'Declare int y and store the value 4.',
    highlightedLines: [10],
    stack: [mainFrame([x3(), y4()])],
    heap: [],
  },
  {
    id: 'add-call',
    index: 3,
    narration:
      'Call add(x, y). A new frame for add is pushed on top of the stack; the arguments are copied into parameters a = 3 and b = 4. z is declared but not yet assigned.',
    highlightedLines: [11, 1],
    stack: [mainFrame([x3(), y4(), zUninit()]), addFrame([a3(), b4()])],
    heap: [],
  },
  {
    id: 'add-sum',
    index: 4,
    narration: 'Inside add: compute sum = a + b = 7.',
    highlightedLines: [3],
    stack: [mainFrame([x3(), y4(), zUninit()]), addFrame([a3(), b4(), sum7()])],
    heap: [],
  },
  {
    id: 'add-return',
    index: 5,
    narration: 'add returns the value 7 to its caller.',
    highlightedLines: [4],
    stack: [mainFrame([x3(), y4(), zUninit()]), addFrame([a3(), b4(), sum7()])],
    heap: [],
  },
  {
    id: 'add-pop-assign-z',
    index: 6,
    narration: 'The add frame is popped off the stack, and its return value 7 is assigned to z.',
    highlightedLines: [11],
    stack: [mainFrame([x3(), y4(), z7()])],
    heap: [],
  },
  {
    id: 'main-return',
    index: 7,
    narration: 'main returns 0 and the program ends.',
    highlightedLines: [12],
    stack: [mainFrame([x3(), y4(), z7()])],
    heap: [],
  },
];

/** The Phase 0 trace, ready to feed to the engine. */
export const addTrace: Trace = {
  id: 'phase0-add',
  title: 'add(x, y) — call stack basics',
  language: 'c',
  source: ADD_SOURCE,
  steps,
  covers: ['SE200: Functions and Nested Loops'],
};
