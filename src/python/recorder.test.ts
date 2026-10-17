/**
 * Recorder tests: the real `recorder.py` inside the real Pyodide, in Node. Pyodide's npm package
 * ships the interpreter and the standard library, so this needs no network (no packages are loaded).
 *
 * Every sample is also written to `fixtures/<name>.json` (a file snapshot; `vitest -u` refreshes it),
 * which the mapping tests consume without Pyodide.
 */
import { loadPyodide } from 'pyodide';
import { beforeAll, describe, expect, it } from 'vitest';
import packageJson from '../../package.json?raw';
import recorderSource from './recorder.py?raw';
import type { PySnapshot, PyValue, RunResult } from './protocol.ts';
import { SAMPLES } from './samples/index.ts';
import { createRecorderSession, type RecorderSession } from './session.ts';
import { EXTRA_PROGRAMS } from './testPrograms.ts';
import { PYODIDE_VERSION } from './version.ts';

let session: RecorderSession;
let runtimeVersion = '';

beforeAll(async () => {
  const pyodide = await loadPyodide();
  runtimeVersion = pyodide.version;
  session = createRecorderSession(pyodide, recorderSource);
}, 60_000);

const sample = (name: string) => {
  const s = SAMPLES.find((x) => x.name === name);
  if (!s) throw new Error(name);
  return s;
};
const record = (name: string): RunResult => session.run(sample(name).request);

/** `name -> ref id or repr` for the top... of a given frame, for compact assertions. */
function vars(snap: PySnapshot, frameIndex = snap.frames.length - 1): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of snap.frames[frameIndex].vars) out[v.name] = show(v.value);
  return out;
}
function show(v: PyValue): string {
  return v.kind === 'ref' ? v.id : v.repr;
}

describe('pinned version', () => {
  it('the runtime, the npm pin and the CDN constant agree', () => {
    const pkg = JSON.parse(packageJson) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies.pyodide).toBe(PYODIDE_VERSION);
    expect(runtimeVersion).toBe(PYODIDE_VERSION);
  });
});

describe('samples record correctly', () => {
  it.each(SAMPLES.map((s) => [s.name]))('%s matches its committed fixture', async (name) => {
    const result = record(name);
    await expect(`${JSON.stringify(result, null, 1)}\n`).toMatchFileSnapshot(
      `./fixtures/${name}.json`,
    );
  });

  it.each(EXTRA_PROGRAMS.map((p) => [p.name, p.request] as const))(
    '%s matches its committed fixture',
    async (name, request) => {
      const result = session.run(request);
      expect(result.error).toBeUndefined();
      await expect(`${JSON.stringify(result, null, 1)}\n`).toMatchFileSnapshot(
        `./fixtures/${name}.json`,
      );
    },
  );

  it('produces the expected number of snapshots per sample', () => {
    const counts = Object.fromEntries(SAMPLES.map((s) => [s.name, record(s.name).steps.length]));
    expect(counts).toEqual({
      aliasing: 4, // lines 1–3, module return
      'mutation-through-argument': 8, // def, 4, 5, call, 2, return, 6, module return
      'nested-containers': 5,
      recursion: 20, // 4 calls × (call, line 2, line 3|4) + 4 returns + lines 1, 6, 7 + return
      'class-instances': 21,
      harvest: 20, // 1, 2, 5 × (for, if, assign), loop exit, print, return
      'runtime-error': 11, // ... the third item raises: exception, then the module unwinds
      'syntax-error': 0,
      'infinite-loop': 40, // the fixture's step cap
    });
  });

  it('every reference resolves within its snapshot, and ids are o1, o2, ... in first-seen order', () => {
    for (const s of [...SAMPLES.map((x) => x.request), ...EXTRA_PROGRAMS.map((x) => x.request)]) {
      const result = session.run(s);
      const firstSeen: string[] = [];
      for (const snap of result.steps) {
        const refs: string[] = [];
        const visit = (v: PyValue | undefined) => {
          if (v?.kind === 'ref') refs.push(v.id);
        };
        snap.frames.forEach((f) => f.vars.forEach((v) => visit(v.value)));
        visit(snap.returnValue);
        for (const obj of Object.values(snap.objects)) {
          if ('items' in obj) obj.items.forEach(visit);
          if (obj.kind === 'dict') obj.entries.forEach((e) => (visit(e.key), visit(e.value)));
          if (obj.kind === 'instance') obj.attrs.forEach((a) => visit(a.value));
        }
        for (const id of refs) expect(snap.objects[id], `${id} in ${s.source}`).toBeDefined();
        for (const id of Object.keys(snap.objects)) if (!firstSeen.includes(id)) firstSeen.push(id);
      }
      const numbers = firstSeen.map((id) => Number(id.slice(1)));
      expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    }
  });
});

