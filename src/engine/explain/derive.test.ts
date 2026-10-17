/**
 * Unit tests for the derived explanations (Phase 32): one or more per statement kind and per
 * object-diff event, on both beats, at the first and last step; authored text winning section by
 * section; and C modules without authored text.
 *
 * Most cases run on real recordings (the Phase 29 samples and the Phase 32 extra programs), so the
 * statement facts are exactly what the recorder sends. Diff events the recordings don't produce are
 * built by hand with `pythonTestKit`.
 */
import { describe, expect, it } from 'vitest';
import { controlFlowTrace } from '../../content/se200/variables-control-flow/controlFlow.ts';
import { sumToTrace } from '../../content/se200/recursion/sumTo.ts';
import { factorialTrace } from '../../content/se200/recursion/factorial.ts';
import { mapOutcome } from '../../python/live/outcome.ts';
import { DEFAULT_LIVE_LIMITS } from '../../python/live/limits.ts';
import type { PyValue, RunResult } from '../../python/protocol.ts';
import { explainBeat } from '../trace/explain.ts';
import {
  dict,
  instance,
  int,
  list,
  pyStep,
  pyTrace,
  ref,
  set,
  str,
  type FrameSpec,
} from '../trace/pythonTestKit.ts';
import type { Step, Trace } from '../trace/types.ts';
import { deriveExplanation } from './derive.ts';
import { GLOSSARY } from './glossary.ts';
import './python.ts';
import { extraTrace, sampleTrace, stepAt } from './testTraces.ts';

const apply = (t: Trace, i: number) => deriveExplanation(t, i, 'apply');
const arrive = (t: Trace, i: number) => deriveExplanation(t, i, 'arrive');

describe('assignments', () => {
  const harvest = sampleTrace('harvest');

  it('`d[k] += n` reads as the reference breakdown (looked up, read, added, stored back)', () => {
    const t = extraTrace('extra-augassign');
    const i = stepAt(t, 3, 3); // the third pass: crop is 'beans'
    expect(apply(t, i).did).toEqual([
      "Looked up `crop`: `'beans'`.",
      "Read `harvest['beans']`: `45`.",
      'Added `10`, giving `55`.',
      "Stored `55` back in `harvest['beans']`.",
    ]);
    expect(apply(t, i).concept).toBe(GLOSSARY['augassign-dict']);
    expect(arrive(t, i).did).toEqual(['About to run line 3: it updates `harvest[crop]` with `+= 10`.']);
  });

  it('`d[k] = d[k] + 1` on an existing key, and `d[k] = 1` adding a key', () => {
    expect(apply(harvest, stepAt(harvest, 5)).did).toEqual([
      "Looked up `crop`: `'corn'`.",
      "Read `counts['corn']`: `1`.",
      'Added `1`, giving `2`.',
      "Stored `2` in `counts['corn']`.",
    ]);
    expect(apply(harvest, stepAt(harvest, 7)).did).toEqual([
      "Looked up `crop`: `'corn'`.",
      "Added the key `'corn'` to `counts`, with the value `1`.",
    ]);
  });

  it('a new object, and a second name for the same object (aliasing)', () => {
    const t = sampleTrace('aliasing');
    expect(apply(t, 0).did).toEqual(['`a` now refers to a new list.']);
    expect(apply(t, 1).did).toEqual(['`b` now refers to the same list as `a`.']);
    expect(apply(t, 1).concept).toBe(GLOSSARY.aliasing);
  });

  it('`x += 1` on a number, `+=` on a list in place, unpacking and annotations', () => {
    const s = extraTrace('extra-statements');
    expect(apply(s, stepAt(s, 17)).did).toEqual([
      'Read `day`: `0`.',
      'Added `1`, giving `1`.',
      'Stored `1` back in `day`.',
    ]);
    expect(apply(s, stepAt(s, 29)).did).toEqual([
      'Looked up `b`: `2`.',
      'Looked up `a`: `1`.',
      'Unpacked the values: `a` is now `2`, `b` is now `1`.',
    ]);
    expect(apply(s, stepAt(s, 3)).did).toEqual(['Set `LIMIT` to `3`.']);
    expect(apply(s, stepAt(s, 4)).did).toEqual(['Annotated `note` as `str`; no value is stored.']);
    const o = extraTrace('extra-objects');
    expect(apply(o, stepAt(o, 16)).did).toEqual([
      'Changed the list in place: `shelf` still refers to the same list.',
    ]);
    expect(apply(o, stepAt(o, 16)).concept).toBe(GLOSSARY['augassign-list']);
  });

  it('attributes: a new one, and a changed one with its arithmetic', () => {
    const t = sampleTrace('class-instances');
    expect(apply(t, stepAt(t, 3)).did).toEqual([
      "Looked up `name`: `'Red'`.",
      "Set `self.name` to `'Red'` (a new attribute).",
    ]);
    expect(apply(t, stepAt(t, 7)).did.slice(0, 4)).toEqual([
      'Read `self.fuel`: `100`.',
      'Looked up `hours`: `3`.',
      'Subtracted `10 * hours`, giving `70`.',
      'Set `self.fuel` to `70`.',
    ]);
  });
});

