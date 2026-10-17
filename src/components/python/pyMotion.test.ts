/**
 * The diff-motion state machine (Phase 30): what plays on a step, a beat, a step back and a jump,
 * how list items keep their keys across an insert, and the object layout.
 */
import { describe, expect, it } from 'vitest';
import {
  advanceBeat,
  EMPTY_STEP,
  resolveBeatRender,
  reverseBeat,
  type BeatPosition,
} from '../../engine/trace/beats.ts';
import { invertEvents } from '../../engine/trace/objectDiff.ts';
import { dict, int, list, pyStep, ref, str } from '../../engine/trace/pythonTestKit.ts';
import type { Step, Trace } from '../../engine/trace/types.ts';
import { firstAppearance, layoutObjects } from './pyLayout.ts';
import { advanceMotion, initialMotion, motionCues } from './pyMotion.ts';

const TRACES = import.meta.glob<Trace>('../../content/fixtures/python/*.json', {
  eager: true,
  import: 'default',
});
const trace = (name: string) => TRACES[`../../content/fixtures/python/${name}.json`];

const module = (index: number, vars: Parameters<typeof pyStep>[1][0][2], objects = {}) =>
  pyStep(index, [['f1', '<module>', vars]], objects);

describe('advanceMotion', () => {
  const t = trace('aliasing');

  it('plays nothing on the first render', () => {
    const m = initialMotion(t.steps[0]);
    expect(m.events).toEqual([]);
    expect(motionCues(m, false).animate).toBe(false);
  });

  it('plays the diff one step forward, and its inverse one step back', () => {
    const forward = advanceMotion(initialMotion(t.steps[1]), t.steps[2]);
    expect(forward.adjacent).toBe(true);
    expect(forward.events.map((e) => e.kind)).toEqual(['item-added']);
    const back = advanceMotion(forward, t.steps[1]);
    expect(back.events).toEqual(invertEvents(forward.events));
    expect(motionCues(back, false).animate).toBe(true);
  });

  it('jumps without motion when the shown step moves by more than one', () => {
    const m = advanceMotion(initialMotion(t.steps[0]), t.steps[2]);
    expect(m.adjacent).toBe(false);
    expect(m.events).toEqual([]);
    const cues = motionCues(m, false);
    expect(cues.animate).toBe(false);
    // Arrows re-mount instead of gliding.
    expect(cues.arrowsKey).not.toBe(motionCues(initialMotion(t.steps[0]), false).arrowsKey);
  });

  it('reduced motion: the events are known (changes are marked) but nothing animates', () => {
    const m = advanceMotion(initialMotion(t.steps[1]), t.steps[2]);
    const cues = motionCues(m, true);
    expect(cues.animate).toBe(false);
    expect(cues.reduce).toBe(true);
    expect(cues.entering.has('o1[2]')).toBe(true);
  });

  it('is unchanged when the same step is shown again', () => {
    const m = initialMotion(t.steps[1]);
    expect(advanceMotion(m, t.steps[1])).toBe(m);
  });

  it('two-beat stepping: arrive shows the pre-state (no motion), apply plays the step', () => {
    const steps = trace('harvest').steps;
    const shown = (p: BeatPosition) => {
      const i = resolveBeatRender(p, 'two-beat').displayIndex;
      return i < 0 ? EMPTY_STEP : steps[i];
    };
    let pos: BeatPosition = { step: 4, beat: 'apply' };
    let m = initialMotion(shown(pos));
    pos = advanceBeat(pos, steps.length, 'two-beat'); // arrive(5): still shows step 4
    m = advanceMotion(m, shown(pos));
    expect(m.events).toEqual([]);
    pos = advanceBeat(pos, steps.length, 'two-beat'); // apply(5): shows step 5
    m = advanceMotion(m, shown(pos));
    expect(m.adjacent).toBe(true);
    const forward = m.events;
    pos = reverseBeat(pos, 'two-beat'); // back to arrive(5): shows step 4 again, inverse plays
    m = advanceMotion(m, shown(pos));
    expect(m.events).toEqual(invertEvents(forward));
  });

  it('the first apply from the empty pre-state creates everything', () => {
    const steps = trace('aliasing').steps;
    const m = advanceMotion(initialMotion(EMPTY_STEP), steps[0]);
    expect(m.events).toEqual([
      { kind: 'frame-pushed', frameId: 'f1' },
      { kind: 'object-created', objectId: 'o1' },
    ]);
  });
});

