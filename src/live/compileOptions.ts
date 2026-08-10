/**
 * Compile options for Live Coding — the pure half of the flag picker (Phase 25).
 *
 * The student ticks boxes; this module turns that into the `flags` array the tracer's `POST /trace`
 * accepts. It mirrors the backend allowlist **exactly** (se-viz-tracer `docs/API.md`, Phase 08): the
 * backend rejects anything else with a `400 invalid_request`, so the UI's job is to make only
 * representable-and-valid combinations reachable. Two rules follow from that:
 *
 * - the dialect is a **single choice**, because the backend rejects two `-std=` values;
 * - anything read back from storage is **re-validated** here before it can reach a request.
 *
 * Kept React-free so it is unit-testable in the repo's node test environment.
 *
 * @packageDocumentation
 */

/** A warning/diagnostic flag the student can toggle independently. */
export type ToggleFlag = '-Wall' | '-Wextra' | '-Werror' | '-pedantic';

/** A language standard. Exactly one is always applied. */
export type DialectFlag = '-std=gnu89' | '-std=c11';

/** Any flag this UI can produce — a subset check against the backend allowlist. */
export type CompileFlag = ToggleFlag | DialectFlag;

export interface FlagChoice<T extends CompileFlag> {
  flag: T;
  label: string;
  /** One-line plain-language gloss. Students are learning what these *mean*. */
  gloss: string;
}

/**
 * The toggles, in the order they render and in the order they are emitted. This is also the
 * backend's canonical order, so the flags we send come back echoed unchanged.
 */
export const TOGGLE_CHOICES: readonly FlagChoice<ToggleFlag>[] = [
  {
    flag: '-Wall',
    label: 'All common warnings',
    gloss: 'The everyday checks — unused variables, missing returns, suspicious comparisons.',
  },
  {
    flag: '-Wextra',
    label: 'Extra warnings',
    gloss: 'The stricter checks -Wall leaves out, like unused function parameters.',
  },
  {
    flag: '-Werror',
    label: 'Treat warnings as errors',
    gloss: 'Nothing runs until every warning is fixed — how Betty grades you.',
  },
  {
    flag: '-pedantic',
    label: 'Strict ISO conformance',
    gloss: 'Warn about anything the C standard does not strictly allow.',
  },
];

/** The dialect radio group. `-std=c11` is the recorder's own default and ours. */
export const DIALECT_CHOICES: readonly FlagChoice<DialectFlag>[] = [
  {
    flag: '-std=c11',
    label: 'C11',
    gloss: 'Modern C. Allows declarations inside a for-loop header.',
  },
  {
    flag: '-std=gnu89',
    label: 'gnu89',
    gloss: 'What Betty enforces. Declarations must come first — no for (int i = 0; …).',
  },
];

export const DEFAULT_DIALECT: DialectFlag = '-std=c11';

/**
 * Defaults: warnings **surfaced** but never blocking. `-Werror` is opt-in on purpose — with it a
 * single warning replaces the animation with a compiler-output panel, which is what you want when
 * rehearsing Betty and punishing as a beginner's default.
 */
export const DEFAULT_FLAGS: readonly CompileFlag[] = ['-Wall', '-Wextra', DEFAULT_DIALECT];

/** localStorage key. Namespaced like the other persisted UI preferences. */
export const COMPILE_FLAGS_KEY = 'seviz.live.compileFlags';

const TOGGLE_FLAGS: readonly ToggleFlag[] = TOGGLE_CHOICES.map((c) => c.flag);
const DIALECT_FLAGS: readonly DialectFlag[] = DIALECT_CHOICES.map((c) => c.flag);

const isToggleFlag = (v: unknown): v is ToggleFlag =>
  typeof v === 'string' && (TOGGLE_FLAGS as readonly string[]).includes(v);

const isDialectFlag = (v: unknown): v is DialectFlag =>
  typeof v === 'string' && (DIALECT_FLAGS as readonly string[]).includes(v);

/** Is this flag currently selected? */
export function hasFlag(flags: readonly CompileFlag[], flag: CompileFlag): boolean {
  return flags.includes(flag);
}

/** The dialect in a selection (there is always exactly one after {@link normalizeFlags}). */
export function dialectOf(flags: readonly CompileFlag[]): DialectFlag {
  return flags.find(isDialectFlag) ?? DEFAULT_DIALECT;
}

/**
 * Canonicalize a selection: toggles in declaration order, then exactly one dialect. De-duplicates,
 * drops extra dialects (first wins), and always terminates with a dialect — so the same choices
 * always serialize to the same array and the request body is stable.
 */
export function normalizeFlags(flags: readonly CompileFlag[]): CompileFlag[] {
  const selected = TOGGLE_FLAGS.filter((f) => flags.includes(f));
  return [...selected, dialectOf(flags)];
}

/** Turn a toggle on or off, returning a new canonical selection. */
export function setToggle(
  flags: readonly CompileFlag[],
  flag: ToggleFlag,
  on: boolean,
): CompileFlag[] {
  const kept = flags.filter((f) => f !== flag);
  return normalizeFlags(on ? [...kept, flag] : kept);
}

/** Replace the dialect (never append a second one — the backend would reject that). */
export function setDialect(flags: readonly CompileFlag[], dialect: DialectFlag): CompileFlag[] {
  return normalizeFlags([...flags.filter((f) => !isDialectFlag(f)), dialect]);
}

/**
 * Validate a value read back from `localStorage`. A stale key from an older build, a hand-edited
 * value, or anything non-array falls back to {@link DEFAULT_FLAGS} — an unknown flag must never
 * reach a request, because the backend would 400 and the student would see a broken tool.
 */
export function parseStoredFlags(raw: unknown): CompileFlag[] {
  if (!Array.isArray(raw)) return [...DEFAULT_FLAGS];
  const entries: unknown[] = raw;
  if (!entries.every((f) => isToggleFlag(f) || isDialectFlag(f))) return [...DEFAULT_FLAGS];
  // A selection with no dialect is not something the UI can produce; treat it as corrupt rather
  // than silently compiling with a standard the student did not pick.
  if (!entries.some(isDialectFlag)) return [...DEFAULT_FLAGS];
  return normalizeFlags(entries as CompileFlag[]);
}

/** How many diagnostic toggles are on — the count on the trigger button. */
export function toggleCount(flags: readonly CompileFlag[]): number {
  return TOGGLE_FLAGS.filter((f) => flags.includes(f)).length;
}

/**
 * The compile command shape to show beside the result. The pinned tracing flags are the recorder's
 * and are not ours to change, so they appear as a trailing `…` rather than being spelled out as if
 * the student chose them.
 */
export function gccCommandLine(flags: readonly CompileFlag[]): string {
  return `gcc ${normalizeFlags(flags).join(' ')} …`;
}
