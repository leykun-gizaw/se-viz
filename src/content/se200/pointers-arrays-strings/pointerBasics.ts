/**
 * SE 200 · Pointers, Arrays and Strings (week 3) — pointer basics.
 *
 * `&x` (address-of), `*p` (dereference — read), and `*p = 99` (write *through* the pointer). The
 * key insight: writing through a pointer changes the **target** (`x`), not the pointer; `x` pulses
 * while `p` is unchanged. `y = *p` first copies the read value, so after the write `x = 99` but
 * `y` stays 5 — proving the read was a copy.
 *
 * Hand-traced: x=5; p=&x; y=*p=5; *p=99 ⇒ x=99 (y still 5). Prints "x=99 y=5".
 */
import type { Cell, ScalarCell, StackFrame, Step, Trace } from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

const SOURCE = `#include <stdio.h>

int main(void)
{
    int x = 5;
    int *p = &x;
    int y = *p;
    *p = 99;
    printf("x=%d y=%d\\n", x, y);
    return 0;
}
`;

const ADDR = { x: '0x7ffd0010', y: '0x7ffd0014', p: '0x7ffd0018' } as const;

function intCell(id: string, name: string, value: number | null, address: string): ScalarCell {
  return { kind: 'scalar', id, name, type: 'int', value, address };
}

/** main() frame holding whichever of x / p / y exist so far. */
function frame(opts: { x?: number; p?: boolean; y?: number }): StackFrame {
  const vars: Cell[] = [];
  if (opts.x !== undefined) vars.push(intCell('x', 'x', opts.x, ADDR.x));
  if (opts.p) {
    vars.push({
      kind: 'pointer',
      id: 'p',
      name: 'p',
      type: 'int *',
      target: 'x',
      display: ADDR.x,
      address: ADDR.p,
    });
  }
  if (opts.y !== undefined) vars.push(intCell('y', 'y', opts.y, ADDR.y));
  return { id: 'main', name: 'main', callId: 0, address: '0x7ffd0000', variables: vars };
}

const steps: Step[] = [
  {
    id: 'start',
    index: 0,
    narration: 'main begins.',
    highlightedLines: [4],
    stack: [frame({})],
    heap: [],
    activeId: 'main',
  },
  {
    id: 'decl-x',
    index: 1,
    narration: 'Declare int x = 5. It lives at address 0x7ffd0010.',
    highlightedLines: [5],
    stack: [frame({ x: 5 })],
    heap: [],
    activeId: 'x',
  },
  {
    id: 'addr-of',
    index: 2,
    narration:
      'int *p = &x makes p hold the address of x (0x7ffd0010). The azure arrow points from p to x.',
    highlightedLines: [6],
    stack: [frame({ x: 5, p: true })],
    heap: [],
    activeId: 'p',
  },
  {
    id: 'deref-read',
    index: 3,
    narration:
      '*p dereferences p: it reads the value at the address p holds — x, which is 5 — and copies it into y.',
    highlightedLines: [7],
    stack: [frame({ x: 5, p: true, y: 5 })],
    heap: [],
    activeId: 'y',
  },
  {
    id: 'write-through',
    index: 4,
    narration:
      '*p = 99 writes through the pointer to its target. x pulses to 99 — p and y are unchanged. Writing through a pointer changes the target, not the pointer.',
    highlightedLines: [8],
    stack: [frame({ x: 99, p: true, y: 5 })],
    heap: [],
    activeId: 'x',
  },
  {
    id: 'print',
    index: 5,
    narration: 'Print x and y: x is now 99, but y kept the 5 it copied earlier.',
    highlightedLines: [9],
    stack: [frame({ x: 99, p: true, y: 5 })],
    heap: [],
    activeId: 'x',
    stdout: ['x=99 y=5'],
  },
  {
    id: 'return',
    index: 6,
    narration: 'main returns 0 and the program ends.',
    highlightedLines: [10],
    stack: [frame({ x: 99, p: true, y: 5 })],
    heap: [],
    activeId: 'main',
    stdout: ['x=99 y=5'],
  },
];

export const pointerBasicsTrace: Trace = {
  id: 'se200-pointer-basics',
  title: 'Pointer basics — &x, *p, write-through',
  course: 'SE 200',
  topic: 'Pointers, Arrays and Strings',
  file: 'pointers.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE200: Pointers, Arrays and Strings'],
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: pointerBasicsTrace,
  label: 'Pointer basics',
  summary: '&x, dereference, and writing through a pointer (pulses the target).',
  order: 50,
};
export default contentModule;
