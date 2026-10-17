/**
 * The object-level diff (Phase 30): every event kind on a small hand-built step pair, the inverse
 * for stepping back, and the committed recordings.
 */
import { describe, expect, it } from 'vitest';
import { diffObjects, invertEvent, invertEvents, type PyEvent } from './objectDiff.ts';
import {
  dict,
  fn,
  instance,
  int,
  list,
  pyStep,
  ref,
  set,
  str,
  tuple,
  type FrameSpec,
} from './pythonTestKit.ts';
import type { Step, Trace } from './types.ts';

const TRACES = import.meta.glob<Trace>('../../content/fixtures/python/*.json', {
  eager: true,
  import: 'default',
});

/** A compact, order-independent view of events for comparison. */
const canon = (events: PyEvent[]) => events.map((e) => JSON.stringify(e)).sort();

/** `[step a, step b]` with only the module frame. */
function pair(
  aVars: FrameSpec[2],
  aObjects: Parameters<typeof pyStep>[2],
  bVars: FrameSpec[2],
  bObjects: Parameters<typeof pyStep>[2],
): [Step, Step] {
  return [
    pyStep(0, [['f1', '<module>', aVars]], aObjects),
    pyStep(1, [['f1', '<module>', bVars]], bObjects),
  ];
}

const kinds = (events: PyEvent[]) => events.map((e) => e.kind);

