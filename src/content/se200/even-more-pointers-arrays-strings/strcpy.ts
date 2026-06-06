/**
 * SE 200 · Even More Pointers, Arrays and Strings (week 4) — strcpy, two advancing pointers.
 *
 * A hand-written `my_strcpy` copies a string one char at a time using two pointers that march in
 * lockstep: `src` reads, `dst` writes, both `+ 1` each pass (the arrows glide together). The loop
 * stops at the source terminator, then the `'\0'` is copied last so the destination is a complete,
 * properly-terminated string.
 *
 * Hand-traced (src = "hi" = 'h','i','\0' @0xa000..0xa002; dst @0xb000..0xb002, initially garbage):
 *   copy 'h'→dst[0], 'i'→dst[1], then '\0'→dst[2]. Result: dst = "hi".
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

void my_strcpy(char *dst, const char *src)
{
    while (*src != '\\0') {
        *dst = *src;
        dst = dst + 1;
        src = src + 1;
    }
    *dst = '\\0';
}

int main(void)
{
    char src[3] = "hi";
    char dst[3];
    my_strcpy(dst, src);
    printf("%s\\n", dst);
    return 0;
}
`;

const SRC_CHARS: ScalarCell['value'][] = ["'h'", "'i'", "'\\0'"];
const SRC_BASE = 0xa000;
const DST_BASE = 0xb000;

function charArray(
  id: string,
  base: number,
  values: ScalarCell['value'][],
  type: string,
): ArrayCell {
  const elements: ScalarCell[] = values.map((v, i) => ({
    kind: 'scalar',
    id: `${id}.${i}`,
    name: '',
    type: 'char',
    value: v,
    address: '0x' + (base + i).toString(16),
  }));
  return { kind: 'array', id, name: id, type, address: '0x' + base.toString(16), elements };
}

/** main() with src (fixed "hi") and dst (its three bytes evolve as they are written). */
function mainFrame(dst: ScalarCell['value'][]): StackFrame {
  return {
    id: 'main',
    name: 'main',
    callId: 0,
    address: '0x7ffd0000',
    variables: [
      charArray('src', SRC_BASE, SRC_CHARS, 'char[3]'),
      charArray('dst', DST_BASE, dst, 'char[3]'),
    ],
  };
}

/** my_strcpy() frame: dst → main dst[dstIdx], src → main src[srcIdx]. */
function strcpyFrame(dstIdx: number, srcIdx: number): StackFrame {
  const dst: PointerCell = {
    kind: 'pointer',
    id: 'dstp',
    name: 'dst',
    type: 'char *',
    target: `dst.${dstIdx}`,
    display: '0x' + (DST_BASE + dstIdx).toString(16),
    address: '0x7ffd0fd0',
  };
  const src: PointerCell = {
    kind: 'pointer',
    id: 'srcp',
    name: 'src',
    type: 'const char *',
    target: `src.${srcIdx}`,
    display: '0x' + (SRC_BASE + srcIdx).toString(16),
    address: '0x7ffd0fd8',
  };
  return {
    id: 'strcpy',
    name: 'my_strcpy',
    callId: 0,
    address: '0x7ffd0fd0',
    variables: [dst, src],
  };
}

const G = null; // uninitialised ("garbage") dst byte → renders as ?
const COND = { expr: "*src != '\\0'" };

