---
course: SE 200
topic: argc, argv
title: Command-Line Arguments
order: 100
---

## Why this matters

Programs need input from the outside. The simplest source is the **command line**:

```text
./prog hello 42
```

`main` can receive those words — `hello`, `42`, and the program's own name — through two parameters,
`argc` and `argv`. That's how tools, compilers, and scripts are configured.

---

## The signature

`main` has a second, fuller form:

```c
int main(int argc, char *argv[])
```

- `argc` — **arg**ument **c**ount (an `int`)
- `argv` — the **arg**ument **v**ector (an array of strings)

Before `main` runs, the C runtime fills these in from what you typed, then calls `main`.

---

## `argc` — the count

> [!idea] argc counts the program name too
> `argc` is the number of command-line tokens **including** the program name. For `./prog hello 42`
> that's three tokens, so `argc = 3`. A program run with no extra arguments still has `argc = 1`.

---

## `argv` — the vector

`argv` is an **array of `char *`** — each element points at a NUL-terminated string. The first is the
program name; the slot at index `argc` is `NULL`, marking the end.

```text
argv[0] → "./prog"
argv[1] → "hello"
argv[2] → "42"
argv[3] → NULL        (== argv[argc])
```

So `argv[i]` is a pointer to a string; the string's characters end in `\0`.

---

## Everything is a string

> [!watch-out] argv[2] is "42", not 42
> Command-line arguments arrive as **text**. `argv[2]` is the two characters `'4'`, `'2'` (then `\0`) —
> **not** the integer `42`. If you need a number, convert it: `atoi(argv[2])` or `strtol`.

---

## Iterating the arguments

Walk the valid indices `0 .. argc-1`:

```c
for (int i = 0; i < argc; i++)
    printf("%s\n", argv[i]);   /* print each argument */
```

Equivalently, you can walk until you hit the `NULL` terminator at `argv[argc]`.

---

## Common pitfalls

> [!watch-out] argc / argv traps
> - **Treating an argument as a number** — convert the string first (`atoi`/`strtol`).
> - **Off-by-one** — valid indices are `0 .. argc-1`; `argv[argc]` is `NULL`, not an argument.
> - **Assuming an argument exists** — check `argc` before reading `argv[2]`, or you read past the end.
> - **Forgetting `argv[0]`** — it's the program name, so real arguments start at `argv[1]`.

---

## Recap

> [!recap] What to hold onto
> `int main(int argc, char *argv[])`: `argc` counts the tokens (program name included), and `argv` is
> an array of string pointers ending in `NULL` at index `argc`. Arguments are **strings** — convert
> them if you need numbers. Loop `0 .. argc-1`, and check `argc` before indexing.

---

## See it run

This topic has two visualizations:

- **argc / argv structure** — `argv` drawn as an array of `char *` pointing at the argument buffers,
  ending in the `NULL` slot at `argv[argc]`.
- **argv iteration** — a `for` loop walks `argv[0..argc-1]`, printing each argument string.

Press **Continue to the visualization →** to start with *argc / argv structure*.