describe('branches and loops', () => {
  const harvest = sampleTrace('harvest');

  it('if: false runs the else branch; true runs the body and skips the else part', () => {
    const no = apply(harvest, stepAt(harvest, 4, 1));
    expect(no.branch).toEqual([
      '`crop in counts` is `False`, so line 5 is skipped and the `else` branch (line 7) runs.',
    ]);
    expect(no.condition).toEqual({ expr: 'crop in counts', result: false });
    expect(no.concept).toBe(GLOSSARY.membership);
    const yes = apply(harvest, stepAt(harvest, 4, 3));
    expect(yes.branch).toEqual([
      '`crop in counts` is `True`, so the body (line 5) runs and the `else` part (lines 6–7) is skipped.',
    ]);
    expect(yes.did).toEqual(["Looked up `crop`: `'corn'`.", 'Checked `crop in counts`: it is `True`.']);
  });

  it('if / elif: a false `if` checks the `elif` next', () => {
    const s = extraTrace('extra-statements');
    expect(apply(s, stepAt(s, 9)).branch).toEqual([
      '`size > 5` is `False`, so line 10 is skipped and Python checks the `elif` on line 11 next.',
    ]);
    expect(apply(s, stepAt(s, 11)).branch).toEqual([
      '`size > 1` is `True`, so the body (line 12) runs and the `else` part (lines 13–14) is skipped.',
    ]);
  });

  it('for: iteration number and loop variable, then the end of the loop', () => {
    expect(apply(harvest, stepAt(harvest, 3, 3)).loop).toEqual([
      "Iteration 3 of the `for` loop: `crop` is now `'corn'`.",
    ]);
    expect(apply(harvest, stepAt(harvest, 3, 1)).did).toEqual([
      "Took the first item from `harvest`: `crop` is now `'corn'`.",
    ]);
    expect(apply(harvest, stepAt(harvest, 3, 6)).loop).toEqual(['The `for` loop ends after 5 iterations.']);
    const s = extraTrace('extra-statements');
    expect(apply(s, stepAt(s, 24, 2)).loop).toEqual([
      "Iteration 2 of the `for` loop: `name` is now `'beans'` and `qty` is now `0`.",
    ]);
  });

  it('while: true runs the body, false runs its `else`; passes are counted', () => {
    const s = extraTrace('extra-statements');
    expect(apply(s, stepAt(s, 16, 2)).loop).toEqual(['Iteration 2 of the `while` loop.']);
    const last = apply(s, stepAt(s, 16, 4));
    expect(last.branch).toEqual([
      '`day < LIMIT` is `False`, so the loop ends and its `else` block (line 22) runs.',
    ]);
    expect(last.loop).toEqual(['The `while` loop ends after 3 iterations; its `else` block runs.']);
  });

  it('a test right before the function returns: the frame finishes', () => {
    const o = extraTrace('extra-objects');
    expect(apply(o, stepAt(o, 2, 3)).branch).toEqual([
      '`n > 0` is `False`, so the loop ends, and with nothing after it `countdown(2)` finishes.',
    ]);
  });

  it('break, continue and pass', () => {
    const s = extraTrace('extra-statements');
    expect(apply(s, stepAt(s, 26)).did).toEqual(['`break` left the loop; Python continues at line 27.']);
    expect(apply(s, stepAt(s, 19)).did).toEqual([
      '`continue` skipped the rest of this pass; the loop goes on from line 16.',
    ]);
    expect(apply(s, stepAt(s, 20)).did).toEqual(['Did nothing: `pass` is a placeholder.']);
  });
});