describe('identity and aliasing', () => {
  it('aliasing: two names, one object, mutated in place', () => {
    const { steps } = record('aliasing');
    expect(vars(steps[2])).toEqual({ a: 'o1', b: 'o1' });
    const last = steps[steps.length - 1];
    expect(vars(last)).toEqual({ a: 'o1', b: 'o1' });
    expect(Object.keys(last.objects)).toEqual(['o1']);
    expect(last.objects.o1).toMatchObject({
      kind: 'list',
      items: [{ repr: '1' }, { repr: '2' }, { repr: '3' }],
    });
  });

  it('mutation through an argument: the callee and the caller see the same object', () => {
    const { steps, stdout } = record('mutation-through-argument');
    const call = steps.find((s) => s.event === 'call');
    expect(call?.frames.map((f) => f.name)).toEqual(['<module>', 'add_crop']);
    expect(vars(call!, 0).basket).toBe(vars(call!, 1).basket);
    const ret = steps.find((s) => s.event === 'return' && s.frames.length === 2)!;
    const id = vars(ret, 1).basket;
    expect(ret.objects[id]).toMatchObject({ items: [{ repr: "'corn'" }, { repr: "'wheat'" }] });
    expect(ret.returnValue).toEqual({ kind: 'prim', type: 'NoneType', repr: 'None' });
    expect(stdout).toBe("['corn', 'wheat']\n");
  });

  it('nested containers: inner lists and dicts are their own objects', () => {
    const { steps } = record('nested-containers');
    const last = steps[steps.length - 1];
    const fields = last.objects[vars(last).fields];
    expect(fields).toMatchObject({
      kind: 'dict',
      entries: [{ key: { repr: "'north'" } }, { key: { repr: "'south'" } }],
    });
    const animals = last.objects[vars(last).animals];
    expect(animals.kind).toBe('list');
    const second = animals.kind === 'list' ? animals.items[1] : null;
    expect(second?.kind).toBe('ref');
    if (second?.kind === 'ref') {
      expect(last.objects[second.id]).toMatchObject({
        kind: 'dict',
        entries: [{}, { value: { repr: "'sheep'" } }],
      });
    }
  });

  it('recursion: one frame id per activation, stable while it lives', () => {
    const { steps, stdout } = record('recursion');
    const deepest = steps.reduce((a, s) => (s.frames.length > a.frames.length ? s : a));
    expect(deepest.frames.map((f) => `${f.id}:${f.name}`)).toEqual([
      'f1:<module>',
      'f2:factorial',
      'f3:factorial',
      'f4:factorial',
      'f5:factorial',
    ]);
    expect(deepest.frames.slice(1).map((f) => vars(deepest, deepest.frames.indexOf(f)).n)).toEqual([
      '4',
      '3',
      '2',
      '1',
    ]);
    const returns = steps.filter((s) => s.event === 'return' && s.returnValue);
    expect(returns.map((s) => s.returnValue && show(s.returnValue))).toEqual(['1', '2', '6', '24']);
    expect(stdout).toBe('24\n');
  });

  it('class instances: two instances, a method changes one attribute in place', () => {
    const { steps } = record('class-instances');
    const last = steps[steps.length - 1];
    expect(vars(last)).toEqual({ Tractor: 'o2', red: 'o3', blue: 'o4' });
    expect(last.objects.o2).toEqual({ kind: 'class', type: 'type', name: 'Tractor' });
    expect(last.objects.o3).toMatchObject({
      kind: 'instance',
      type: 'Tractor',
      attrs: [{ name: 'name' }, { name: 'fuel', value: { repr: '70' } }],
    });
    expect(last.objects.o4).toMatchObject({ attrs: [{}, { name: 'fuel', value: { repr: '80' } }] });
    const drive = steps.find((s) => s.frames.some((f) => f.name === 'drive'))!;
    expect(vars(drive).self).toBe('o3');
  });

  it('harvest: the counts dict is updated in place on every iteration', () => {
    const { steps, stdout } = record('harvest');
    const ids = new Set(steps.filter((s) => 'counts' in vars(s)).map((s) => vars(s).counts));
    expect([...ids]).toEqual(['o2']);
    expect(stdout).toBe("{'corn': 3, 'wheat': 1, 'beans': 1}\n");
  });
});