describe('list item keys follow the alignment', () => {
  const a = module(0, { a: ref('o1') }, { o1: list(str('x'), str('y')) });
  const b = module(1, { a: ref('o1') }, { o1: list(str('new'), str('x'), str('y')) });
  const c = module(2, { a: ref('o1') }, { o1: list(str('x'), str('y')) });

  it('an insert at the front: a fresh key in front, the old items keep theirs', () => {
    const m = advanceMotion(initialMotion(a), b);
    expect(m.keys.o1).toEqual(['o1[0]#0', 'o1[0]', 'o1[1]']);
    const cues = motionCues(m, false);
    expect(cues.entering.has('o1[0]')).toBe(true);
    expect(cues.restructured.has('o1')).toBe(true);
    // The shifted items are not "changed": no cross-fade on them.
    expect(cues.changed.size).toBe(0);
  });

  it('stepping back removes the inserted item, and the keys are the originals again', () => {
    const m = advanceMotion(advanceMotion(initialMotion(a), b), c);
    expect(m.keys.o1).toEqual(['o1[0]', 'o1[1]']);
  });

  it('keys survive steps that do not touch the list', () => {
    const d = module(2, { a: ref('o1'), n: int(1) }, { o1: list(str('new'), str('x'), str('y')) });
    const m = advanceMotion(advanceMotion(initialMotion(a), b), d);
    expect(m.keys.o1).toEqual(['o1[0]#0', 'o1[0]', 'o1[1]']);
  });

  it('a jump resets the keys to positions', () => {
    const far: Step = { ...b, index: 9 };
    expect(advanceMotion(initialMotion(a), far).keys.o1).toEqual(['o1[0]', 'o1[1]', 'o1[2]']);
  });
});

describe('motionCues', () => {
  it('maps events to entering / changed / retargeted', () => {
    const a = module(0, { d: ref('o1'), p: ref('o1') }, { o1: dict([str('corn'), int(1)]) });
    const b = module(
      1,
      { d: ref('o1'), p: ref('o2') },
      { o1: dict([str('corn'), int(2)], [str('wheat'), int(1)]), o2: list() },
    );
    const cues = motionCues(advanceMotion(initialMotion(a), b), false);
    expect([...cues.entering].sort()).toEqual(["o1['wheat']", 'o2']);
    expect([...cues.changed.keys()]).toEqual(["o1['corn']"]);
    expect([...cues.retargeted]).toEqual(['f1.p']);
  });
});

describe('layoutObjects', () => {
  it('orders rows by first appearance and nests inner objects next to their parent', () => {
    const t = trace('nested-containers');
    const rows = layoutObjects(t.steps[3], firstAppearance(t));
    expect(rows).toEqual([
      {
        id: 'o1',
        children: [
          { id: 'o2', children: [] },
          { id: 'o3', children: [] },
        ],
      },
      {
        id: 'o4',
        children: [
          { id: 'o5', children: [] },
          { id: 'o6', children: [] },
        ],
      },
    ]);
  });

  it('an object a frame also refers to keeps its own row', () => {
    const s = module(
      0,
      { outer: ref('o1'), inner: ref('o2') },
      { o1: list(ref('o2')), o2: list() },
    );
    const t: Trace = { id: 't', title: 't', language: 'python', source: '', steps: [s] };
    expect(layoutObjects(s, firstAppearance(t))).toEqual([
      { id: 'o1', children: [] },
      { id: 'o2', children: [] },
    ]);
  });

  it('an object only reachable through a cycle still gets a row', () => {
    const s = module(0, {}, { o1: list(ref('o2')), o2: list(ref('o1')) });
    const t: Trace = { id: 't', title: 't', language: 'python', source: '', steps: [s] };
    expect(layoutObjects(s, firstAppearance(t))).toEqual([
      { id: 'o1', children: [{ id: 'o2', children: [] }] },
    ]);
  });
});
