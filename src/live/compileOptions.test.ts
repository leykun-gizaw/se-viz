/**
 * Compile-options tests — flag assembly, the single-dialect rule, and storage rehydration.
 *
 * The stakes: this module is the only thing standing between a stale `localStorage` value and a
 * request the backend rejects with a 400, so the rehydration cases matter as much as the happy path.
 */
import { describe, expect, it } from 'vitest';
import {
  COMPILE_FLAGS_KEY,
  DEFAULT_FLAGS,
  DIALECT_CHOICES,
  TOGGLE_CHOICES,
  dialectOf,
  gccCommandLine,
  hasFlag,
  normalizeFlags,
  parseStoredFlags,
  setDialect,
  setToggle,
  toggleCount,
  type CompileFlag,
} from './compileOptions.ts';

/** The backend allowlist (se-viz-tracer docs/API.md, Phase 08). The UI must never exceed it. */
const BACKEND_ALLOWLIST = [
  '-Wall',
  '-Wextra',
  '-Werror',
  '-pedantic',
  '-std=gnu89',
  '-std=c11',
] as const;

describe('the UI flag set mirrors the backend allowlist', () => {
  it('offers only flags the backend accepts', () => {
    const offered = [...TOGGLE_CHOICES, ...DIALECT_CHOICES].map((c) => c.flag);
    for (const flag of offered) expect(BACKEND_ALLOWLIST).toContain(flag);
  });

  it('offers every flag the backend accepts (no silent gap)', () => {
    const offered = new Set([...TOGGLE_CHOICES, ...DIALECT_CHOICES].map((c) => c.flag));
    for (const flag of BACKEND_ALLOWLIST) expect(offered.has(flag)).toBe(true);
  });

  it('gives every option a plain-language gloss — the flag alone teaches nothing', () => {
    for (const c of [...TOGGLE_CHOICES, ...DIALECT_CHOICES]) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.gloss.length).toBeGreaterThan(10);
    }
  });

  it('namespaces the storage key', () => {
    expect(COMPILE_FLAGS_KEY).toBe('seviz.live.compileFlags');
  });
});

describe('flag assembly', () => {
  it('defaults to -Wall -Wextra with the C11 dialect', () => {
    expect(normalizeFlags(DEFAULT_FLAGS)).toEqual(['-Wall', '-Wextra', '-std=c11']);
  });

  it('all warnings off still carries a dialect', () => {
    expect(normalizeFlags(['-std=c11'])).toEqual(['-std=c11']);
  });

  it('emits a stable order regardless of how the selection was built', () => {
    const a = normalizeFlags(['-std=c11', '-pedantic', '-Wall']);
    const b = normalizeFlags(['-Wall', '-pedantic', '-std=c11']);
    expect(a).toEqual(['-Wall', '-pedantic', '-std=c11']);
    expect(a).toEqual(b);
  });

  it('de-duplicates repeats', () => {
    expect(normalizeFlags(['-Wall', '-Wall', '-Wall', '-std=c11'])).toEqual(['-Wall', '-std=c11']);
  });

  it('switching dialect REPLACES rather than appends (the backend rejects two -std=)', () => {
    const next = setDialect(DEFAULT_FLAGS, '-std=gnu89');
    expect(next).toEqual(['-Wall', '-Wextra', '-std=gnu89']);
    expect(next.filter((f) => f.startsWith('-std=')).length).toBe(1);

    const back = setDialect(next, '-std=c11');
    expect(back).toEqual(['-Wall', '-Wextra', '-std=c11']);
    expect(back.filter((f) => f.startsWith('-std=')).length).toBe(1);
  });

  it('never emits two dialects even if handed both', () => {
    const out = normalizeFlags(['-std=gnu89', '-std=c11'] as CompileFlag[]);
    expect(out.filter((f) => f.startsWith('-std=')).length).toBe(1);
  });

  it('toggles on and off without disturbing the rest', () => {
    const on = setToggle(DEFAULT_FLAGS, '-Werror', true);
    expect(on).toEqual(['-Wall', '-Wextra', '-Werror', '-std=c11']);
    expect(setToggle(on, '-Werror', false)).toEqual(['-Wall', '-Wextra', '-std=c11']);
  });

  it('toggling on twice is idempotent', () => {
    const once = setToggle(DEFAULT_FLAGS, '-pedantic', true);
    expect(setToggle(once, '-pedantic', true)).toEqual(once);
  });

  it('reports the dialect and the toggle count', () => {
    expect(dialectOf(DEFAULT_FLAGS)).toBe('-std=c11');
    expect(dialectOf(['-Wall', '-std=gnu89'])).toBe('-std=gnu89');
    expect(toggleCount(DEFAULT_FLAGS)).toBe(2); // the dialect is not a "warning" toggle
    expect(toggleCount(['-std=c11'])).toBe(0);
    expect(hasFlag(DEFAULT_FLAGS, '-Wall')).toBe(true);
    expect(hasFlag(DEFAULT_FLAGS, '-Werror')).toBe(false);
  });

  it('renders the command shape for the student', () => {
    expect(gccCommandLine(DEFAULT_FLAGS)).toBe('gcc -Wall -Wextra -std=c11 …');
  });
});