describe('calls and returns', () => {
  const rec = sampleTrace('recursion');

  it('a call, a recursive call, and the returns back up', () => {
    expect(apply(rec, 1).calls).toEqual(['Called `factorial(4)` from line 6.']);
    expect(apply(rec, 1).did).toEqual(['Called `factorial(4)`.', 'Line 6 waits while it runs.']);
    expect(apply(rec, 3).concept).toBe(GLOSSARY.recursion);
    const back = stepAt(rec, 4, 4); // factorial(2) gets 1 back and returns 2
    expect(apply(rec, back).calls).toEqual(['`factorial(1)` returned `1` to line 4.']);
    expect(apply(rec, back).did).toEqual([
      'Got `1` back from `factorial(1)`.',
      'Looked up `n`: `2`.',
      'Multiplied by `factorial(n - 1)` (`1`), giving `2`.',
      '`factorial(2)` returns `2`.',
    ]);
    const end = stepAt(rec, 6, 2);
    expect(apply(rec, end).calls).toEqual(['`factorial(4)` returned `24` to line 6.']);
    expect(apply(rec, end).did).toEqual(['Got `24` back from `factorial(4)`.', 'Set `result` to `24`.']);
  });

  it('an argument that shares the caller’s list', () => {
    const t = sampleTrace('mutation-through-argument');
    const call = stepAt(t, 5, 1);
    expect(apply(t, call).calls).toEqual([
      "Called `add_crop(basket, 'wheat')` from line 5.",
      "`basket` refers to the same list as the caller's `basket`.",
    ]);
    expect(apply(t, call).concept).toBe(GLOSSARY['shared-argument']);
  });

  it('a class body, `__init__`, and a method call', () => {
    const t = sampleTrace('class-instances');
    expect(apply(t, 0).calls).toEqual(['Line 1 runs the body of class `Tractor` in a new frame.']);
    expect(apply(t, 1).did).toEqual(['The body of class `Tractor` begins.']);
    const created = stepAt(t, 1, 3);
    expect(apply(t, created).did).toEqual([
      'Created the class `Tractor`: the name `Tractor` now refers to it.',
    ]);
    const red = stepAt(t, 9, 2);
    expect(apply(t, red).did).toEqual([
      "`Tractor.__init__(…, 'Red', 100)` finished setting up the new object.",
      '`red` now refers to a new Tractor object.',
    ]);
    expect(apply(t, stepAt(t, 11, 1)).calls[0]).toBe('Called `Tractor.drive(red, 3)` from line 11.');
  });

  it('generators: started, yields, resumes, finishes', () => {
    const o = extraTrace('extra-objects');
    const start = stepAt(o, 11, 1);
    expect(apply(o, start).did).toEqual([
      'Started `countdown(2)`: it runs until it yields its first value.',
      'Line 11 waits for that value.',
    ]);
    expect(apply(o, stepAt(o, 3, 1)).did).toEqual([
      '`countdown(2)` yields `2` and pauses here until the next value is asked for.',
    ]);
    expect(apply(o, stepAt(o, 11, 2)).calls).toEqual(['`countdown(2)` yielded `2` to line 11.']);
    const done = stepAt(o, 11, 6);
    expect(apply(o, done).did[0]).toBe('`countdown(2)` finished: it has no more values.');
  });

  it('def, import, print and a builtin call', () => {
    const s = extraTrace('extra-statements');
    expect(apply(s, 0).did).toEqual(['Imported `math`.']);
    expect(apply(s, 1).did).toEqual(['Imported `sqrt` from `math`.']);
    expect(apply(s, stepAt(s, 5)).did).toEqual([
      'Defined the function `area(r)`; its body runs only when it is called.',
    ]);
    const h = sampleTrace('harvest');
    const last = h.steps.length - 1;
    expect(apply(h, last).did).toEqual([
      'Called `print(counts)`.',
      "Printed `{'corn': 3, 'wheat': 1, 'beans': 1}`.",
      'The program has finished.',
    ]);
  });
});

