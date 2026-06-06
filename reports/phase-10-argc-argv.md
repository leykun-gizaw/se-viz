# Phase 10 Report — argc / argv

## 1. Summary
This phase adds the SE 200 (week 7) **argc, argv** content as two hand-authored, auto-discovered
trace modules under `src/content/se200/argc-argv/`. Together they teach the argument vector for a
concrete command line (`./prog hello 42`): its `argc` count, the array of `char *` slots each
arrowing into a separate NUL-terminated string, the `argv[argc] == NULL` terminator, and the
idiomatic loop that prints every argument. No engine, renderer, format, doc, test, or fixture file
was touched. All four gates (typecheck, lint, test, build) pass; `validateTrace` runs over the whole
catalog in the test suite and is green.

## 2. What I built
- `src/content/se200/argc-argv/structure.ts` — trace `se200-argv-structure`. The **shape** of the
  argument vector for `./prog hello 42`: `argc = 3`; `argv` as an `ArrayCell` of four `char *` slots
  (three pointing into char buffers, one NULL); each buffer rendered with its chars and the dashed
  `\0`; steps that focus argc, each `argv[i]`, a string's NUL terminator, and the NULL entry.
- `src/content/se200/argc-argv/iterate.ts` — trace `se200-argv-iterate`. The **iteration** loop
  `for (i = 0; i < argc; i++) printf("%s\n", argv[i]);` walking the pointer array; each pass shows the
  loop test as a `condition` chip (`i < argc`), highlights the active slot, and grows the console
  output to `./prog` / `hello` / `42`.

Both default-export a `ContentModule` (course `SE 200`, topic `argc, argv`) so the catalog
auto-discovers them with no shared-file edit.

## 3. Acceptance criteria — self-assessment
From `prompts/phase-10-argc-argv.md`:

- [x] **A module showing `argc`/`argv` structure for a concrete command line, per-arg
  pointer→string arrows with visible `\0`, the `NULL` terminator entry, and an iteration loop
  printing the args.** — `structure.ts` covers `argc`/`argv` structure, per-arg `char *` slots that
  target each buffer's first char (arrows), the visible `\0` (dashed NUL element) in each buffer, and
  the `argv[3] == argv[argc] == NULL` slot (target `null`, no arrow). `iterate.ts` covers the
  printing loop with the `i < argc` condition chip and cumulative `stdout`.
- [x] **The shape of `main(int argc, char *argv[])`** — modeled in both files: `argc` is an `int`
  scalar; `argv` is an `ArrayCell` of `char *` whose elements target separate char buffers; the last
  element is `NULL`.
- [x] **Indexing the args** — `structure.ts` walks `argv[0]` (program name), `argv[1]`, `argv[2]`
  step by step, each as a pointer slot whose arrow lands on its own char array.
- [x] **Iterating** — `iterate.ts`'s loop with `Step.condition = { expr: 'i < argc', result }` per
  pass; output to the console panel.
- [x] **`argv[i]` are strings even when numeric-looking** — called out for `"42"` in both files
  (structure step `argv2`, iterate step `print-2`).
- [x] **Addresses, the pointer array, and printed output verified correct (report §4); auto-discovered
  + passes `validateTrace`; no shared-file edits; no format/renderer/design change.** — see §4/§5/§6.
- [x] **Metadata sourced from CURRICULUM.md** — course `SE 200`, topic `argc, argv` (SE 200 week 7
  row, verified verbatim), `covers: ['SE200: argc, argv']`.

## 4. How to run & verify
Gates (run in the worktree `/private/tmp/seviz-phase10`):

```
npm run typecheck   # tsc -b --noEmit            -> clean
npm run lint        # eslint .                    -> clean
npm run test        # vitest run                  -> 6 files, 45 tests passed
npm run build       # vite build                  -> built OK
```

In `npm run dev`, the sidebar shows **SE 200 › argc, argv** with two modules: *argc / argv
structure* and *argv iteration*. Step through each and watch the slot→string arrows, the dashed
`\0`, the NULL slot, the `i < argc` condition chip, and the console output.

