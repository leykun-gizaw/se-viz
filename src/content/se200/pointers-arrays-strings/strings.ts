/**
 * SE 200 · Pointers, Arrays and Strings (week 3) — strings.
 *
 * A C string is a `char` array ending in a NUL terminator `'\0'`. `char s[3] = "hi"` stores three
 * bytes — `'h'`, `'i'`, `'\0'` — at consecutive addresses (chars are 1 byte, so they ascend by 1).
 * `printf("%s", s)` reads characters starting at `s` and stops at the terminator, printing "hi".
 *
 * Hand-traced bytes: s[0]='h'@0x7000, s[1]='i'@0x7001, s[2]='\0'@0x7002. Output: "hi".
 */
import type {
  ArrayCell,
  ScalarCell,
  StackFrame,
  Step,
  Trace,
} from '../../../engine/trace/types.ts';

const SOURCE = `#include <stdio.h>

int main(void)
{
    char s[3] = "hi";
    printf("%s\\n", s);
    return 0;
}
`;

// Char display literals; '\0' is the NUL terminator (rendered with the dashed/muted treatment).
const CHARS: ScalarCell['value'][] = ["'h'", "'i'", "'\\0'"];
const BASE = 0x7000;

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
    type: 'char[3]',
    address: '0x' + BASE.toString(16),
    elements,
  };
}

function frame(): StackFrame {
  return { id: 'main', name: 'main', callId: 0, address: '0x7ffd0000', variables: [sCell()] };
}

const steps: Step[] = [
  {
    id: 'start',
    index: 0,
    narration: 'main begins.',
    highlightedLines: [3],
    stack: [frame()],
    heap: [],
    activeId: 'main',
  },
  {
    id: 'declare',
    index: 1,
    narration:
      "char s[3] = \"hi\" stores three bytes: 'h', 'i', and the NUL terminator '\\0' that marks the end of the string. Chars are 1 byte, so addresses ascend by 1.",
    highlightedLines: [5],
    stack: [frame()],
    heap: [],
    activeId: 's.0',
  },
  {
    id: 'print',
    index: 2,
    narration:
      "printf(\"%s\") reads characters from s — 'h', then 'i' — and stops at the '\\0' at index 2, printing \"hi\".",
    highlightedLines: [6],
    stack: [frame()],
    heap: [],
    activeId: 's.2',
    stdout: ['hi'],
  },
  {
    id: 'return',
    index: 3,
    narration: 'main returns 0 and the program ends.',
    highlightedLines: [7],
    stack: [frame()],
    heap: [],
    activeId: 'main',
    stdout: ['hi'],
  },
];

export const stringsTrace: Trace = {
  id: 'se200-strings',
  title: 'Strings — a char array ending in \\0',
  course: 'SE 200',
  topic: 'Pointers, Arrays and Strings',
  file: 'strings.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE200: Pointers, Arrays and Strings'],
};
