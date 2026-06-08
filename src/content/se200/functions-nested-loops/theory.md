---
course: SE 200
topic: Functions and Nested Loops
title: Functions & Nested Loops
order: 30
---

## Why functions

As programs grow, you don't want one giant `main`. A **function** lets you:

- **Name** a piece of work (`square`, `print_row`) so the code reads like a description
- **Reuse** it — call it many times instead of copying lines
- **Hide detail** — callers care *what* it does, not *how*

You've used one all along: `printf`. Now you write your own.

---

## Anatomy of a function

```c
int square(int n) {
    return n * n;
}
```

- `int` — the **return type** (what it hands back)
- `square` — the **name**
- `(int n)` — the **parameter list** (inputs, with types)
- `return n * n;` — compute the result and **hand it back**

---

## Call & return: the stack frame

Calling a function is a little journey:

1. **Arguments are copied** into the parameters
2. Control **jumps** into the function body; it gets its **own stack frame**
3. `return` produces a value and **pops** that frame
4. Control comes back, and the value lands where the call was

```c
int r = square(5);   /* 5 copied into n; returns 25; r = 25 */
```

---

## Pass by value

> [!idea] The function gets a copy
> C passes arguments **by value** — the parameter is a *copy* of the argument. Changing `n` inside
> `square` would not touch the caller's variable. (Later, *pointers* are how you opt out of that copy
> to change a caller's data.)

---

## Nested loops: a loop inside a loop

Put one loop inside another. The **outer** loop runs once per full pass of the **inner** loop:

```c
for (int i = 1; i <= 3; i++)        /* outer: rows */
    for (int j = 1; j <= 3; j++)    /* inner: columns */
        printf("%d ", i * j);
```

For each `i`, the inner loop walks `j` from 1 to 3 — so the body runs `3 × 3 = 9` times.

---

## Worked example: a multiplication grid

Distinct counters `i` and `j` build a times-table:

```c
for (int i = 1; i <= 3; i++) {
    for (int j = 1; j <= 3; j++)
        printf("%d ", i * j);   /* 1 2 3 / 2 4 6 / 3 6 9 */
    printf("\n");
}
```

`i = 2` gives `2 4 6`; the outer loop's `printf("\n")` ends each row. Nine products in total.

---

## Common pitfalls

> [!watch-out] Functions & nested loops gotchas
> - **Reusing one counter** for both loops (`i` for inner and outer) — they clobber each other; use
>   separate names (`i`, `j`).
> - **Off-by-one bounds**: `<= 3` includes 3; `< 3` stops at 2.
> - **Forgetting `return`** (or returning the wrong thing) — a non-`void` function must return a value.
> - **Expecting a function to change its argument** — it only gets a copy.

---

## Recap

> [!recap] What to hold onto
> A function names, reuses, and hides a piece of work. A call copies arguments in, runs in its own
> **stack frame**, and `return`s a value back to where it was called — arguments are passed **by
> value** (a copy). Nested loops run the inner loop fully for each step of the outer, so counts
> **multiply** (`3 × 3 = 9`). Give each loop its own counter.

---

## See it run

This topic has two visualizations:

- **Functions: call & return** — watch `square(5)`: the argument copy into `n`, a new frame, and the
  return value (`25`) assigned back in `main`.
- **Nested loops** — distinct `i` and `j` counters drive a multiplication grid, one cell at a time.

Press **Continue to the visualization →** to start with *Functions: call & return*.
