/**
 * The three candidate mappings, checked against the decision criteria on the committed recorder
 * fixtures (no Pyodide needed). The outcome is written up in `docs/PYTHON_TRACE_FORMAT.md`.
 */
import { describe, expect, it } from 'vitest';
import { diffSteps } from '../../engine/trace/diff.ts';
// Installs the (lazily loaded, in the app) Python deriver the panel uses.
import '../../engine/explain/python.ts';
import { explainBeat } from '../../engine/trace/explain.ts';
import { pointersByTarget } from '../../engine/pointers.ts';
import type { HeapBlock, Step, Trace } from '../../engine/trace/types.ts';
import { validateTrace } from '../../engine/trace/validate.ts';
import type { RunResult } from '../protocol.ts';
import { SAMPLES } from '../samples/index.ts';
import { EXTRA_PROGRAMS } from '../testPrograms.ts';
import { adaptC, mapA, mapB, mapC, type PyTrace } from './candidates.ts';
import { planSteps } from './plan.ts';

const RAW = import.meta.glob<string>('../fixtures/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});
function fixture(name: string): RunResult {
  const text = RAW[`../fixtures/${name}.json`];
  if (text === undefined) throw new Error(`missing fixture ${name}`);
  return JSON.parse(text) as RunResult;
}
const sourceOf = (name: string) =>
  [...SAMPLES, ...EXTRA_PROGRAMS].find((s) => s.name === name)?.request.source ?? '';

/** The spike traces carry `language: 'python'`, which the shared `Trace` type gains in Phase 30. */
const asTrace = (t: PyTrace): Trace => t as unknown as Trace;
const A = (name: string) => mapA(fixture(name), sourceOf(name), name);
const B = (name: string) => mapB(fixture(name), sourceOf(name), name);
const C = (name: string) => {
  const stored = mapC(fixture(name), sourceOf(name), name);
  return { ...stored, steps: stored.steps.map(adaptC) };
};
const diffAt = (steps: Step[], i: number) => diffSteps(i > 0 ? steps[i - 1] : null, steps[i]);

const ALL = [...SAMPLES.map((s) => s.name), 'extra-dict-keys', 'extra-summary', 'extra-rebind'];

describe('step planning (shared by A, B and C)', () => {
  it('a step shows the state after its highlighted line ran', () => {
    const steps = planSteps(fixture('aliasing'));
    expect(steps.map((s) => s.line)).toEqual([1, 2, 3]);
    // Line 3 (`b.append(3)`) is highlighted over the snapshot taken after it ran.
    expect(steps[2].snap.objects.o1).toMatchObject({ items: [{}, {}, { repr: '3' }] });
  });

  it('returns resume on the caller line; the call → first-line transition makes no step', () => {
    const steps = planSteps(fixture('recursion'));
    expect(steps).toHaveLength(15);
    expect(steps.map((s) => s.line)).toEqual([1, 6, 2, 4, 2, 4, 2, 4, 2, 3, 4, 4, 4, 6, 7]);
    expect(steps[13].narration).toBe('Back in <module>: line 6 finishes.');
  });

  it('a syntax error has no steps', () => {
    expect(planSteps(fixture('syntax-error'))).toEqual([]);
  });
});

describe('criterion 1 — existing C traces unaffected: the mappings produce today’s shapes', () => {
  it.each(ALL)('%s: A and C validate with the unchanged validator', (name) => {
    expect(validateTrace(asTrace(A(name)))).toEqual([]);
    expect(validateTrace(asTrace(C(name) as PyTrace))).toEqual([]);
  });

  it('A only adds the optional objectKind tag to HeapBlock', () => {
    const known: (keyof HeapBlock | 'objectKind')[] = [
      'id',
      'label',
      'type',
      'address',
      'size',
      'cells',
      'state',
      'objectKind',
    ];
    for (const name of ALL) {
      for (const step of A(name).steps) {
        for (const block of step.heap) {
          for (const key of Object.keys(block)) expect(known).toContain(key);
        }
      }
    }
  });
});

describe('criterion 2 — aliasing: two names, one object, two arrows into one box', () => {
  it('A: both pointer cells target the same block, which the arrow overlay draws twice', () => {
    const last = A('aliasing').steps.at(-1)!;
    expect(pointersByTarget(last).get('o1')).toEqual(['a', 'b']);
    expect(last.heap.map((b) => b.id)).toEqual(['o1']);
  });

  it('C: identical to A after the render-time adapter', () => {
    expect(pointersByTarget(C('aliasing').steps.at(-1)!).get('o1')).toEqual(['a', 'b']);
  });

  it('B: the payload has it, but nothing the existing canvas reads does (needs a new renderer)', () => {
    const last = B('aliasing').steps.at(-1)!;
    expect(last.python.frames[0].vars.map((v) => v.value)).toEqual([
      { kind: 'ref', id: 'o1' },
      { kind: 'ref', id: 'o1' },
    ]);
    expect(pointersByTarget(last).size).toBe(0);
  });
});

describe('criterion 3 — in-place mutation is a change to the same object id', () => {
  it('A: `b.append(3)` adds a cell inside block o1; no block appears or disappears', () => {
    const { steps } = A('aliasing');
    const d = diffAt(steps, 2);
    expect(d.cellsAdded).toEqual(['o1[2]']);
    expect(d.cellsRemoved).toEqual([]);
    expect(d.pointersRetargeted).toEqual([]);
    expect(steps[1].heap.map((b) => b.id)).toEqual(steps[2].heap.map((b) => b.id));
  });

  it('A: an attribute set by a method is a value change inside the instance', () => {
    const { steps } = A('class-instances');
    const i = steps.findIndex((s) => s.narration.startsWith('drive returns'));
    expect(diffAt(steps, i).valuesChanged).toEqual([{ id: 'o3.fuel', from: '100', to: '70' }]);
  });

  it('B: object ids are stable in the payload, but diffSteps sees nothing', () => {
    const { steps } = B('aliasing');
    const d = diffAt(steps, 2);
    expect(steps[2].python.objects.map((o) => o.id)).toEqual(['o1']);
    expect([
      ...d.cellsAdded,
      ...d.cellsRemoved,
      ...d.valuesChanged,
      ...d.pointersRetargeted,
    ]).toEqual([]);
  });
});

describe('criterion 4 — diffSteps gives the right “what changed” for every sample (A; C ≡ A)', () => {
  it('C adapts to exactly A’s steps', () => {
    for (const name of ALL) expect(C(name).steps).toEqual(A(name).steps);
  });

  it('aliasing', () => {
    const { steps } = A('aliasing');
    expect(diffAt(steps, 0).cellsAdded).toEqual(['f1.a', 'o1[0]', 'o1[1]']);
    expect(diffAt(steps, 1).cellsAdded).toEqual(['f1.b']);
    expect(diffAt(steps, 2).cellsAdded).toEqual(['o1[2]']);
  });

  it('mutation through an argument: the callee appends to the caller’s list', () => {
    const { steps } = A('mutation-through-argument');
    const call = steps.findIndex((s) => s.narration.startsWith('Line 5 calls add_crop'));
    expect(diffAt(steps, call).framesPushed.map((f) => f.name)).toEqual(['add_crop']);
    const ret = diffAt(steps, call + 1);
    expect(ret.cellsAdded).toEqual(['f2.return', 'o2[1]']);
    expect(diffAt(steps, call + 2).framesPopped.map((f) => f.id)).toEqual(['f2']);
    const callerBasket = steps[call + 2].stack[0].variables.find((c) => c.name === 'basket');
    expect(callerBasket).toMatchObject({ kind: 'pointer', target: 'o2' });
  });

  it('nested containers', () => {
    const { steps } = A('nested-containers');
    expect(diffAt(steps, 1).cellsAdded).toEqual(['o3[0]']);
    expect(diffAt(steps, 3).valuesChanged).toEqual([
      { id: "o6['kind']", from: "'goat'", to: "'sheep'" },
    ]);
  });

  it('recursion: four pushes, four pops, return values in the returning frame', () => {
    const { steps } = A('recursion');
    const diffs = steps.map((_, i) => diffAt(steps, i));
    expect(diffs.flatMap((d) => d.framesPushed.map((f) => f.id))).toEqual([
      'f1',
      'f2',
      'f3',
      'f4',
      'f5',
    ]);
    expect(diffs.flatMap((d) => d.framesPopped.map((f) => f.id))).toEqual(['f5', 'f4', 'f3', 'f2']);
    const returns = steps.flatMap((s) =>
      s.stack.flatMap((f) => f.variables.filter((c) => c.name === 'return')),
    );
    expect([
      ...new Set(returns.map((c) => `${c.id}=${c.kind === 'scalar' ? c.value : ''}`)),
    ]).toEqual(['f5.return=1', 'f4.return=2', 'f3.return=6', 'f2.return=24']);
    expect(steps.at(-1)?.stdout).toEqual(['24']);
  });

  it('class instances', () => {
    const { steps } = A('class-instances');
    const blue = steps.findIndex((s) => s.narration.startsWith('Line 10 calls __init__'));
    expect(diffAt(steps, blue).cellsAdded).toEqual(['f4.self', 'f4.name', 'f4.fuel']);
    expect(steps[blue].heap.map((b) => b.id)).toEqual(['o2', 'o3', 'o4']);
  });

  it('harvest: each count change is a value change on the same dict entry', () => {
    const { steps } = A('harvest');
    const changes = steps.flatMap((_, i) =>
      diffAt(steps, i).valuesChanged.filter((v) => v.id.startsWith('o2')),
    );
    expect(changes).toEqual([
      { id: "o2['corn']", from: '1', to: '2' },
      { id: "o2['corn']", from: '2', to: '3' },
    ]);
    const added = steps.flatMap((_, i) =>
      diffAt(steps, i).cellsAdded.filter((id) => id.startsWith('o2[')),
    );
    expect(added).toEqual(["o2['corn']", "o2['wheat']", "o2['beans']"]);
    // …and the explanation panel reads it (Phase 32: named by the path the code uses).
    const at = steps.findIndex((_, i) =>
      diffAt(steps, i).valuesChanged.some((v) => v.id === "o2['corn']"),
    );
    expect(explainBeat(asTrace(A('harvest')), at, 'apply', 'two-beat').changes).toEqual([
      { kind: 'value', subject: "`counts['corn']`", from: '1', to: '2', markdown: true },
    ]);
  });

  it('runtime error: state up to the error, then an exception step that changes nothing', () => {
    const { steps } = A('runtime-error');
    const raised = steps.findIndex((s) => s.narration.startsWith('Line 5 raised KeyError'));
    expect(raised).toBe(8);
    const d = diffAt(steps, raised);
    expect([...d.cellsAdded, ...d.valuesChanged, ...d.framesPushed, ...d.framesPopped]).toEqual([]);
    expect(diffAt(steps, raised - 1).valuesChanged).toEqual([
      { id: 'f1.item', from: "'wheat'", to: "'beans'" },
    ]);
  });

  it('infinite loop: one value change per assignment', () => {
    const { steps } = A('infinite-loop');
    const onAssign = steps
      .map((s, i) => [s, i] as const)
      .filter(([s]) => s.highlightedLines[0] === 3);
    expect(onAssign.length).toBeGreaterThan(5);
    for (const [, i] of onAssign.slice(1)) {
      expect(diffAt(steps, i).valuesChanged.map((v) => v.id)).toEqual(['f1.day']);
    }
  });

  it('known gap beyond the samples: a name rebound across kinds (scalar ↔ pointer) is not reported', () => {
    // Phase 30 closes this with a small additive diff field; see PYTHON_TRACE_FORMAT.md.
    const { steps } = A('extra-rebind');
    const d = diffAt(steps, 1);
    expect(d.valuesChanged).toEqual([]);
    expect(d.pointersRetargeted).toEqual([]);
    expect(steps[1].stack[0].variables[0]).toMatchObject({ id: 'f1.x', kind: 'pointer' });
    expect(steps[0].stack[0].variables[0]).toMatchObject({ id: 'f1.x', kind: 'scalar' });
  });

  it('Phase 30 closes that gap: `kindsChanged` reports the rebind, both ways', () => {
    const { steps } = A('extra-rebind');
    const forward = diffAt(steps, 1).kindsChanged;
    expect(forward.map((k) => [k.id, k.from.kind, k.to.kind])).toEqual([
      ['f1.x', 'scalar', 'pointer'],
    ]);
    const back = diffSteps(steps[1], steps[0]).kindsChanged;
    expect(back.map((k) => [k.id, k.from.kind, k.to.kind])).toEqual([
      ['f1.x', 'pointer', 'scalar'],
    ]);
  });
});

describe('criterion 5 — any primitive dict key, and nesting, with no special cases', () => {
  it('A: keys of type int, float, str, bool and None name their cells; nesting is pointers', () => {
    const last = A('extra-dict-keys').steps.at(-1)!;
    const inventory = last.heap.find((b) => b.id === 'o1')!;
    expect(inventory.cells.map((c) => c.name)).toEqual([
      '1',
      '2.5',
      "'corn'",
      'False',
      'None',
      '(1, 2)',
    ]);
    expect(inventory.cells.map((c) => c.kind)).toEqual([
      'scalar',
      'scalar',
      'pointer',
      'scalar',
      'pointer',
      'scalar',
    ]);
    const corn = inventory.cells[2];
    const cornBlock = last.heap.find((b) => corn.kind === 'pointer' && b.id === corn.target)!;
    expect(cornBlock.cells.map((c) => (c.kind === 'scalar' ? c.value : null))).toEqual([
      '3',
      '4',
      '5',
    ]);
    const tags = last.heap.find((b) => b.objectKind === 'set')!;
    expect(tags.cells.map((c) => (c.kind === 'scalar' ? c.value : null))).toEqual([
      "'a'",
      "'b'",
      "'c'",
    ]);
  });
});

describe('criterion 6 — a clear place for ndarray and DataFrame views', () => {
  it('A: a NumPy/pandas object is one block tagged `summary`, shared by every reference', () => {
    const last = A('extra-summary').steps.at(-1)!;
    const summary = last.heap.filter((b) => b.objectKind === 'summary');
    expect(summary).toHaveLength(1);
    expect(summary[0]).toMatchObject({ label: 'numpy ndarray', type: 'ndarray' });
    expect(
      summary[0].cells.map((c) => (c.kind === 'scalar' ? `${c.name}=${c.value}` : '')),
    ).toEqual(['shape=(2, 3)', 'dtype=float64']);
    expect(pointersByTarget(last).get(summary[0].id)).toEqual(['grid', '0', '1']);
  });

  it('A: real NumPy and pandas objects (fixture recorded with the packages) map the same way', () => {
    // Since Phase 34 the array is an `ndarray` block with its values (C order) and the NumPy scalar
    // `best = yields.max()` is a primitive typed by its dtype. Since Phase 35 the DataFrame and the
    // Series are tables, their values keyed by index label (and column label).
    const result = fixture('packages-numpy-pandas');
    expect(result.error).toBeUndefined();
    const last = mapA(result, '\n'.repeat(8), 'packages').steps.at(-1)!;
    const rows = last.heap.map((b) => [
      b.objectKind,
      b.label,
      ...b.cells.map((c) => (c.kind === 'scalar' ? `${c.name}=${c.value}` : c.name)),
    ]);
    expect(rows).toEqual([
      [
        'ndarray',
        'numpy ndarray',
        '0, 0=3.0',
        '0, 1=4.5',
        '0, 2=2.0',
        '1, 0=5.5',
        '1, 1=1.0',
        '1, 2=4.0',
      ],
      [
        'dataframe',
        'pandas DataFrame',
        "0, 'crop'='corn'",
        "0, 'tons'=12",
        "1, 'crop'='wheat'",
        "1, 'tons'=7",
      ],
      ['series', 'pandas Series', '0=12', '1=7'],
      ['dict', 'dict', "'grid'", "'table'"],
    ]);
    expect(last.heap[0].ndarray).toMatchObject({
      shape: [2, 3],
      dtype: 'float64',
      size: 6,
      base: null,
    });
    expect(last.heap[1].table).toMatchObject({
      kind: 'dataframe',
      shape: [2, 2],
      rowKeys: ['0', '1'],
    });
    expect(last.heap[1].table?.columns.map((c) => [c.name, c.dtype])).toEqual([
      ['crop', 'str'],
      ['tons', 'int64'],
    ]);
    expect(last.heap[2].table).toMatchObject({ kind: 'series', shape: [2], name: 'tons' });
    const best = last.stack[0].variables.find((v) => v.name === 'best');
    expect(best).toMatchObject({ kind: 'scalar', type: 'np.float64', value: '5.5' });
  });

  it('B: the same summary sits in the payload, for a renderer B would have to write', () => {
    const last = B('extra-summary').steps.at(-1)!;
    expect(last.python.objects.find((o) => o.object.kind === 'summary')?.object).toMatchObject({
      library: 'numpy',
      shape: [2, 3],
    });
  });
});
