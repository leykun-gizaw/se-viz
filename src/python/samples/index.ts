/**
 * The Phase 29 sample programs (`*.py` in this folder), in the prompt's order, with the limits and
 * stdin each one is recorded with. Used by the recorder tests, the committed fixtures and the
 * dev-only debug page.
 */
import type { RunRequest } from '../protocol.ts';

const SOURCES = import.meta.glob<string>('./*.py', { query: '?raw', import: 'default', eager: true });

function source(name: string): string {
  const text = SOURCES[`./${name}.py`];
  if (text === undefined) throw new Error(`missing sample ${name}.py`);
  return text;
}

export interface Sample {
  /** File stem, also the fixture name. */
  name: string;
  /** What the sample demonstrates. */
  title: string;
  request: RunRequest;
}

export const SAMPLES: Sample[] = [
  { name: 'aliasing', title: '1. Aliasing', request: { source: source('aliasing') } },
  {
    name: 'mutation-through-argument',
    title: '2. Mutation through a function argument',
    request: { source: source('mutation-through-argument') },
  },
  {
    name: 'nested-containers',
    title: '3. Nested containers',
    request: { source: source('nested-containers') },
  },
  { name: 'recursion', title: '4. Recursion: factorial(4)', request: { source: source('recursion') } },
  {
    name: 'class-instances',
    title: '5. A class with two instances',
    request: { source: source('class-instances') },
  },
  { name: 'harvest', title: '6. The DS 200 harvest loop', request: { source: source('harvest') } },
  {
    name: 'runtime-error',
    title: '7a. Runtime error mid-loop (KeyError)',
    request: { source: source('runtime-error') },
  },
  { name: 'syntax-error', title: '7b. Syntax error', request: { source: source('syntax-error') } },
  {
    name: 'infinite-loop',
    title: '8. Infinite loop (step limit)',
    // The committed fixture uses a small step cap to stay readable; the tests also run it with the
    // default 1000.
    request: { source: source('infinite-loop'), limits: { maxSteps: 40 } },
  },
];
