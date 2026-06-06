/**
 * SE 200 · Hello, World (week 1) — the gentle on-ramp.
 *
 * A single `main` frame and the console panel showing `printf` output. No locals, no control flow —
 * it just proves the simplest possible program plays end to end on the engine.
 *
 * Verified by inspection: `printf("Hello, World!\n")` writes exactly `Hello, World!` then a newline;
 * `main` returns 0.
 */
import type { StackFrame, Step, Trace } from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

const SOURCE = `#include <stdio.h>

int main(void)
{
    printf("Hello, World!\\n");
    return 0;
}
`;

const main: StackFrame = {
  id: 'main',
  name: 'main',
  callId: 0,
  address: '0x7ffd0000',
  variables: [],
};

const steps: Step[] = [
  {
    id: 'start',
    index: 0,
    narration: 'The program starts and a stack frame for main is created. main takes no arguments.',
    highlightedLines: [3, 4],
    stack: [main],
    heap: [],
    activeId: 'main',
  },
  {
    id: 'printf',
    index: 1,
    narration: 'printf writes the text Hello, World! to the console, followed by a newline.',
    highlightedLines: [5],
    stack: [main],
    heap: [],
    activeId: 'main',
    stdout: ['Hello, World!'],
  },
  {
    id: 'return',
    index: 2,
    narration: 'main returns 0 to signal success, and the program exits.',
    highlightedLines: [6],
    stack: [main],
    heap: [],
    activeId: 'main',
    stdout: ['Hello, World!'],
  },
];

export const helloWorldTrace: Trace = {
  id: 'se200-hello-world',
  title: 'Hello, World — your first program',
  course: 'SE 200',
  topic: 'Hello, World',
  file: 'hello.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE200: Hello, World'],
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: helloWorldTrace,
  label: 'Hello, World',
  summary: 'A single main frame and the console — the simplest program.',
  order: 10,
};
export default contentModule;
