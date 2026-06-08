---
course: SE 200
topic: Recursion
title: Recursion
order: 80
---

Recursion is a function that solves a problem by **calling itself on a smaller version of the same
problem**. It feels circular the first time you meet it — how can something be defined in terms of
itself? — but it is no stranger than a set of Russian dolls: each doll contains a smaller doll, until
you reach the tiny one that contains nothing. That tiny doll is the part most beginners forget, and
it is the part that makes recursion *work* instead of looping forever.

This page builds the mental model. When you want to *see* the call stack grow and unwind one frame at
a time, open the recursion visualizations and step through them.

## The two parts every recursion needs

Every correct recursive function has exactly two ingredients:

1. A **base case** — an input small enough to answer directly, with no further recursion. This is the
   tiny doll. It is what stops the process.
2. A **recursive case** — reduce the problem to a *smaller* version of itself, call the function on
   that smaller version, and combine the result.

Miss the base case (or never actually reach it) and the function calls itself forever until the
program runs out of stack and crashes.

> [!idea] The recursion contract
> Trust that your function *already works* for the smaller input. Your only jobs are: (1) handle the
> smallest input directly, and (2) make every recursive call strictly **smaller** so it marches
> toward that base case. If both hold, the whole thing is correct.

## A worked example: factorial

`n!` (n factorial) is `n × (n-1) × ... × 1`, and `0! = 1`. That definition is already recursive:
`n! = n × (n-1)!`. Translated to C almost word for word:

```c
int factorial(int n) {
    if (n <= 1) {
        return 1;          /* base case: 0! and 1! are 1 */
    }
    return n * factorial(n - 1); /* recursive case: smaller input */
}
```

Read it as the contract: the base case answers `n <= 1` directly; the recursive case assumes
`factorial(n - 1)` already gives the right answer and multiplies by `n`. The argument shrinks by one
every call, so it must hit `1` — the process terminates.

## The mental model: a stack of frames

Each function call gets its own **stack frame** — a private workspace holding that call's parameters
and locals. When `factorial(4)` calls `factorial(3)`, the frame for `4` does **not** disappear; it is
*paused*, sitting on the stack, waiting for the inner call to return. The frames pile up:

```c
factorial(4)  ->  needs factorial(3)
  factorial(3)  ->  needs factorial(2)
    factorial(2)  ->  needs factorial(1)
      factorial(1)  =  1      (base case — stop)
```

Then they **unwind** in reverse: `factorial(1)` returns `1`, so `factorial(2)` returns `2 * 1 = 2`,
so `factorial(3)` returns `3 * 2 = 6`, so `factorial(4)` returns `4 * 6 = 24`. The stack grows on the
way *down* to the base case and shrinks on the way *back up*.

> [!idea] Each call has its own `n`
> Every frame has a separate copy of the parameter `n`. The `n` in `factorial(2)` is a different box
> from the `n` in `factorial(4)`. This is why the visualization shows several `factorial()` frames at
> once, each with its **own** value — and why a recursive function doesn't trip over itself.

## Recursion vs. iteration

Anything you can write with recursion you can also write with a loop, and vice versa. The choice is
about which one expresses the problem more clearly.

| | Recursion | Iteration (loop) |
| --- | --- | --- |
| Shines when | the problem is self-similar (trees, divide-and-conquer) | the problem is a simple repeat |
| State lives in | the call stack (automatic) | variables you manage yourself |
| Cost | one stack frame per call | constant stack space |

For `factorial`, a loop is honestly simpler. Recursion earns its place when the *data* is recursive —
linked lists and trees in the next course — where a loop would have to rebuild the stack by hand.

## Common pitfalls & misconceptions

- **No base case, or one you never reach.** If the recursive call isn't strictly smaller, you never
  arrive at the base case. `factorial(n - 1)` shrinks; `factorial(n)` would not.
- **"The variables are shared between calls."** They are not. Each call's locals are private to its
  frame. Re-using the same *name* (`n`) across frames is not the same as sharing one *box*.
- **Doing the work after a wrong-sized call.** Combining results only works if the smaller call
  already returned the correct answer — which requires it to be genuinely smaller and to bottom out.
- **Stack overflow.** Very deep recursion (or accidental infinite recursion) exhausts the stack and
  crashes. Each pending frame costs memory until it returns.

> [!watch-out] Infinite recursion ≠ infinite loop
> An infinite loop just spins. Infinite *recursion* keeps **allocating a new frame** every call, so
> it doesn't spin forever — it crashes with a stack overflow once the stack is full. A missing or
> unreachable base case is the usual cause.

> [!recap] What to hold onto
> A recursive function needs a **base case** (answer the smallest input directly) and a **recursive
> case** that calls itself on a strictly **smaller** input and combines the result. Each call gets
> its own stack frame with its own copies of the locals; frames pile up to the base case, then unwind
> as each returns. Trust the smaller call to be correct — that is the whole trick.

## See it run

Recursion is the one topic where *watching the stack* is worth a thousand words. The factorial
visualization pushes a new `factorial()` frame for every call, shows each frame's own `n`, pauses at
the base case, and then unwinds — multiplying back up — one step at a time. Step forward to the base
case, then step **backward** to watch the frames return. Then try `sum_to(n)` and `fibonacci(n)` to
see the same shape on different problems.
