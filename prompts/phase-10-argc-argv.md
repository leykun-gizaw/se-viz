# Phase 10 — argc / argv (SE 200, remaining C) — CONTENT, Wave 1 (parallel)

Read `docs/CONTENT_AUTHORING.md` first (shared rules). This prompt states only what's unique. Run on
your own branch/worktree; touch only your content folder.

## Context
- `src/content/se200/even-more-pointers-arrays-strings/{strcpy,pointerToPointer}.ts` and
  `fixtures/pointerArith.ts` — `argv` is an **array of `char *`** pointing at argument strings, i.e.
  exactly the array-of-pointers / pointer-to-pointer machinery already authored. Reuse it.

## Curriculum row (from `docs/CURRICULUM.md`, SE 200, week 7)
- **argc, argv — `argc, argv`**

## Folder
`src/content/se200/argc-argv/` (course `SE 200`, topic `argc, argv` — verify exact string).

## What to author
- **The shape of `main(int argc, char *argv[])`** — `argc` is an int count; `argv` is an array of
  `char *`, each pointing at a NUL-terminated argument string; `argv[argc]` is `NULL`.
- **Indexing the args** — show `argv[0]` (program name) and `argv[1]`, `argv[2]`, … each as a pointer
  whose **arrow lands on its own char array** (with the visible `\0`); for a sample command line like
  `./prog hello 42`, draw the array of pointers and the strings they reference.
- **Iterating** — a loop `for (i = 0; i < argc; i++) printf("%s", argv[i]);` walking the pointer
  array, the active `argv[i]` and its target string highlighted each pass (`Step.condition` for the
  loop test), output to the console.
- (Optional, small) note that `argv[i]` are strings even when they look numeric (`"42"` is chars,
  not the int 42) — a common beginner trap.

## Teaching focus
`argv` is a **pointer to pointers to chars**: an array of `char *`, each pointing into a separate
char buffer, terminated by a `NULL` entry. The two-hop indirection (array element → string →
chars) is the lesson, and it reuses arrows, arrays, strings, and the `\0` treatment already built.

## Acceptance (in addition to CONTENT_AUTHORING.md)
- A module showing `argc`/`argv` structure for a concrete command line, per-arg pointer→string
  arrows with visible `\0`, the `NULL` terminator entry, and an iteration loop printing the args.
- Addresses, the pointer array, and printed output verified correct (report §4); auto-discovered +
  passes `validateTrace`; no shared-file edits; no format/renderer/design change.

Report: `reports/phase-10-argc-argv.md`.
