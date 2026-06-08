---
course: SE 200
topic: Recursion
title: Recursion
order: 80
---

## What recursion is

A function that solves a problem by **calling itself on a smaller version of the same problem**.

Like Russian dolls: each contains a smaller one, until the tiny doll that contains nothing. That tiny
doll — the part beginners forget — is what makes recursion *stop* instead of looping forever.

---

## Every recursion has two parts

1. **Base case** — an input small enough to answer directly, no further recursion. This stops it.
2. **Recursive case** — reduce to a *smaller* version, call yourself, and combine the result.

Miss the base case (or never reach it) and the function calls itself until the stack runs out and
the program crashes.

---

## The contract

> [!idea] Trust the smaller call
> Assume your function **already works** for the smaller input. Your only jobs: (1) handle the
> smallest input directly, and (2) make every recursive call strictly **smaller** so it marches to
> the base case. If both hold, the whole thing is correct.

---

## Worked example: factorial

`n! = n × (n-1)!`, and `0! = 1`. That definition is already recursive:

```c
int factorial(int n) {
    if (n <= 1) {
        return 1;                 /* base case */
    }
    return n * factorial(n - 1);  /* recursive case: smaller input */
}
```

The argument shrinks by one every call, so it must reach `1` — it terminates.

---

## The mental model: a stack of frames

Each call gets its own **stack frame** with its own copy of the locals. A paused call waits on the
stack while the inner call runs:

- `factorial(4)` calls...
  - `factorial(3)` calls...
    - `factorial(2)` calls...
      - `factorial(1)` = 1 — base case, stop

Frames pile up on the way **down**, then unwind on the way **back up**.

---

## Unwinding

Returns happen in reverse, each combining its result:

- `factorial(1)` returns `1`
- `factorial(2)` returns `2 * 1 = 2`
- `factorial(3)` returns `3 * 2 = 6`
- `factorial(4)` returns `4 * 6 = 24`

> [!idea] Each call has its own `n`
> The `n` in `factorial(2)` is a different box from the `n` in `factorial(4)`. That's why the
> visualization shows several `factorial()` frames at once, each with its **own** value.

---

## Recursion vs. iteration

| | Recursion | Iteration |
| --- | --- | --- |
| Shines for | self-similar data (lists, trees) | a simple repeat |
| State lives in | the call stack | variables you manage |
| Cost | one frame per call | constant stack space |

For `factorial`, a loop is simpler. Recursion earns its place when the **data** is recursive.

---

## Common pitfalls

- **No base case, or one you never reach** — the call must get strictly smaller.
- **"Locals are shared between calls."** They're not — each frame is private. Same *name* ≠ same
  *box*.
- **Combining a wrong-sized result** — only works once the smaller call is correct.

> [!watch-out] Infinite recursion ≠ infinite loop
> A loop spins; infinite recursion **allocates a new frame every call** and crashes with a stack
> overflow. A missing or unreachable base case is the usual cause.

---

## Recap

> [!recap] What to hold onto
> Need a **base case** (answer the smallest input) and a **recursive case** that calls itself on a
> strictly **smaller** input and combines the result. Each call gets its own frame with its own
> locals; frames pile up to the base case, then unwind as each returns.

---

## See it run

Recursion is the one topic where *watching the stack* is worth a thousand words. In this topic's
visualizations:

- **factorial(n)** — frames push to the base case, then unwind multiplying back up. Step **backward**
  to watch them return.
- **sum_to(n)** and **fibonacci(n)** — the same shape on different problems.

Press **Continue to the visualization →** to start with factorial.