const steps: Step[] = [
  {
    id: 'start',
    index: 0,
    narration: 'main begins.',
    highlightedLines: [13],
    stack: [mainFrame([G, G, G])],
    heap: [],
    activeId: 'main',
  },
  {
    id: 'decl-src',
    index: 1,
    narration: "src = \"hi\" — the source string 'h','i','\\0'.",
    highlightedLines: [15],
    stack: [mainFrame([G, G, G])],
    heap: [],
    activeId: 'src.0',
  },
  {
    id: 'decl-dst',
    index: 2,
    narration: 'dst[3] is declared but uninitialised — its bytes are garbage (shown as ?).',
    highlightedLines: [16],
    stack: [mainFrame([G, G, G])],
    heap: [],
    activeId: 'dst.0',
  },
  {
    id: 'call',
    index: 3,
    narration:
      'my_strcpy(dst, src): the two parameters are pointers into main’s arrays — dst → dst[0], src → src[0].',
    highlightedLines: [17, 3],
    stack: [mainFrame([G, G, G]), strcpyFrame(0, 0)],
    heap: [],
    activeId: 'strcpy',
  },
  {
    id: 'check-h',
    index: 4,
    narration: "*src is 'h' — not the terminator — so copy it.",
    highlightedLines: [5],
    stack: [mainFrame([G, G, G]), strcpyFrame(0, 0)],
    heap: [],
    activeId: 'src.0',
    condition: { ...COND, result: true },
  },
  {
    id: 'copy-h',
    index: 5,
    narration: "*dst = *src copies 'h' into dst[0].",
    highlightedLines: [6],
    stack: [mainFrame(["'h'", G, G]), strcpyFrame(0, 0)],
    heap: [],
    activeId: 'dst.0',
  },
  {
    id: 'dst-adv-1',
    index: 6,
    narration: 'dst = dst + 1 advances to dst[1] (0xb001).',
    highlightedLines: [7],
    stack: [mainFrame(["'h'", G, G]), strcpyFrame(1, 0)],
    heap: [],
    activeId: 'dst.1',
  },
  {
    id: 'src-adv-1',
    index: 7,
    narration:
      'src = src + 1 advances to src[1] (0xa001). Both arrows glide one element to the right.',
    highlightedLines: [8],
    stack: [mainFrame(["'h'", G, G]), strcpyFrame(1, 1)],
    heap: [],
    activeId: 'src.1',
  },
  {
    id: 'check-i',
    index: 8,
    narration: "*src is 'i' — copy it.",
    highlightedLines: [5],
    stack: [mainFrame(["'h'", G, G]), strcpyFrame(1, 1)],
    heap: [],
    activeId: 'src.1',
    condition: { ...COND, result: true },
  },
  {
    id: 'copy-i',
    index: 9,
    narration: "*dst = *src copies 'i' into dst[1].",
    highlightedLines: [6],
    stack: [mainFrame(["'h'", "'i'", G]), strcpyFrame(1, 1)],
    heap: [],
    activeId: 'dst.1',
  },
  {
    id: 'dst-adv-2',
    index: 10,
    narration: 'dst advances to dst[2] (0xb002).',
    highlightedLines: [7],
    stack: [mainFrame(["'h'", "'i'", G]), strcpyFrame(2, 1)],
    heap: [],
    activeId: 'dst.2',
  },
  {
    id: 'src-adv-2',
    index: 11,
    narration: 'src advances to src[2] (0xa002).',
    highlightedLines: [8],
    stack: [mainFrame(["'h'", "'i'", G]), strcpyFrame(2, 2)],
    heap: [],
    activeId: 'src.2',
  },
  {
    id: 'check-nul',
    index: 12,
    narration: "*src is now '\\0' — the loop stops without copying the terminator yet.",
    highlightedLines: [5],
    stack: [mainFrame(["'h'", "'i'", G]), strcpyFrame(2, 2)],
    heap: [],
    activeId: 'src.2',
    condition: { ...COND, result: false },
  },
  {
    id: 'copy-nul',
    index: 13,
    narration:
      "After the loop, *dst = '\\0' copies the terminator into dst[2]. dst is now a complete string.",
    highlightedLines: [10],
    stack: [mainFrame(["'h'", "'i'", "'\\0'"]), strcpyFrame(2, 2)],
    heap: [],
    activeId: 'dst.2',
  },
  {
    id: 'return-strcpy',
    index: 14,
    narration: 'my_strcpy returns; dst holds "hi" with its terminator.',
    highlightedLines: [11],
    stack: [mainFrame(["'h'", "'i'", "'\\0'"])],
    heap: [],
    activeId: 'dst.0',
  },
  {
    id: 'print',
    index: 15,
    narration: 'printf("%s", dst) prints "hi".',
    highlightedLines: [18],
    stack: [mainFrame(["'h'", "'i'", "'\\0'"])],
    heap: [],
    activeId: 'dst.0',
    stdout: ['hi'],
  },
  {
    id: 'return',
    index: 16,
    narration: 'main returns 0 and the program ends.',
    highlightedLines: [19],
    stack: [mainFrame(["'h'", "'i'", "'\\0'"])],
    heap: [],
    activeId: 'main',
    stdout: ['hi'],
  },
];

export const strcpyTrace: Trace = {
  id: 'se200-strcpy',
  title: 'strcpy — two pointers in lockstep',
  course: 'SE 200',
  topic: 'Even More Pointers, Arrays and Strings',
  file: 'strcpy.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE200: Even More Pointers, Arrays and Strings'],
};
