/**
 * SE 200 · argc, argv (week 7) — the shape of the argument vector.
 *
 * For the command line `./prog hello 42` the C runtime hands `main` two values:
 *   - `argc` — an `int` count of the arguments, INCLUDING the program name (here 3).
 *   - `argv` — an array of `char *` (a pointer to pointers to char). Each element points into a
 *     separate NUL-terminated char buffer; the element at index `argc` is `NULL`, marking the end.
 *
 * The lesson is the two-hop indirection drawn with arrows:
 *   argv[i]  (a pointer slot)  →  the argument string  →  its chars, ending in '\0'.
 *
 * Hand-traced for `./prog hello 42`:
 *   argc = 3
 *   argv[0] -> "./prog"  = '.','/','p','r','o','g','\0'   (6 chars + NUL = 7 bytes)
 *   argv[1] -> "hello"   = 'h','e','l','l','o','\0'        (5 chars + NUL = 6 bytes)
 *   argv[2] -> "42"      = '4','2','\0'                    (2 chars + NUL = 3 bytes)
 *   argv[3] == argv[argc] == NULL                          (terminator, holds no address)
 * Note: argv[2] is the STRING "42" (the chars '4','2'), never the integer 42.
 */
import type {
  ArrayCell,
  Cell,
  PointerCell,
  ScalarCell,
  StackFrame,
  Step,
  Trace,
} from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

const SOURCE = `#include <stdio.h>

int main(int argc, char *argv[])
{
    /* run as:  ./prog hello 42   ->   argc = 3 */
    return 0;
}
`;

const ARGV_BASE = 0x7ffeefe80; // the array of char* (8 bytes per pointer)
const ARG0_BASE = 0x7ffeeff00; // "./prog"
const ARG1_BASE = 0x7ffeeff10; // "hello"
const ARG2_BASE = 0x7ffeeff20; // "42"

function toHex(n: number): string {
  return '0x' + n.toString(16);
}

/** A NUL-terminated char buffer as an `ArrayCell` of `char` scalars at ascending 1-byte addresses. */
function charBuffer(id: string, base: number, text: string): ArrayCell {
  const chars = [...text].map((c) => `'${c}'`);
  chars.push("'\\0'");
  const elements: ScalarCell[] = chars.map((v, i) => ({
    kind: 'scalar',
    id: `${id}.${i}`,
    name: '',
    type: 'char',
    value: v,
    address: toHex(base + i),
  }));
  return {
    kind: 'array',
    id,
    name: id,
    type: `char[${elements.length}]`,
    address: toHex(base),
    elements,
  };
}

/** One `char *` slot of the argv array; `target === null` for the NULL terminator entry. */
function argvSlot(i: number, target: string | null): PointerCell {
  return {
    kind: 'pointer',
    id: `argv.${i}`,
    name: '',
    type: 'char *',
    target,
    display: target === null ? null : toHex([ARG0_BASE, ARG1_BASE, ARG2_BASE][i]),
    address: toHex(ARGV_BASE + i * 8),
  };
}

/** The argv vector: an array of four `char *` — three args plus the NULL terminator. */
function argvArray(): ArrayCell {
  return {
    kind: 'array',
    id: 'argv',
    name: 'argv',
    type: 'char *[]',
    address: toHex(ARGV_BASE),
    elements: [
      argvSlot(0, 'arg0.0'),
      argvSlot(1, 'arg1.0'),
      argvSlot(2, 'arg2.0'),
      argvSlot(3, null),
    ],
  };
}

/** main(argc, argv): the count, the pointer array, and the three argument buffers. */
function mainFrame(): StackFrame {
  const vars: Cell[] = [
    { kind: 'scalar', id: 'argc', name: 'argc', type: 'int', value: 3, address: '0x7ffeefe78' },
    argvArray(),
    charBuffer('arg0', ARG0_BASE, './prog'),
    charBuffer('arg1', ARG1_BASE, 'hello'),
    charBuffer('arg2', ARG2_BASE, '42'),
  ];
  return { id: 'main', name: 'main', callId: 0, address: '0x7ffeefe70', variables: vars };
}

// Memory is identical in every step here — only the focal element moves — so reuse one snapshot.
const MEM = (): StackFrame[] => [mainFrame()];

const steps: Step[] = [
  {
    id: 'enter',
    index: 0,
    narration:
      'Run as `./prog hello 42`. Before main runs, the C runtime fills in argc and argv from the command line, then calls main(argc, argv).',
    highlightedLines: [3],
    stack: MEM(),
    heap: [],
    activeId: 'main',
  },
  {
    id: 'argc',
    index: 1,
    narration:
      'argc is an int: the number of command-line arguments, counting the program name. `./prog hello 42` is three tokens, so argc = 3.',
    highlightedLines: [3],
    stack: MEM(),
    heap: [],
    activeId: 'argc',
  },
  {
    id: 'argv0',
    index: 2,
    narration:
      'argv is an array of char* (a pointer to pointers to char). Each slot holds the address of a string. argv[0] points at "./prog", the program name — its arrow lands on the first char of that buffer.',
    highlightedLines: [3],
    stack: MEM(),
    heap: [],
    activeId: 'argv.0',
  },
  {
    id: 'argv1',
    index: 3,
    narration: 'argv[1] points at the first real argument, the string "hello".',
    highlightedLines: [3],
    stack: MEM(),
    heap: [],
    activeId: 'argv.1',
  },
  {
    id: 'argv2',
    index: 4,
    narration:
      'argv[2] points at "42" — but this is the STRING "42" (the chars \'4\',\'2\'), not the integer 42. Arguments are always text; you would need atoi/strtol to turn it into a number.',
    highlightedLines: [3],
    stack: MEM(),
    heap: [],
    activeId: 'argv.2',
  },
  {
    id: 'nul-in-str',
    index: 5,
    narration:
      'Every argument string is NUL-terminated. "42" is stored as \'4\',\'2\',\'\\0\'; the trailing \'\\0\' (dashed) is what lets printf and strlen know where the string ends.',
    highlightedLines: [3],
    stack: MEM(),
    heap: [],
    activeId: 'arg2.2',
  },
  {
    id: 'null-term',
    index: 6,
    narration:
      'argv[argc] — here argv[3] — is NULL. It holds no address (no arrow leaves it) and marks the end of the vector, so code can walk argv until it hits NULL even without argc.',
    highlightedLines: [3],
    stack: MEM(),
    heap: [],
    activeId: 'argv.3',
  },
  {
    id: 'return',
    index: 7,
    narration: 'main returns 0 and the program ends.',
    highlightedLines: [6],
    stack: MEM(),
    heap: [],
    activeId: 'main',
  },
];

export const argvStructureTrace: Trace = {
  id: 'se200-argv-structure',
  title: 'argc / argv — the shape of the argument vector',
  course: 'SE 200',
  topic: 'argc, argv',
  file: 'argv.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE200: argc, argv'],
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: argvStructureTrace,
  label: 'argc / argv structure',
  summary: 'argv is an array of char* into NUL-terminated strings, ending in a NULL slot.',
  order: 100,
};
export default contentModule;
