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
        // `False` rather than `True`: True == 1 would share the `1` key.
        'inventory = {1: "one", 2.5: "two and a half", "corn": [3, 4], False: "no", None: {"nested": (5, 6)}}',
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
  {
    // Phase 32: the prompt's reference breakdown, `harvest[crop] += 10` on a dict value
    // (looked up `crop`, read `harvest['beans']` (45), added 10 (55), stored it back).
    name: 'extra-augassign',
    request: {
      source: [
        'harvest = {"corn": 30, "wheat": 20, "beans": 45}',
        'for crop in harvest:',
        '    harvest[crop] += 10',
        'print(harvest)',
        '',
      ].join('\n'),
    },
  },
  {
    // Phase 32: one of each plain statement kind the derived explanations phrase.
    name: 'extra-statements',
    request: {
      source: [
        'import math',
        'from math import sqrt',
        'LIMIT: int = 3',
        'note: str',
        'def area(r):',
        '    return math.pi * r ** 2',
        'square = lambda n: n * n',
        'size = 2',
        'if size > 5:',
        '    label = "big"',
        'elif size > 1:',
        '    label = "medium"',
        'else:',
        '    label = "small"',
        'day = 0',
        'while day < LIMIT:',
        '    day += 1',
        '    if day == 2:',
        '        continue',
        '    pass',
        'else:',
        '    day = -day',
        'stock = {"corn": 3, "beans": 0}',
        'for name, qty in stock.items():',
        '    if qty == 0:',
        '        break',
        'squares = [square(n) for n in range(3)]',
        'a, b = 1, 2',
        'a, b = b, a',
        'del b',
        'assert a == 2',
        'total = sqrt(16) + area(1)',
        '',
      ].join('\n'),
    },
  },
  {
    // Phase 32: exceptions caught in the same frame, caught in a caller, and the clauses around them.
    name: 'extra-exceptions',
    request: {
      source: [
        'prices = {"corn": 3}',
        'try:',
        '    cost = prices["beans"]',
        'except KeyError as missing:',
        '    cost = 0',
        'else:',
        '    cost = cost + 1',
        'finally:',
        '    checked = True',
        'def price_of(item):',
        '    return prices[item]',
        'try:',
        '    price_of("wheat")',
        'except ValueError:',
        '    kind = "value"',
        'except KeyError:',
        '    kind = "key"',
        'try:',
        '    raise ValueError("no price")',
        'except:',
        '    kind = "any"',
        '',
      ].join('\n'),
    },
  },
  {
    // Phase 32: generators, a class with methods, a list shared with a function, and `+=` on a list.
    name: 'extra-objects',
    request: {
      source: [
        'def countdown(n):',
        '    while n > 0:',
        '        yield n',
        '        n -= 1',
        'class Barn:',
        '    def __init__(self, crops):',
        '        self.crops = crops',
        '    def store(self, crop):',
        '        self.crops.append(crop)',
        'seen = []',
        'for t in countdown(2):',
        '    seen.append(t)',
        'shelf = ["corn"]',
        'barn = Barn(shelf)',
        'barn.store("wheat")',
        'shelf += ["beans"]',
        'total = sum(x for x in seen)',
        '',
      ].join('\n'),
    },
  },
];
