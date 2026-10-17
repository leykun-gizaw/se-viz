/**
 * Extra programs recorded alongside the eight samples, for decision criteria the samples don't
 * exercise on their own. Recorded into `fixtures/extra-*.json` by `recorder.test.ts`.
 */
import type { RunRequest } from './protocol.ts';

export const EXTRA_PROGRAMS: { name: string; request: RunRequest }[] = [
  {
    // Criterion 5: dict keys of every hashable primitive type, plus nested containers.
    name: 'extra-dict-keys',
    request: {
      source: [
        'inventory = {1: "one", 2.5: "two and a half", "corn": [3, 4], True: "yes", None: {"nested": (5, 6)}}',
        'inventory["corn"].append(5)',
        'inventory[(1, 2)] = "tuple key"',
        'tags = {"b", "a", "c"}',
        '',
      ].join('\n'),
    },
  },
  {
    // Criterion 6: NumPy / pandas objects arrive as summaries. A stand-in class claiming to live in
    // `numpy` exercises the same recorder path offline (the real thing needs the CDN).
    name: 'extra-summary',
    request: {
      source: [
        'class ndarray:',
        '    shape = (2, 3)',
        '    dtype = "float64"',
        'ndarray.__module__ = "numpy"',
        'grid = ndarray()',
        'rows = [grid, grid]',
        '',
      ].join('\n'),
    },
  },
  {
    // A name rebound from a primitive to a reference (and back): the kind of its cell changes.
    name: 'extra-rebind',
    request: { source: ['x = 1', 'x = [x]', 'x = "done"', ''].join('\n') },
  },
];