describe('errors', () => {
  it('runtime error mid-loop: KeyError on the third item, state kept up to it', () => {
    const result = record('runtime-error');
    expect(result.error).toMatchObject({ type: 'KeyError', message: "'beans'", line: 5 });
    expect(result.error?.traceback).toContain('File "<student>", line 5, in <module>');
    const exc = result.steps.find((s) => s.event === 'exception');
    expect(exc?.exception).toEqual({ type: 'KeyError', message: "'beans'" });
    expect(vars(exc!)).toMatchObject({ total: '5', item: "'beans'" });
    expect(result.steps[result.steps.length - 1]).toMatchObject({
      event: 'return',
      unwinding: true,
    });
    expect(result.truncated).toBeUndefined();
  });

  it('syntax error: no steps, the error with its line', () => {
    const result = record('syntax-error');
    expect(result.steps).toEqual([]);
    expect(result.error).toMatchObject({ type: 'SyntaxError', line: 1 });
  });
});

describe('limits never hang', () => {
  it('infinite loop: stops at exactly the default 1000 steps', () => {
    const result = session.run({ source: sample('infinite-loop').request.source });
    expect(result.truncated).toBe('steps');
    expect(result.steps).toHaveLength(1000);
    expect(result.error).toBeUndefined();
  });

  it('a one-line infinite loop also hits the step limit', () => {
    const result = session.run({ source: 'while True: pass\n' });
    expect(result.truncated).toBe('steps');
    expect(result.steps).toHaveLength(1000);
  });

  it('infinite loop with a huge step cap: the recorder stops itself on the time limit', () => {
    const t0 = performance.now();
    const result = session.run({
      source: sample('infinite-loop').request.source,
      limits: { maxSteps: 10_000_000, timeoutMs: 200 },
    });
    expect(result.truncated).toBe('time');
    expect(performance.now() - t0).toBeLessThan(5000);
  });

  it('deep recursion ends with a RecursionError at the depth limit', () => {
    const result = session.run({
      source: 'def dig(n):\n    return dig(n + 1)\n\ndig(0)\n',
      limits: { maxDepth: 50 },
    });
    expect(result.error).toMatchObject({ type: 'RecursionError' });
    expect(result.truncated).toBeUndefined();
    expect(Math.max(...result.steps.map((s) => s.frames.length))).toBe(50);
  });

  it('deep recursion with the default limits stops (steps or depth), never hangs', () => {
    const result = session.run({ source: 'def dig(n):\n    return dig(n + 1)\n\ndig(0)\n' });
    expect(result.truncated === 'steps' || result.error?.type === 'RecursionError').toBe(true);
  });

  it('stdout is capped at maxStdoutLines complete lines', () => {
    const result = session.run({
      source: 'i = 0\nwhile True:\n    print(i)\n    i += 1\n',
      limits: { maxStdoutLines: 5, maxSteps: 100_000 },
    });
    expect(result.truncated).toBe('stdout');
    expect(result.stdout).toBe('0\n1\n2\n3\n4\n');
    expect(result.steps.every((s) => s.event !== 'exception')).toBe(true);
  });
});