**Correctness — hand-trace for `./prog hello 42`:**
- `argc = 3` (three whitespace-separated tokens; the program name counts).
- `argv[0]` → `"./prog"` = `'.','/','p','r','o','g','\0'` → 6 chars + NUL = **7 bytes**.
- `argv[1]` → `"hello"`  = `'h','e','l','l','o','\0'`     → 5 chars + NUL = **6 bytes**.
- `argv[2]` → `"42"`     = `'4','2','\0'`                 → 2 chars + NUL = **3 bytes** (the
  string `"42"`, not the integer 42 — a common beginner trap, called out in both modules).
- `argv[3] == argv[argc] == NULL` (target `null`; no outgoing arrow).
- Buffer byte counts match each `char[N]` type label and the ascending 1-byte char addresses.

**Loop / output trace** (`for (i=0; i<argc; i++) printf("%s\n", argv[i])`):
- i=0: `0 < 3` true → print `./prog`
- i=1: `1 < 3` true → print `hello`
- i=2: `2 < 3` true → print `42`
- i=3: `3 < 3` false → loop ends

Console output, three lines: `./prog`, `hello`, `42`. The `condition.result` flags in `iterate.ts`
(`true, true, true, false`) match these tests exactly, and the cumulative `stdout` arrays match the
emitted lines.

These are determinate and small enough to verify by hand; I cross-checked the char-counts and the
loop tests by enumeration. (Note: the sandbox blocked the throwaway `gcc`/`node` cross-check run I
attempted; the values above are trivially hand-verifiable, e.g. `strlen("./prog") == 6`, so the
buffer is 7 bytes, etc.)

Structural correctness is additionally enforced by `validateTrace` over the whole catalog in the
Vitest suite (step indices, line numbers within source, unique ids per step, `activeId` and every
non-null pointer `target` resolving to an id present in the step). Both traces pass.

## 5. Key decisions & deviations
- **`argv` modeled as an `ArrayCell` of `char *` elements** (not as separate pointer locals). This
  honors the central lesson — "argv is an array of `char *`" — giving contiguous indexed slots
  (`[0]..[3]`) with ascending 8-byte addresses, and reuses the array + arrow + `\0` machinery the
  prompt asked to reuse. Consequence of the renderer: a pointer cell rendered as an array *element*
  shows its index and own storage address, and its held target is conveyed by the **arrow** rather
  than as text; the NULL slot renders as an empty `[3]` with no outgoing arrow. The narration +
  `activeId` make the NULL terminator explicit on its step.
- **Argument strings placed as char-array "locals" in `main`'s frame** (rather than heap blocks).
  The renderer's only data region is labeled "Heap & data" and array locals render there; using
  heap blocks would paint a teal "✓ allocated" badge that wrongly implies `malloc`. Char arrays in
  the frame render in the same data region with the correct `\0` treatment and **no** allocation
  implication. The arg strings genuinely live in `main`'s addressable memory, so this is a faithful
  and unambiguous teaching choice.
- **`order` = 100 / 101 (deviation from the literal "10 × week" = 70).** Recursion (week 5) already
  ships with `order: 80`, so a literal `70` would sort the week-7 argc/argv topic *before* recursion
  in the sidebar. I used 100/101 to preserve curriculum week ordering (the spec says "≈ 10 × week").
- **Two modules, one curriculum row.** CURRICULUM.md allows "one or more" modules per row; splitting
  structure vs. iteration keeps each trace focused and within the quality bar.
- No shared-file edits were needed; nothing to escalate.

## 6. Trace format / API notes
**No trace-format change.** Both modules use only existing fields (`ArrayCell`, `PointerCell` with
`target`/`display`, `ScalarCell`, `Step.condition`, `Step.stdout`, `Step.activeId`, breadcrumb
metadata). No change to `types.ts`, `catalog.ts`, `module.ts`, the renderer, or the design system.

## 7. Known issues / follow-ups
- A pointer cell rendered as an array element does not display its held address as text (the arrow
  carries it). This is an engine/renderer presentation property, out of scope for a content phase;
  if a future engine phase wanted held-address text on pointer array elements it would be an
  additive renderer tweak. Not required here — the arrows and narration teach the indirection
  clearly.

## 8. File map
Added (only files under the assigned content folder, plus this report):
```
src/content/se200/argc-argv/structure.ts   # se200-argv-structure (argc/argv shape)
src/content/se200/argc-argv/iterate.ts     # se200-argv-iterate  (printing loop)
reports/phase-10-argc-argv.md              # this report
```
Changed: none (catalog auto-discovers the two modules; no shared-file edits).
