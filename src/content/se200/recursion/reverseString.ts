/**
 * SE 200 · Recursion (week 5) — recursion over data: print a string in reverse.
 *
 * Recursion isn't only numeric. `reverse` narrows its parameter each call (`s + 1`, pointing one
 * char further along) until the base case — the NUL terminator. The key insight: `putchar(*s)` runs
 * **after** the recursive call returns, so the characters print on the way *back up* the stack — in
 * reverse order. This "work on the unwind" is what recursion-over-data is all about.
 *
 * Hand-traced ("cat" = 'c','a','t','\0' @0xc000..0xc003): the stack builds to '\0', then prints
 * 't', 'a', 'c' as it unwinds → output "tac".
 */
import type {
  ArrayCell,
  PointerCell,
  ScalarCell,
  StackFrame,
  Step,
  Trace,
} from '../../../engine/trace/types.ts';

const SOURCE = `#include <stdio.h>

void reverse(const char *s) {
    if (*s == '\\0')
        return;
    reverse(s + 1);
    putchar(*s);
}

int main(void) {
    char s[4] = "cat";
    reverse(s);
    putchar('\\n');
    return 0;
}
`;

const CHARS: ScalarCell['value'][] = ["'c'", "'a'", "'t'", "'\\0'"];
const S_BASE = 0xc000;
// reverse frame addresses by recursion depth (1..4); the stack grows downward.
const REV_ADDR = ['', '0x7ffd0fd0', '0x7ffd0fa0', '0x7ffd0f70', '0x7ffd0f40'];

function sCell(): ArrayCell {
  const elements: ScalarCell[] = CHARS.map((v, i) => ({
    kind: 'scalar',
    id: `s.${i}`,
    name: '',
    type: 'char',
    value: v,
    address: '0x' + (S_BASE + i).toString(16),
  }));
  return {
    kind: 'array',
    id: 's',
    name: 's',
    type: 'char[4]',
    address: '0x' + S_BASE.toString(16),
    elements,
  };
}

function mainFrame(): StackFrame {
  return { id: 'main', name: 'main', callId: 0, address: '0x7ffd0000', variables: [sCell()] };
}

/** A `reverse` activation `k` (0..3): its `s` parameter points at `s[k]`. Depth = k + 1. */
function revFrame(k: number): StackFrame {
  const s: PointerCell = {
    kind: 'pointer',
    id: `rev${k}.s`,
    name: 's',
    type: 'const char *',
    target: `s.${k}`,
    display: '0x' + (S_BASE + k).toString(16),
    address: REV_ADDR[k + 1],
  };
  return { id: `rev${k}`, name: 'reverse', callId: k, address: REV_ADDR[k + 1], variables: [s] };
}

const COND = { expr: "*s == '\\0'" };

