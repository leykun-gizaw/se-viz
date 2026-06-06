/**
 * SE 200 · Even More Pointers, Arrays and Strings (week 4) — pointer to pointer.
 *
 * `int **pp = &p;` creates double indirection, drawn as a two-hop arrow chain `pp → p → x`.
 * Dereferencing once (`*pp`) yields `p` (a pointer); dereferencing twice (`**pp`) follows the chain
 * all the way to `x`.
 *
 * Hand-traced: x=42 @0x9010; p=&x holds 0x9010 @0x9018; pp=&p holds 0x9018 @0x9020.
 *   *pp  = p  (the pointer)         **pp = *p = x = 42.
 */
import type {
  Cell,
  PointerCell,
  ScalarCell,
  StackFrame,
  Step,
  Trace,
} from '../../../engine/trace/types.ts';

const SOURCE = `#include <stdio.h>

int main(void)
{
    int x = 42;
    int *p = &x;
    int **pp = &p;
    printf("%d\\n", **pp);
    return 0;
}
`;

const ADDR = { x: '0x9010', p: '0x9018', pp: '0x9020' } as const;

function xCell(): ScalarCell {
  return { kind: 'scalar', id: 'x', name: 'x', type: 'int', value: 42, address: ADDR.x };
}
function pCell(): PointerCell {
  return {
    kind: 'pointer',
    id: 'p',
    name: 'p',
    type: 'int *',
    target: 'x',
    display: ADDR.x,
    address: ADDR.p,
  };
}
function ppCell(): PointerCell {
  return {
    kind: 'pointer',
    id: 'pp',
    name: 'pp',
    type: 'int **',
    target: 'p',
    display: ADDR.p,
    address: ADDR.pp,
  };
}

function frame(opts: { p?: boolean; pp?: boolean }): StackFrame {
  const vars: Cell[] = [xCell()];
  if (opts.p) vars.push(pCell());
  if (opts.pp) vars.push(ppCell());
  return { id: 'main', name: 'main', callId: 0, address: '0x9000', variables: vars };
}

const steps: Step[] = [
  {
    id: 'start',
    index: 0,
    narration: 'main begins.',
    highlightedLines: [3],
    stack: [frame({})],
    heap: [],
    activeId: 'main',
  },
  {
    id: 'decl-x',
    index: 1,
    narration: 'int x = 42, at address 0x9010.',
    highlightedLines: [5],
    stack: [frame({})],
    heap: [],
    activeId: 'x',
  },
  {
    id: 'decl-p',
    index: 2,
    narration: 'int *p = &x: p holds 0x9010 and points to x.',
    highlightedLines: [6],
    stack: [frame({ p: true })],
    heap: [],
    activeId: 'p',
  },
  {
    id: 'decl-pp',
    index: 3,
    narration:
      'int **pp = &p: pp holds the address of p (0x9018). Now there are two hops — pp → p → x.',
    highlightedLines: [7],
    stack: [frame({ p: true, pp: true })],
    heap: [],
    activeId: 'pp',
  },
  {
    id: 'deref-once',
    index: 4,
    narration:
      '*pp dereferences once: it follows the first arrow to p, which is itself a pointer to x.',
    highlightedLines: [8],
    stack: [frame({ p: true, pp: true })],
    heap: [],
    activeId: 'p',
  },
  {
    id: 'deref-twice',
    index: 5,
    narration: '**pp dereferences twice: *pp is p, and *p is x — so **pp is 42.',
    highlightedLines: [8],
    stack: [frame({ p: true, pp: true })],
    heap: [],
    activeId: 'x',
    stdout: ['42'],
  },
  {
    id: 'return',
    index: 6,
    narration: 'main returns 0 and the program ends.',
    highlightedLines: [9],
    stack: [frame({ p: true, pp: true })],
    heap: [],
    activeId: 'main',
    stdout: ['42'],
  },
];

export const pointerToPointerTrace: Trace = {
  id: 'se200-pointer-to-pointer',
  title: 'Pointer to pointer — pp → p → x',
  course: 'SE 200',
  topic: 'Even More Pointers, Arrays and Strings',
  file: 'ptrptr.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE200: Even More Pointers, Arrays and Strings'],
};