describe('exceptions', () => {
  const x = extraTrace('extra-exceptions');

  it('raised, then caught by a matching `except` in the same frame', () => {
    const raised = stepAt(x, 3, 1);
    expect(apply(x, raised).did).toEqual(["Line 3 raised `KeyError: 'beans'`."]);
    expect(apply(x, raised).exceptions).toEqual([
      "`KeyError: 'beans'` was raised on line 3.",
      'The `except KeyError` clause on line 4 catches it.',
    ]);
    // The step after the exception shows Python leaving the line, not the line finishing.
    expect(apply(x, raised + 1).did).toEqual([
      'Because of the exception, Python leaves line 3 and goes to line 4.',
    ]);
    const handler = stepAt(x, 4);
    expect(apply(x, handler).did).toEqual([
      'Checked whether the exception matches `KeyError`: it does, so this handler runs.',
      '`missing` now refers to the exception.',
    ]);
    expect(apply(x, handler).exceptions).toEqual([
      'The `KeyError` from line 3 is handled here: line 5 runs next.',
    ]);
  });

  it('raised in a function, passed to the caller, skipped by one clause and caught by the next', () => {
    const inside = stepAt(x, 11, 1);
    expect(apply(x, inside).exceptions[1]).toBe(
      "Nothing in `price_of('wheat')` catches it, so the exception passes up to the line that called it.",
    );
    const arrived = stepAt(x, 13, 2);
    expect(apply(x, arrived).exceptions).toEqual([
      "`KeyError: 'wheat'` came up to line 13 from the function it called.",
      'The `except KeyError` clause on line 16 catches it.',
    ]);
    expect(apply(x, stepAt(x, 14)).did).toEqual([
      "Checked whether the exception matches `ValueError`: it doesn't, so this handler is skipped.",
    ]);
    expect(apply(x, stepAt(x, 20)).did).toEqual([
      'A bare `except:` catches any exception, so this handler runs.',
    ]);
  });

  it('uncaught: the program stops; no value read is claimed on the raising line', () => {
    const t = sampleTrace('runtime-error');
    const raised = t.steps.findIndex((s) => s.py?.event === 'exception');
    expect(apply(t, raised).did).toEqual(["Line 5 raised `KeyError: 'beans'`."]);
    expect(apply(t, raised).exceptions).toEqual([
      "`KeyError: 'beans'` was raised on line 5.",
      'Nothing catches it, so the program stops.',
    ]);
    expect(apply(t, raised + 1).did).toEqual(['Nothing caught the exception, so the program stops here.']);
  });

  it("live coding's uncaught ending: the traceback isn't listed as printed output", () => {
    const text = JSON.stringify(sampleRecording('runtime-error'));
    const run = mapOutcome(
      { result: JSON.parse(text) as RunResult, killed: false, stopped: false } as never,
      sampleTrace('runtime-error').source,
      DEFAULT_LIVE_LIMITS,
      'live',
    );
    if (run.kind !== 'trace') throw new Error('expected a trace');
    const last = run.trace.steps.length - 1;
    const ex = explainBeat(run.trace, last, 'apply', 'two-beat');
    expect(ex.exceptions).toEqual([
      "`KeyError: 'beans'` was not caught, so the program stopped. Python printed the traceback in the output.",
    ]);
    expect(ex.changes).toEqual([]);
    expect(ex.did?.items[0]).toMatch(/uncaught exception/); // the ending's own narration
  });
});