const steps: Step[] = [
  {
    id: 'start',
    index: 0,
    narration: 'main begins.',
    highlightedLines: [10],
    stack: [mainFrame()],
    heap: [],
    activeId: 'main',
  },
  {
    id: 'decl-s',
    index: 1,
    narration: "char s[4] = \"cat\" — the bytes 'c','a','t','\\0'.",
    highlightedLines: [11],
    stack: [mainFrame()],
    heap: [],
    activeId: 's.0',
  },
  {
    id: 'call-0',
    index: 2,
    narration: "reverse(s): the parameter s points at the first char, 'c'.",
    highlightedLines: [12, 3],
    stack: [mainFrame(), revFrame(0)],
    heap: [],
    activeId: 'rev0',
  },
  {
    id: 'test-0',
    index: 3,
    narration:
      "*s is 'c', not the terminator — so reverse recurses on s + 1. The putchar will only run after that call returns.",
    highlightedLines: [4],
    stack: [mainFrame(), revFrame(0)],
    heap: [],
    activeId: 's.0',
    condition: { ...COND, result: false },
  },
  {
    id: 'recurse-0',
    index: 4,
    narration: "reverse(s + 1): a new frame whose s points at 'a'.",
    highlightedLines: [6, 3],
    stack: [mainFrame(), revFrame(0), revFrame(1)],
    heap: [],
    activeId: 'rev1',
  },
  {
    id: 'test-1',
    index: 5,
    narration: "*s is 'a' — recurse again.",
    highlightedLines: [4],
    stack: [mainFrame(), revFrame(0), revFrame(1)],
    heap: [],
    activeId: 's.1',
    condition: { ...COND, result: false },
  },
  {
    id: 'recurse-1',
    index: 6,
    narration: "reverse(s + 1): a new frame whose s points at 't'.",
    highlightedLines: [6, 3],
    stack: [mainFrame(), revFrame(0), revFrame(1), revFrame(2)],
    heap: [],
    activeId: 'rev2',
  },
  {
    id: 'test-2',
    index: 7,
    narration: "*s is 't' — recurse one more time.",
    highlightedLines: [4],
    stack: [mainFrame(), revFrame(0), revFrame(1), revFrame(2)],
    heap: [],
    activeId: 's.2',
    condition: { ...COND, result: false },
  },
  {
    id: 'recurse-2',
    index: 8,
    narration: 'reverse(s + 1): s now points at the NUL terminator.',
    highlightedLines: [6, 3],
    stack: [mainFrame(), revFrame(0), revFrame(1), revFrame(2), revFrame(3)],
    heap: [],
    activeId: 'rev3',
  },
  {
    id: 'base-case',
    index: 9,
    narration:
      "*s is '\\0' — the base case. This deepest call returns immediately, printing nothing.",
    highlightedLines: [4],
    stack: [mainFrame(), revFrame(0), revFrame(1), revFrame(2), revFrame(3)],
    heap: [],
    activeId: 's.3',
    condition: { ...COND, result: true },
  },
  {
    id: 'unwind',
    index: 10,
    narration:
      'The base frame returns. Now each frame resumes after its recursive call and runs putchar — so the chars print in reverse.',
    highlightedLines: [5],
    stack: [mainFrame(), revFrame(0), revFrame(1), revFrame(2)],
    heap: [],
    activeId: 'rev2',
  },
  {
    id: 'print-t',
    index: 11,
    narration: "Back where s points at 't': putchar('t') prints 't'.",
    highlightedLines: [7],
    stack: [mainFrame(), revFrame(0), revFrame(1), revFrame(2)],
    heap: [],
    activeId: 's.2',
    stdout: ['t'],
  },
  {
    id: 'print-a',
    index: 12,
    narration: "That frame returns; the next prints 'a'.",
    highlightedLines: [7],
    stack: [mainFrame(), revFrame(0), revFrame(1)],
    heap: [],
    activeId: 's.1',
    stdout: ['ta'],
  },
  {
    id: 'print-c',
    index: 13,
    narration: 'Then \'c\' prints. The output so far is "tac" — the string reversed.',
    highlightedLines: [7],
    stack: [mainFrame(), revFrame(0)],
    heap: [],
    activeId: 's.0',
    stdout: ['tac'],
  },
  {
    id: 'newline',
    index: 14,
    narration: 'All reverse frames have returned; main prints a newline.',
    highlightedLines: [13],
    stack: [mainFrame()],
    heap: [],
    activeId: 'main',
    stdout: ['tac'],
  },
  {
    id: 'return',
    index: 15,
    narration: 'main returns 0 and the program ends.',
    highlightedLines: [14],
    stack: [mainFrame()],
    heap: [],
    activeId: 'main',
    stdout: ['tac'],
  },
];

export const reverseStringTrace: Trace = {
  id: 'se200-reverse-string',
  title: 'reverse a string — recursion over data',
  course: 'SE 200',
  topic: 'Recursion',
  file: 'reverse.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE200: Recursion'],
};
