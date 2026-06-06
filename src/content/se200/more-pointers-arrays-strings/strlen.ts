/**
 * SE 200 · More Pointers, Arrays and Strings (week 4) — walking a buffer with a pointer.
 *
 * A hand-written `my_strlen` marches a pointer `p` along a string, counting characters until the
 * NUL terminator. Each `p = p + 1` advances by `sizeof(char) = 1` byte and the azure arrow glides
 * to the next element; `len` pulses each pass; the loop condition `*p != '\0'` is shown as a chip
 * and the walk stops exactly at `'\0'`.
 *
 * Hand-traced ("cat" = 'c','a','t','\0' at 0x8000..0x8003): counts 'c','a','t' ⇒ len = 3.
 */
import type {
  ArrayCell,
  ScalarCell,
  StackFrame,
  Step,
  Trace,
} from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

const SOURCE = `#include <stdio.h>

int my_strlen(const char *p)
{
    int len = 0;
    while (*p != '\\0') {
        len = len + 1;
        p = p + 1;
    }
    return len;
}

int main(void)
{
    char s[4] = "cat";
    int n = my_strlen(s);
    printf("%d\\n", n);
    return 0;
}
`;

const CHARS: ScalarCell['value'][] = ["'c'", "'a'", "'t'", "'\\0'"];
const BASE = 0x8000;

function sCell(): ArrayCell {
  const elements: ScalarCell[] = CHARS.map((v, i) => ({
    kind: 'scalar',
    id: `s.${i}`,
    name: '',
    type: 'char',
    value: v,
    address: '0x' + (BASE + i).toString(16),
  }));
  return {
    kind: 'array',
    id: 's',
    name: 's',
    type: 'char[4]',
    address: '0x' + BASE.toString(16),
    elements,
  };
}

function mainFrame(opts: { n?: number }): StackFrame {
  const vars: (ArrayCell | ScalarCell)[] = [sCell()];
  if (opts.n !== undefined)
    vars.push({
      kind: 'scalar',
      id: 'n',
      name: 'n',
      type: 'int',
      value: opts.n,
      address: '0x7ffd0010',
    });
  return { id: 'main', name: 'main', callId: 0, address: '0x7ffd0000', variables: vars };
}

/** my_strlen() frame: p walks s[pIdx]; len counts. */
function strlenFrame(pIdx: number, len: number | null): StackFrame {
  return {
    id: 'strlen',
    name: 'my_strlen',
    callId: 0,
    address: '0x7ffd0fd0',
    variables: [
      {
        kind: 'pointer',
        id: 'p',
        name: 'p',
        type: 'const char *',
        target: `s.${pIdx}`,
        display: '0x' + (BASE + pIdx).toString(16),
        address: '0x7ffd0fd0',
      },
      { kind: 'scalar', id: 'len', name: 'len', type: 'int', value: len, address: '0x7ffd0fd8' },
    ],
  };
}

const COND = { expr: "*p != '\\0'" };