describe('input, imports, values', () => {
  it('input() reads the supplied lines, echoes them, then raises EOFError', () => {
    const result = session.run({
      source: 'name = input("name? ")\nagain = input()\nmore = input()\n',
      stdin: ['Ada', 'Bob'],
    });
    expect(result.stdout).toBe('name? Ada\nBob\n');
    expect(result.error).toMatchObject({ type: 'EOFError', line: 3 });
  });

  it('student code cannot import the JS bridge', () => {
    for (const source of [
      'import js\n',
      'from pyodide.http import open_url\n',
      'import micropip\n',
    ]) {
      expect(session.run({ source }).error?.type).toBe('ImportError');
    }
    expect(session.run({ source: 'import math\nx = math.sqrt(16)\n' }).error).toBeUndefined();
  });

  it('skips dunders and modules; caps reprs at 80 characters', () => {
    const result = session.run({
      source: 'import math\nlong = "x" * 200\nbig = 10 ** 5000\nend = 1\n',
    });
    const last = result.steps[result.steps.length - 1];
    expect(last.frames[0].vars.map((v) => v.name)).toEqual(['long', 'big', 'end']);
    const long = last.frames[0].vars[0].value;
    expect(long).toMatchObject({ kind: 'prim', truncated: true });
    expect(long.kind === 'prim' && long.repr.length).toBe(80);
    expect(last.frames[0].vars[1].value).toMatchObject({ repr: '<int with 16610 bits>' });
  });

  it('functions record their parameters; sets are sorted', () => {
    const result = session.run({ source: 'f = lambda a, *rest, k=1, **kw: a\ns = {10, 3, 2}\n' });
    const last = result.steps[result.steps.length - 1];
    expect(Object.values(last.objects)).toEqual([
      { kind: 'function', type: 'function', name: '<lambda>', params: ['a', '*rest', 'k', '**kw'] },
      {
        kind: 'set',
        type: 'set',
        items: [
          { kind: 'prim', type: 'int', repr: '2' },
          { kind: 'prim', type: 'int', repr: '3' },
          { kind: 'prim', type: 'int', repr: '10' },
        ],
      },
    ]);
  });

  it('runs are independent (fresh globals each time)', () => {
    session.run({ source: 'leftover = 1\n' });
    expect(session.run({ source: 'print(leftover)\n' }).error?.type).toBe('NameError');
  });
});

describe('streaming and the size budget (Phase 31)', () => {
  type Chunk = { snaps: PySnapshot[]; total: number; stop: string | undefined };
  const recordStreamed = (request: Parameters<RecorderSession['run']>[0]) => {
    const chunks: Chunk[] = [];
    const result = session.run(request, (chunk, total, stop) =>
      chunks.push({ snaps: JSON.parse(chunk) as PySnapshot[], total, stop }),
    );
    return { result, chunks, streamed: chunks.flatMap((c) => c.snaps) };
  };

  it('streams every snapshot of a run that hits the step limit, with the reason on the last chunk', () => {
    const { result, chunks, streamed } = recordStreamed({
      source: sample('infinite-loop').request.source,
      limits: { maxSteps: 450 },
    });
    expect(result.truncated).toBe('steps');
    expect(streamed).toEqual(result.steps);
    expect(chunks.length).toBeGreaterThan(1); // at most 200 snapshots per chunk
    expect(chunks.every((c) => c.snaps.length <= 200)).toBe(true);
    expect(chunks[chunks.length - 1]).toMatchObject({ total: 450, stop: 'steps' });
    expect(chunks.slice(0, -1).every((c) => c.stop === undefined)).toBe(true);
  });

  it('streaming does not change the result', () => {
    for (const s of SAMPLES) {
      expect(recordStreamed(s.request).result).toEqual(session.run(s.request));
    }
  });

  it('a stop the program swallows (bare except) was still streamed with its reason', () => {
    // The step limit stops the program; the bare `except:` catches the stop, tracing is off, and
    // the program finishes untraced. The steps and the reason are kept.
    const { result, chunks, streamed } = recordStreamed({
      source: 'try:\n    while True:\n        pass\nexcept:\n    pass\nafter = 1\n',
      limits: { maxSteps: 30 },
    });
    expect(result.truncated).toBe('steps');
    expect(streamed).toHaveLength(30);
    expect(chunks[chunks.length - 1].stop).toBe('steps');
  });

  it('the size budget stops a run whose snapshots grow too large', () => {
    const source = 'big = list(range(100))\nwhile True:\n    big[0] = big[0] + 1\n';
    const result = session.run({ source, limits: { maxTraceChars: 50_000, maxSteps: 5000 } });
    expect(result.truncated).toBe('size');
    expect(JSON.stringify(result.steps).length).toBeLessThan(55_000);
    expect(result.steps.length).toBeGreaterThan(10);
  });

  it('deep recursion at a 100-frame cap stays well under the size budget', () => {
    const result = session.run({
      source: 'def dig(n):\n    return dig(n + 1)\n\ndig(0)\n',
      limits: { maxDepth: 100 },
    });
    expect(result.error).toMatchObject({ type: 'RecursionError' });
    expect(JSON.stringify(result).length).toBeLessThan(2_000_000);
  });
});