describe('storage rehydration falls back rather than posting junk', () => {
  it('round-trips a valid stored selection', () => {
    const stored = JSON.parse(JSON.stringify(['-Wall', '-Werror', '-std=gnu89'])) as unknown;
    expect(parseStoredFlags(stored)).toEqual(['-Wall', '-Werror', '-std=gnu89']);
  });

  it('falls back when the value contains an unknown flag', () => {
    expect(parseStoredFlags(['-Wall', '-fsanitize=address', '-std=c11'])).toEqual([
      ...DEFAULT_FLAGS,
    ]);
    expect(parseStoredFlags(['-O2', '-std=c11'])).toEqual([...DEFAULT_FLAGS]);
    expect(parseStoredFlags(['-Wall; rm -rf /'])).toEqual([...DEFAULT_FLAGS]);
  });

  it('falls back when the value is not an array', () => {
    for (const v of ['-Wall', 42, true, null, undefined, {}, { flags: ['-Wall'] }]) {
      expect(parseStoredFlags(v)).toEqual([...DEFAULT_FLAGS]);
    }
  });

  it('falls back when an entry is not a string', () => {
    expect(parseStoredFlags(['-Wall', 7, '-std=c11'])).toEqual([...DEFAULT_FLAGS]);
    expect(parseStoredFlags([['-Wall'], '-std=c11'])).toEqual([...DEFAULT_FLAGS]);
  });

  it('falls back when the stored value has no dialect (not something the UI can produce)', () => {
    expect(parseStoredFlags(['-Wall', '-Wextra'])).toEqual([...DEFAULT_FLAGS]);
    expect(parseStoredFlags([])).toEqual([...DEFAULT_FLAGS]);
  });

  it('falls back on malformed JSON, as the hook hands it to us', () => {
    // usePersistentState swallows the parse error and yields the initial value; if a caller ever
    // passes the raw string through instead, that is still not an array ⇒ defaults.
    let raw: unknown;
    try {
      raw = JSON.parse('{not json');
    } catch {
      raw = '{not json';
    }
    expect(parseStoredFlags(raw)).toEqual([...DEFAULT_FLAGS]);
  });

  it('canonicalizes a valid-but-oddly-ordered stored value', () => {
    expect(parseStoredFlags(['-std=gnu89', '-Wextra', '-Wall'])).toEqual([
      '-Wall',
      '-Wextra',
      '-std=gnu89',
    ]);
  });

  it('every fallback result is itself a legal request body', () => {
    for (const bad of [null, ['-O2'], 'x', {}, ['-Wall']]) {
      const out = parseStoredFlags(bad);
      expect(out.every((f) => (BACKEND_ALLOWLIST as readonly string[]).includes(f))).toBe(true);
      expect(out.filter((f) => f.startsWith('-std=')).length).toBe(1);
    }
  });
});