const steps: Step[] = [
  {
    id: 'start',
    index: 0,
    narration: 'main begins.',
    highlightedLines: [13],
    stack: [mainFrame({})],
    heap: [],
    activeId: 'main',
  },
  {
    id: 'decl-s',
    index: 1,
    narration: "char s[4] = \"cat\" stores 'c','a','t','\\0' at 0x8000..0x8003.",
    highlightedLines: [15],
    stack: [mainFrame({})],
    heap: [],
    activeId: 's.0',
  },
  {
    id: 'call',
    index: 2,
    narration:
      'my_strlen(s): the array name s decays to a pointer to its first element, so p starts at s[0] (0x8000).',
    highlightedLines: [16, 3],
    stack: [mainFrame({}), strlenFrame(0, null)],
    heap: [],
    activeId: 'strlen',
  },
  {
    id: 'len-0',
    index: 3,
    narration: 'len = 0.',
    highlightedLines: [5],
    stack: [mainFrame({}), strlenFrame(0, 0)],
    heap: [],
    activeId: 'len',
  },
  {
    id: 'check-c',
    index: 4,
    narration: "*p is 'c' — not the terminator — so run the body.",
    highlightedLines: [6],
    stack: [mainFrame({}), strlenFrame(0, 0)],
    heap: [],
    activeId: 's.0',
    condition: { ...COND, result: true },
  },
  {
    id: 'len-1',
    index: 5,
    narration: 'len = len + 1 = 1.',
    highlightedLines: [7],
    stack: [mainFrame({}), strlenFrame(0, 1)],
    heap: [],
    activeId: 'len',
  },
  {
    id: 'adv-1',
    index: 6,
    narration:
      'p = p + 1 advances by sizeof(char) = 1 byte to s[1] (0x8001). The arrow glides over.',
    highlightedLines: [8],
    stack: [mainFrame({}), strlenFrame(1, 1)],
    heap: [],
    activeId: 's.1',
  },
  {
    id: 'check-a',
    index: 7,
    narration: "*p is 'a' — keep going.",
    highlightedLines: [6],
    stack: [mainFrame({}), strlenFrame(1, 1)],
    heap: [],
    activeId: 's.1',
    condition: { ...COND, result: true },
  },
  {
    id: 'len-2',
    index: 8,
    narration: 'len = 2.',
    highlightedLines: [7],
    stack: [mainFrame({}), strlenFrame(1, 2)],
    heap: [],
    activeId: 'len',
  },
  {
    id: 'adv-2',
    index: 9,
    narration: 'p advances to s[2] (0x8002).',
    highlightedLines: [8],
    stack: [mainFrame({}), strlenFrame(2, 2)],
    heap: [],
    activeId: 's.2',
  },
  {
    id: 'check-t',
    index: 10,
    narration: "*p is 't' — keep going.",
    highlightedLines: [6],
    stack: [mainFrame({}), strlenFrame(2, 2)],
    heap: [],
    activeId: 's.2',
    condition: { ...COND, result: true },
  },
  {
    id: 'len-3',
    index: 11,
    narration: 'len = 3.',
    highlightedLines: [7],
    stack: [mainFrame({}), strlenFrame(2, 3)],
    heap: [],
    activeId: 'len',
  },
  {
    id: 'adv-3',
    index: 12,
    narration: 'p advances to s[3] (0x8003) — the NUL terminator.',
    highlightedLines: [8],
    stack: [mainFrame({}), strlenFrame(3, 3)],
    heap: [],
    activeId: 's.3',
  },
  {
    id: 'check-nul',
    index: 13,
    narration:
      "*p is now '\\0' — the condition is false, so the loop stops. The terminator is not counted.",
    highlightedLines: [6],
    stack: [mainFrame({}), strlenFrame(3, 3)],
    heap: [],
    activeId: 's.3',
    condition: { ...COND, result: false },
  },
  {
    id: 'return-len',
    index: 14,
    narration: 'Return len = 3.',
    highlightedLines: [10],
    stack: [mainFrame({}), strlenFrame(3, 3)],
    heap: [],
    activeId: 'len',
  },
  {
    id: 'assign-n',
    index: 15,
    narration: 'my_strlen returns 3, stored in n.',
    highlightedLines: [16],
    stack: [mainFrame({ n: 3 })],
    heap: [],
    activeId: 'n',
  },
  {
    id: 'print',
    index: 16,
    narration: 'Print n: "3".',
    highlightedLines: [17],
    stack: [mainFrame({ n: 3 })],
    heap: [],
    activeId: 'n',
    stdout: ['3'],
  },
  {
    id: 'return',
    index: 17,
    narration: 'main returns 0 and the program ends.',
    highlightedLines: [18],
    stack: [mainFrame({ n: 3 })],
    heap: [],
    activeId: 'main',
    stdout: ['3'],
  },
];

export const strlenTrace: Trace = {
  id: 'se200-strlen',
  title: 'Walking a string — my_strlen',
  course: 'SE 200',
  topic: 'More Pointers, Arrays and Strings',
  file: 'strlen.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE200: More Pointers, Arrays and Strings'],
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: strlenTrace,
  label: 'Walking a string (strlen)',
  summary: 'A pointer marches to the \\0, arrow gliding, counter pulsing.',
  order: 61,
};
export default contentModule;