/** Each case: a step pair and the events going forward. */
const CASES: { name: string; steps: [Step, Step]; expected: PyEvent[] }[] = [
  {
    name: 'object created (and a name bound to it)',
    steps: pair({ n: int(1) }, {}, { n: int(1), a: ref('o1') }, { o1: list(int(1)) }),
    expected: [
      { kind: 'name-bound', frameId: 'f1', cellId: 'f1.a' },
      { kind: 'object-created', objectId: 'o1' },
    ],
  },
  {
    name: 'item appended',
    steps: pair(
      { a: ref('o1') },
      { o1: list(int(1), int(2)) },
      { a: ref('o1') },
      {
        o1: list(int(1), int(2), int(3)),
      },
    ),
    expected: [{ kind: 'item-added', objectId: 'o1', cellId: 'o1[2]', index: 2, atEnd: true }],
  },
  {
    name: 'item inserted at the front (aligned by value, not by position)',
    steps: pair(
      { a: ref('o1') },
      { o1: list(int(1), int(2)) },
      { a: ref('o1') },
      {
        o1: list(int(0), int(1), int(2)),
      },
    ),
    expected: [{ kind: 'item-added', objectId: 'o1', cellId: 'o1[0]', index: 0, atEnd: false }],
  },
  {
    name: 'item removed from the middle',
    steps: pair(
      { a: ref('o1') },
      { o1: list(str('a'), str('b'), str('c')) },
      { a: ref('o1') },
      {
        o1: list(str('a'), str('c')),
      },
    ),
    expected: [{ kind: 'item-removed', objectId: 'o1', cellId: 'o1[1]', index: 1, atEnd: false }],
  },
  {
    name: 'item value changed',
    steps: pair(
      { a: ref('o1') },
      { o1: list(int(1), int(2)) },
      { a: ref('o1') },
      {
        o1: list(int(1), int(9)),
      },
    ),
    expected: [
      {
        kind: 'value-changed',
        ownerId: 'o1',
        cellId: 'o1[1]',
        from: { kind: 'scalar', id: 'o1[1]', name: '1', type: 'int', value: '2' },
        to: { kind: 'scalar', id: 'o1[1]', name: '1', type: 'int', value: '9' },
      },
    ],
  },
  {
    name: 'dict key added',
    steps: pair(
      { d: ref('o1') },
      { o1: dict([str('corn'), int(1)]) },
      { d: ref('o1') },
      {
        o1: dict([str('corn'), int(1)], [str('wheat'), int(1)]),
      },
    ),
    expected: [{ kind: 'key-added', objectId: 'o1', cellId: "o1['wheat']" }],
  },
  {
    name: 'dict key removed',
    steps: pair(
      { d: ref('o1') },
      { o1: dict([str('corn'), int(1)], [str('wheat'), int(1)]) },
      { d: ref('o1') },
      {
        o1: dict([str('wheat'), int(1)]),
      },
    ),
    expected: [{ kind: 'key-removed', objectId: 'o1', cellId: "o1['corn']" }],
  },
  {
    name: 'dict value changed in place',
    steps: pair(
      { d: ref('o1') },
      { o1: dict([str('corn'), int(1)]) },
      { d: ref('o1') },
      {
        o1: dict([str('corn'), int(2)]),
      },
    ),
    expected: [
      {
        kind: 'value-changed',
        ownerId: 'o1',
        cellId: "o1['corn']",
        from: { kind: 'scalar', id: "o1['corn']", name: "'corn'", type: 'int', value: '1' },
        to: { kind: 'scalar', id: "o1['corn']", name: "'corn'", type: 'int', value: '2' },
      },
    ],
  },
  {
    name: 'set member added',
    steps: pair(
      { s: ref('o1') },
      { o1: set(str('a'), str('c')) },
      { s: ref('o1') },
      {
        o1: set(str('a'), str('b'), str('c')),
      },
    ),
    expected: [{ kind: 'item-added', objectId: 'o1', cellId: "o1{'b'}", index: 1, atEnd: false }],
  },
  {
    name: 'attribute set (new)',
    steps: pair(
      { t: ref('o1') },
      { o1: instance('Tractor', { name: str('Red') }) },
      { t: ref('o1') },
      {
        o1: instance('Tractor', { name: str('Red'), fuel: int(100) }),
      },
    ),
    expected: [
      {
        kind: 'attribute-set',
        objectId: 'o1',
        cellId: 'o1.fuel',
        from: null,
        to: { kind: 'scalar', id: 'o1.fuel', name: 'fuel', type: 'int', value: '100' },
      },
    ],
  },
  {
    name: 'attribute set (changed)',
    steps: pair(
      { t: ref('o1') },
      { o1: instance('Tractor', { fuel: int(100) }) },
      { t: ref('o1') },
      {
        o1: instance('Tractor', { fuel: int(70) }),
      },
    ),
    expected: [
      {
        kind: 'attribute-set',
        objectId: 'o1',
        cellId: 'o1.fuel',
        from: { kind: 'scalar', id: 'o1.fuel', name: 'fuel', type: 'int', value: '100' },
        to: { kind: 'scalar', id: 'o1.fuel', name: 'fuel', type: 'int', value: '70' },
      },
    ],
  },
  {
    name: 'reference retargeted (the old object becomes unreachable)',
    steps: pair({ a: ref('o1') }, { o1: list(int(1)) }, { a: ref('o2') }, { o2: tuple(int(1)) }),
    expected: [
      { kind: 'reference-retargeted', ownerId: 'f1', cellId: 'f1.a', from: 'o1', to: 'o2' },
      { kind: 'object-created', objectId: 'o2' },
      { kind: 'object-released', objectId: 'o1' },
    ],
  },
  {
    name: 'a name rebound from a primitive to a reference (a kind change)',
    steps: pair({ x: int(1) }, {}, { x: ref('o1') }, { o1: list(int(1)) }),
    expected: [
      {
        kind: 'value-changed',
        ownerId: 'f1',
        cellId: 'f1.x',
        from: { kind: 'scalar', id: 'f1.x', name: 'x', type: 'int', value: '1' },
        to: { kind: 'pointer', id: 'f1.x', name: 'x', type: 'list', target: 'o1' },
      },
      { kind: 'object-created', objectId: 'o1' },
    ],
  },
  {
    name: 'frame pushed',
    steps: [
      pyStep(0, [['f1', '<module>', { f: ref('o1') }]], { o1: fn('f', ['n']) }),
      pyStep(
        1,
        [
          ['f1', '<module>', { f: ref('o1') }],
          ['f2', 'f', { n: int(3) }],
        ],
        { o1: fn('f', ['n']) },
      ),
    ],
    expected: [{ kind: 'frame-pushed', frameId: 'f2' }],
  },
  {
    name: 'return value bound, then frame popped',
    steps: [
      pyStep(
        0,
        [
          ['f1', '<module>', {}],
          ['f2', 'f', { n: int(3) }],
        ],
        {},
        int(6),
      ),
      pyStep(1, [['f1', '<module>', { r: int(6) }]]),
    ],
    expected: [
      { kind: 'frame-popped', frameId: 'f2' },
      { kind: 'name-bound', frameId: 'f1', cellId: 'f1.r' },
    ],
  },
];

