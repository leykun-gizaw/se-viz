/**
 * SE 200 · argc, argv (week 7) — iterating the argument vector.
 *
 * The idiomatic loop `for (i = 0; i < argc; i++) printf("%s\n", argv[i]);` walks the array of
 * `char *`: each pass dereferences one slot (argv[i]) to its string and prints it. The active slot
 * and its target string are highlighted each pass, and the loop test `i < argc` is shown as a
 * condition chip — true while i is 0..argc-1, false at i == argc, which stops the loop.
 *
 * Hand-traced for `./prog hello 42` (argc = 3). The loop runs for i = 0, 1, 2 and printf with
 * "%s\n" emits each string followed by a newline:
 *
 *   i=0:  i < argc -> 0 < 3 -> true,  print argv[0] = "./prog"
 *   i=1:  i < argc -> 1 < 3 -> true,  print argv[1] = "hello"
 *   i=2:  i < argc -> 2 < 3 -> true,  print argv[2] = "42"
 *   i=3:  i < argc -> 3 < 3 -> false, loop ends
 *
 * Console output (three lines):
 *   ./prog
 *   hello
 *   42
 * argv[2] prints the STRING "42" (chars '4','2'), not the integer 42.
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
    for (int i = 0; i < argc; i++)
    {
        printf("%s\\n", argv[i]);
    }
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

/** main(argc, argv) plus the loop counter `i` (absent until the for-loop declares it). */
function mainFrame(i: number | 'absent'): StackFrame {
  const vars: Cell[] = [
    { kind: 'scalar', id: 'argc', name: 'argc', type: 'int', value: 3, address: '0x7ffeefe78' },
    argvArray(),
    charBuffer('arg0', ARG0_BASE, './prog'),
    charBuffer('arg1', ARG1_BASE, 'hello'),
    charBuffer('arg2', ARG2_BASE, '42'),
  ];
  if (i !== 'absent') {
    vars.push({ kind: 'scalar', id: 'i', name: 'i', type: 'int', value: i, address: '0x7ffeefe74' });
  }
  return { id: 'main', name: 'main', callId: 0, address: '0x7ffeefe70', variables: vars };
}

const COND = { expr: 'i < argc' };

const steps: Step[] = [
  {
    id: 'enter',
    index: 0,
    narration:
      'Run as `./prog hello 42`, so argc = 3 and argv holds three strings plus a NULL terminator. We will print each argument.',
    highlightedLines: [3],
    stack: [mainFrame('absent')],
    heap: [],
    activeId: 'main',
  },
  {
    id: 'init',
    index: 1,
    narration: 'The for loop declares i = 0 — the index of the first slot, argv[0].',
    highlightedLines: [5],
    stack: [mainFrame(0)],
    heap: [],
    activeId: 'i',
  },
  {
    id: 'test-0',
    index: 2,
    narration: 'Loop test: i < argc is 0 < 3, which is true — so the body runs for argv[0].',
    highlightedLines: [5],
    stack: [mainFrame(0)],
    heap: [],
    activeId: 'argv.0',
    condition: { ...COND, result: true },
  },
  {
    id: 'print-0',
    index: 3,
    narration:
      'printf("%s\\n", argv[0]) follows argv[0] to its string and prints "./prog" then a newline.',
    highlightedLines: [7],
    stack: [mainFrame(0)],
    heap: [],
    activeId: 'argv.0',
    stdout: ['./prog'],
  },
  {
    id: 'incr-1',
    index: 4,
    narration: 'i++ advances the index to 1.',
    highlightedLines: [5],
    stack: [mainFrame(1)],
    heap: [],
    activeId: 'i',
    stdout: ['./prog'],
  },
  {
    id: 'test-1',
    index: 5,
    narration: 'i < argc is 1 < 3, true — run the body for argv[1].',
    highlightedLines: [5],
    stack: [mainFrame(1)],
    heap: [],
    activeId: 'argv.1',
    condition: { ...COND, result: true },
  },
  {
    id: 'print-1',
    index: 6,
    narration: 'printf prints argv[1] = "hello" and a newline.',
    highlightedLines: [7],
    stack: [mainFrame(1)],
    heap: [],
    activeId: 'argv.1',
    stdout: ['./prog', 'hello'],
  },
  {
    id: 'incr-2',
    index: 7,
    narration: 'i++ advances the index to 2.',
    highlightedLines: [5],
    stack: [mainFrame(2)],
    heap: [],
    activeId: 'i',
    stdout: ['./prog', 'hello'],
  },
  {
    id: 'test-2',
    index: 8,
    narration: 'i < argc is 2 < 3, true — run the body for argv[2].',
    highlightedLines: [5],
    stack: [mainFrame(2)],
    heap: [],
    activeId: 'argv.2',
    condition: { ...COND, result: true },
  },
  {
    id: 'print-2',
    index: 9,
    narration:
      'printf prints argv[2] = "42". Even though it looks numeric, it is the string \'4\',\'2\',\'\\0\' — printed as text, not the number 42.',
    highlightedLines: [7],
    stack: [mainFrame(2)],
    heap: [],
    activeId: 'argv.2',
    stdout: ['./prog', 'hello', '42'],
  },
  {
    id: 'incr-3',
    index: 10,
    narration: 'i++ advances the index to 3.',
    highlightedLines: [5],
    stack: [mainFrame(3)],
    heap: [],
    activeId: 'i',
    stdout: ['./prog', 'hello', '42'],
  },
  {
    id: 'test-3',
    index: 11,
    narration:
      'i < argc is now 3 < 3, which is false. i has reached argc (the NULL slot argv[3]), so the loop stops.',
    highlightedLines: [5],
    stack: [mainFrame(3)],
    heap: [],
    activeId: 'i',
    condition: { ...COND, result: false },
  },
  {
    id: 'return',
    index: 12,
    narration: 'main returns 0. All three arguments were printed, one per line.',
    highlightedLines: [9],
    stack: [mainFrame(3)],
    heap: [],
    activeId: 'main',
    stdout: ['./prog', 'hello', '42'],
  },
];

export const argvIterateTrace: Trace = {
  id: 'se200-argv-iterate',
  title: 'argv iteration — printing every argument',
  course: 'SE 200',
  topic: 'argc, argv',
  file: 'args.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE200: argc, argv'],
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: argvIterateTrace,
  label: 'argv iteration',
  summary: 'A for loop walks argv[0..argc-1], printing each argument string.',
  order: 101,
};
export default contentModule;