describe('statements the recordings cover once', () => {
  it('try, del, assert, a comprehension that is still running', () => {
    const s = extraTrace('extra-statements');
    expect(apply(s, stepAt(s, 30)).did).toEqual(['Deleted the name `b`.']);
    expect(apply(s, stepAt(s, 31)).did).toEqual(['Checked `a == 2`: it holds, so nothing happens.']);
    const comp = stepAt(s, 27, 2);
    expect(apply(s, comp).did).toEqual(['Got `0` back from `lambda(0)`.', "Line 27 hasn't finished yet."]);
    const x = extraTrace('extra-exceptions');
    expect(apply(x, stepAt(x, 2)).did).toEqual(['Entered the `try` block (line 3).']);
  });

  it('a module-level comprehension keeps the global names on screen (recorder fix)', () => {
    const s = extraTrace('extra-statements');
    const comp = stepAt(s, 27, 1);
    const names = s.steps[comp].stack[0].variables.map((v) => v.name);
    expect(names).toEqual(expect.arrayContaining(['sqrt', 'LIMIT', 'area', 'square', 'n']));
    expect(apply(s, comp).changes?.some((r) => r.kind === 'remove')).toBe(false);
  });

  it('a line that starts two statements claims nothing about either', () => {
    const t: Trace = {
      ...pyTrace([
        { ...pyStep(0, [['f1', '<module>', {}]]), py: { event: 'line', at: 1 } },
        { ...pyStep(1, [['f1', '<module>', { a: int(1), b: int(2) }]]), py: { event: 'line', at: 2 } },
      ]),
      source: 'pass\na = 1; b = 2\n',
      statements: { '2': { kind: 'Multiple', line: 2 }, '1': { kind: 'Pass', line: 1, end: 1 } },
    };
    t.steps[1].highlightedLines = [2];
    expect(apply(t, 1).did).toEqual([]);
    expect(arrive(t, 1).did).toEqual([]);
    expect(apply(t, 1).changes).toEqual([
      { kind: 'declare', subject: '`a`', to: '1', markdown: true },
      { kind: 'declare', subject: '`b`', to: '2', markdown: true },
    ]);
  });
});

/** Two hand-built Python steps (no statement facts), for the diff-event rows. */
function pair(before: Step, after: Step): Trace {
  return pyTrace([
    { ...before, py: { event: 'line', at: 1 } },
    { ...after, index: 1, id: 's1', py: { event: 'line', at: 1 } },
  ]);
}

describe('"What changed" rows per object-diff event', () => {
  const g = (vars: Record<string, PyValue>): FrameSpec[] => [['f1', '<module>', vars]];

  it('item inserted, item removed, set member added', () => {
    const t = pair(
      pyStep(0, [...g({ xs: ref('o1'), s: ref('o2') })], { o1: list(int(1), int(3)), o2: set(int(1)) }),
      pyStep(1, [...g({ xs: ref('o1'), s: ref('o2') })], { o1: list(int(1), int(2), int(3)), o2: set(int(1), int(5)) }),
    );
    expect(apply(t, 1).changes).toEqual([
      { kind: 'add', subject: '`2` inserted into `xs` at index 1', markdown: true },
      { kind: 'add', subject: '`5` added to the set `s`', markdown: true },
    ]);
    const back = pair(t.steps[1], t.steps[0]);
    expect(apply(back, 1).changes?.[0]).toEqual({
      kind: 'remove',
      subject: '`2` removed from `xs` at index 1',
      markdown: true,
    });
  });

  it('key added and removed, value changed, reference retargeted, object released', () => {
    const before = pyStep(0, [...g({ d: ref('o1'), p: ref('o2') })], {
      o1: dict([str('a'), int(1)], [str('b'), int(2)]),
      o2: list(),
    });
    const after = pyStep(1, [...g({ d: ref('o1'), p: ref('o3') })], {
      o1: dict([str('a'), int(5)], [str('c'), int(3)]),
      o3: list(),
    });
    expect(apply(pair(before, after), 1).changes).toEqual([
      { kind: 'pointer', subject: '`p`', from: 'list o2', to: 'list o3', markdown: true },
      { kind: 'value', subject: "`d['a']`", from: '1', to: '5', markdown: true },
      { kind: 'add', subject: "Key `'c'` added to `d`", to: '3', markdown: true },
      { kind: 'remove', subject: "Key `'b'` removed from `d`", from: '2', markdown: true },
      { kind: 'alloc', subject: 'New list `p`', markdown: true },
      { kind: 'free', subject: 'Nothing on screen refers to list o2 (was `p`) any more', markdown: true },
    ]);
  });

  it('attribute set, changed and deleted; a name removed', () => {
    const before = pyStep(0, [...g({ r: ref('o1'), x: int(1) })], {
      o1: instance('Tractor', { fuel: int(100), name: str('Red') }),
    });
    const after = pyStep(1, [...g({ r: ref('o1') })], {
      o1: instance('Tractor', { fuel: int(70), speed: int(3) }),
    });
    expect(apply(pair(before, after), 1).changes).toEqual([
      { kind: 'remove', subject: '`x` was removed', from: '1', markdown: true },
      { kind: 'value', subject: '`r.fuel`', from: '100', to: '70', markdown: true },
      { kind: 'add', subject: 'Attribute `speed` set on `r`', to: '3', markdown: true },
      { kind: 'remove', subject: 'Attribute `name` removed from `r`', from: "'Red'", markdown: true },
    ]);
  });

  it('an item added through one of two names is named for both', () => {
    const t = sampleTrace('aliasing');
    expect(apply(t, 2).changes).toEqual([
      { kind: 'add', subject: '`3` added at the end of `b` (the same list as `a`)', markdown: true },
    ]);
  });

  it('a value holding a backtick is left out rather than shown wrong', () => {
    const t = pair(
      pyStep(0, [['f1', '<module>', { s: str('a') }]]),
      pyStep(1, [['f1', '<module>', { s: str('a`b') }]]),
    );
    expect(apply(t, 1).changes).toEqual([
      { kind: 'value', subject: '`s`', from: "'a'", to: "'a`b'", markdown: true },
    ]);
    const withFacts: Trace = {
      ...t,
      steps: t.steps.map((st) => ({ ...st, py: { event: 'line', at: 2 } })),
      source: 's = "a`b"\npass\n',
      statements: {
        '2': { kind: 'Pass', line: 2, end: 2 },
        '1': {
          kind: 'Assign',
          line: 1,
          end: 1,
          targets: [{ type: 'name', id: 's' }],
          value: { type: 'const', repr: "'a`b'" },
        },
      },
    };
    expect(apply(withFacts, 1).did).toEqual([]);
  });
});