describe('diffObjects — every event kind', () => {
  it.each(CASES.map((c) => [c.name, c] as const))('%s', (_, c) => {
    expect(diffObjects(c.steps[0], c.steps[1])).toEqual(c.expected);
  });

  it.each(CASES.map((c) => [c.name, c] as const))(
    '%s — stepping back plays the inverse',
    (_, c) => {
      const back = diffObjects(c.steps[1], c.steps[0]);
      expect(canon(back)).toEqual(canon(invertEvents(c.expected)));
    },
  );

  it('covers every event kind, forwards or backwards', () => {
    const seen = new Set<string>();
    for (const c of CASES) {
      for (const e of c.expected) {
        seen.add(e.kind);
        seen.add(invertEvent(e).kind);
      }
    }
    expect([...seen].sort()).toEqual([
      'attribute-deleted',
      'attribute-set',
      'frame-popped',
      'frame-pushed',
      'item-added',
      'item-removed',
      'key-added',
      'key-removed',
      'name-bound',
      'name-unbound',
      'object-created',
      'object-released',
      'reference-retargeted',
      'value-changed',
    ]);
  });

  it('inverting twice is the identity', () => {
    for (const c of CASES) expect(invertEvents(invertEvents(c.expected))).toEqual(c.expected);
  });

  it('falls back to positions when more than one item changed', () => {
    const [a, b] = pair(
      { a: ref('o1') },
      { o1: list(int(1), int(2)) },
      { a: ref('o1') },
      {
        o1: list(int(5), int(6), int(7), int(8)),
      },
    );
    expect(kinds(diffObjects(a, b))).toEqual([
      'value-changed',
      'value-changed',
      'item-added',
      'item-added',
    ]);
  });

  it('a first step (no previous) creates every frame and object', () => {
    const [, b] = pair({}, {}, { a: ref('o1') }, { o1: list() });
    expect(diffObjects(null, b)).toEqual([
      { kind: 'frame-pushed', frameId: 'f1' },
      { kind: 'object-created', objectId: 'o1' },
    ]);
  });
});

describe('diffObjects on the committed recordings', () => {
  const trace = (name: string) => TRACES[`../../content/fixtures/python/${name}.json`];
  const at = (t: Trace, i: number) => diffObjects(t.steps[i - 1], t.steps[i]);

  it('aliasing: b = a binds a name, no new object; b.append(3) appends to the same list', () => {
    const t = trace('aliasing');
    expect(at(t, 1)).toEqual([{ kind: 'name-bound', frameId: 'f1', cellId: 'f1.b' }]);
    expect(at(t, 2)).toEqual([
      { kind: 'item-added', objectId: 'o1', cellId: 'o1[2]', index: 2, atEnd: true },
    ]);
  });

  it('harvest: keys are added, and corn changes in place', () => {
    const t = trace('harvest');
    const events = t.steps.slice(1).flatMap((_, i) => at(t, i + 1));
    const keys = events.flatMap((e) => (e.kind === 'key-added' ? [e.cellId] : []));
    expect(keys).toEqual(["o2['corn']", "o2['wheat']", "o2['beans']"]);
    const corn = events.filter((e) => e.kind === 'value-changed' && e.cellId === "o2['corn']");
    expect(corn).toHaveLength(2);
  });

  it('recursion: four pushes, then four pops', () => {
    const t = trace('recursion');
    const all = t.steps.slice(1).flatMap((_, i) => at(t, i + 1));
    expect(all.filter((e) => e.kind === 'frame-pushed')).toHaveLength(4);
    expect(all.filter((e) => e.kind === 'frame-popped')).toHaveLength(4);
  });

  it('every adjacent pair of every recording inverts exactly', () => {
    for (const [path, t] of Object.entries(TRACES)) {
      for (let i = 1; i < t.steps.length; i++) {
        expect(canon(diffObjects(t.steps[i], t.steps[i - 1])), `${path} ${i}`).toEqual(
          canon(invertEvents(at(t, i))),
        );
      }
    }
  });
});