describe('beats, first and last step', () => {
  const harvest = sampleTrace('harvest');

  it('arrive describes what is about to run and withholds every effect', () => {
    for (let i = 0; i < harvest.steps.length; i++) {
      const a = arrive(harvest, i);
      expect(a.changes).toBeNull();
      expect([...a.branch, ...a.loop, ...a.calls, ...a.exceptions]).toEqual([]);
      for (const s of a.did) expect(s).toMatch(/^About to /);
    }
    expect(arrive(harvest, 0).did).toEqual([
      'About to run line 1: it works out `["corn", "wheat", "corn", "beans", "corn"]` and stores the result in `harvest`.',
    ]);
  });

  it('the first step has the "nothing to compare" note; the last says the program finished', () => {
    const first = explainBeat(harvest, 0, 'apply', 'two-beat');
    expect(first.changesNote).toMatch(/nothing to compare/);
    expect(first.did?.items).toEqual(['`harvest` now refers to a new list.']);
    const last = explainBeat(harvest, harvest.steps.length - 1, 'apply', 'two-beat');
    expect(last.did?.items.at(-1)).toBe('The program has finished.');
    expect(last.next).toBeNull();
  });

  it('every step of every recording derives in both beats, and every sentence is plain', () => {
    const all = [
      ...['aliasing', 'mutation-through-argument', 'nested-containers', 'recursion', 'class-instances', 'harvest', 'runtime-error', 'infinite-loop'].map(sampleTrace),
      ...['extra-augassign', 'extra-statements', 'extra-exceptions', 'extra-objects'].map(extraTrace),
    ];
    for (const t of all) {
      t.steps.forEach((_, i) => {
        for (const d of [apply(t, i), arrive(t, i)]) {
          for (const s of [...d.did, ...d.branch, ...d.loop, ...d.calls, ...d.exceptions]) {
            expect(s, `${t.id} step ${i}`).not.toMatch(/undefined|null|NaN|\[object/);
            expect(s.includes(String.fromCharCode(0)), `${t.id} step ${i}`).toBe(false);
            expect(s.split('`').length % 2, `${t.id} step ${i}: ${s}`).toBe(1); // balanced code spans
          }
        }
      });
    }
  });
});

describe('authored text wins, section by section', () => {
  const harvest = sampleTrace('harvest');
  const i = stepAt(harvest, 4, 1);
  const authored: Trace = {
    ...harvest,
    steps: harvest.steps.map((s, k) =>
      k === i
        ? {
            ...s,
            explain: {
              did: ['Authored did.'],
              changed: ['Authored changed.'],
              branch: ['Authored branch.'],
              concept: 'Authored concept.',
            },
          }
        : s,
    ),
  };

  it('each authored section replaces only its own derived text', () => {
    const ex = explainBeat(authored, i, 'apply', 'two-beat');
    expect(ex.did).toEqual({ items: ['Authored did.'], authored: true, markdown: true });
    expect(ex.changedText).toEqual(['Authored changed.']);
    expect(ex.branch).toEqual(['Authored branch.']);
    expect(ex.concept).toBe('Authored concept.');
    // Not authored on this step: still derived.
    const plain = explainBeat(harvest, i, 'apply', 'two-beat');
    expect(plain.branch).not.toEqual(['Authored branch.']);
    expect(ex.loop).toEqual(plain.loop);
    expect(ex.calls).toEqual(plain.calls);
  });

  it('authored loop, calls and exceptions replace theirs; empty entries count as absent', () => {
    const loopStep = stepAt(harvest, 3, 2);
    const t: Trace = {
      ...harvest,
      steps: harvest.steps.map((s, k) =>
        k === loopStep ? { ...s, explain: { loop: ['Authored loop.'], calls: ['  '], exceptions: ['E.'] } } : s,
      ),
    };
    const ex = explainBeat(t, loopStep, 'apply', 'two-beat');
    expect(ex.loop).toEqual(['Authored loop.']);
    expect(ex.calls).toEqual([]); // whitespace-only authored text is ignored; nothing derived here
    expect(ex.exceptions).toEqual(['E.']);
  });

  it('on arrive, an authored breakdown is held back (no derived text replaces it)', () => {
    expect(explainBeat(authored, i, 'arrive', 'two-beat').did).toBeNull();
    expect(explainBeat(harvest, i, 'arrive', 'two-beat').did?.items).toEqual([
      'About to run line 4: it checks `crop in counts` to choose a branch.',
    ]);
  });

  it('the authored C exemplar keeps every authored section; derived branch text fills the rest', () => {
    const k = factorialTrace.steps.findIndex((s) => s.condition);
    const ex = explainBeat(factorialTrace, k, 'apply', 'two-beat');
    expect(ex.did?.authored).toBe(true);
    expect(ex.did?.items).toEqual(factorialTrace.steps[k].explain?.did);
  });
});

describe('C modules without authored text', () => {
  it('control flow: the if branch, every loop pass and the loop exit', () => {
    const t = controlFlowTrace;
    const iff = t.steps.findIndex((s) => s.condition?.expr === 'n % 2 == 0');
    expect(apply(t, iff).branch).toEqual(['`n % 2 == 0` is `true`, so line 9 runs next.']);
    const loops = t.steps
      .map((_, i) => apply(t, i).loop)
      .filter((l) => l.length > 0)
      .map((l) => l[0]);
    expect(loops).toEqual([
      'Iteration 1: `i <= n` is `true`, so the loop body runs.',
      'Iteration 2: `i <= n` is `true`, so the loop body runs.',
      'Iteration 3: `i <= n` is `true`, so the loop body runs.',
      'Iteration 4: `i <= n` is `true`, so the loop body runs.',
      '`i <= n` is `false`, so the loop ends after 4 iterations.',
    ]);
    // C has no statement facts: "What this step did" stays the authored narration.
    expect(apply(t, iff).did).toEqual([]);
    expect(explainBeat(t, iff, 'apply', 'two-beat').did?.items).toEqual([t.steps[iff].narration]);
  });

  it('recursion: calls push frames and returns pop them', () => {
    const t = sumToTrace;
    const calls = t.steps.flatMap((_, i) => apply(t, i).calls);
    expect(calls).toContain('Called `sum_to(4)`: it runs in a new frame.');
    expect(calls).toContain('`sum_to(0)` returned: its frame is popped.');
    expect(arrive(t, 1).calls).toEqual([]);
  });
});

/** The committed raw recording of a sample (for the live-ending test). */
function sampleRecording(name: string): unknown {
  return RAW[`../../python/fixtures/${name}.json`] ? JSON.parse(RAW[`../../python/fixtures/${name}.json`]) : null;
}
const RAW = import.meta.glob<string>('../../python/fixtures/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});
