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

Miss the base case (or never reach it) and the function calls itself until the stack runs out and the
program crashes.

---

## The contract

> [!idea] Trust the smaller call
> Assume your function **already works** for the smaller input. Your only jobs: (1) handle the
> smallest input directly, and (2) make every recursive call strictly **smaller** so it marches to the
> base case. If both hold, the whole thing is correct.

---

## Thinking recursively

To *write* a recursion, answer three questions in order:

1. **What's the smallest input, and its answer?** That's your base case.
2. **How do I make the problem smaller?** Find the sub-problem one step in.
3. **Given the smaller answer, how do I build mine?** Combine — and take the **leap of faith** that
   the smaller call is already correct.

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

## The call stack, drawn

```call-stack
caption: factorial(4) at its deepest — five frames live; factorial(1) is the base case
main()
factorial(4) | n = 4 | return = 4 * factorial(3)
factorial(3) | n = 3 | return = 3 * factorial(2)
factorial(2) | n = 2 | return = 2 * factorial(1)
factorial(1) | n = 1 | base case | active
```

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

## Unwinding, drawn

```call-stack
caption: on the way back up, each frame multiplies its n by the value from below: 1 → 2 → 6 → 24
main()
factorial(4) | n = 4 | return = 4 * 6 = 24
factorial(3) | n = 3 | just returned 6 | active
```

---

## Recursion vs. iteration

| | Recursion | Iteration |
| --- | --- | --- |
| Shines for | self-similar data (lists, trees) | a simple repeat |
| State lives in | the call stack | variables you manage |
| Cost | one frame per call | constant stack space |

For `factorial`, a loop is simpler. Recursion earns its place when the **data** is recursive.

---

## Tree recursion

Some problems branch into **more than one** recursive call. Fibonacci is the classic:

```c
int fib(int n) {
    if (n < 2) return n;             /* fib(0) = 0, fib(1) = 1 */
    return fib(n - 1) + fib(n - 2);  /* two calls — it branches */
}
```

Two calls per step means the activations form a **tree**, not a straight line.

---

## Tree recursion, drawn

```call-tree
caption: naive fib recomputes subproblems — fib(2) is computed twice (amber). Work grows exponentially.
fib(4)
  fib(3)
    fib(2) *
      fib(1)
      fib(0)
    fib(1)
  fib(2) *
    fib(1)
    fib(0)
```

---

## More examples: power(b, e)

Recurrence: `power(b, e) = b · power(b, e - 1)`, base `power(b, 0) = 1`.

```c
int power(int b, int e) {
    if (e == 0) return 1;        /* base */
    return b * power(b, e - 1);  /* multiply on the unwind */
}
```

`power(2, 3)` = 2 · 2 · 2 · 1 = **8** — the same shape as factorial.

---

## More examples: gcd(a, b) — Euclid

Recurrence: `gcd(a, b) = gcd(b, a % b)`, base `gcd(a, 0) = a`.

```c
int gcd(int a, int b) {
    if (b == 0) return a;   /* base */
    return gcd(b, a % b);   /* tail call */
}
```

`gcd(48, 36)` → `gcd(36, 12)` → `gcd(12, 0)` = **12**.

---

## Tail recursion

> [!idea] Nothing left to do after the call
> When the recursive call is the **last** thing the function does — like `gcd` — no work waits on the
> unwind. The base case's answer rides straight back up, unchanged. (Such calls can in principle reuse
> a single frame instead of stacking up.)

---

## More examples: sum of digits

Recurrence: `sum_digits(n) = n % 10 + sum_digits(n / 10)`, base `sum_digits(0) = 0`.

```c
int sum_digits(int n) {
    if (n == 0) return 0;
    return n % 10 + sum_digits(n / 10);
}
```

`sum_digits(135)` = 5 + 3 + 1 = **9** (peel the last digit, recurse on the rest).

---

## Mutual recursion

> [!idea] Functions that call each other
> Recursion need not be direct. `is_even(n)` can call `is_odd(n - 1)` and vice versa — **mutual
> recursion**. The same rules hold: a base case (`is_even(0)` is true) and each call strictly smaller.

---

## Common pitfalls

- **No base case, or one you never reach** — the call must get strictly smaller.
- **"Locals are shared between calls."** They're not — each frame is private. Same *name* ≠ same *box*.
- **Combining a wrong-sized result** — only works once the smaller call is correct.

> [!watch-out] Infinite recursion ≠ infinite loop
> A loop spins; infinite recursion **allocates a new frame every call** and crashes with a stack
> overflow. A missing or unreachable base case is the usual cause.

---

## Recap

> [!recap] What to hold onto
> Need a **base case** (answer the smallest input) and a **recursive case** that calls itself on a
> strictly **smaller** input and combines the result. Each call gets its own frame with its own
> locals; frames pile up to the base case, then unwind. One call per step is linear; two or more
> branches into a tree (and can explode — see fib).

---

## See it run

Recursion is the topic where *watching the stack* is worth a thousand words. In this topic's
visualizations:

- **factorial(n)** — frames push to the base case, then unwind multiplying back up. Step **backward**
  to watch them return.
- **power(b, e)** — the same linear shape; multiply on the unwind.
- **gcd(a, b)** — Euclid; a tail call whose answer rides straight back up.
- **sum_digits(n)** — peel a digit each call, add them back on the unwind.
- **fibonacci(n)** — tree recursion, with `fib(2)` recomputed; and **sum_to(n)** for one more linear case.

Press **Continue to the visualization →** to start with factorial.
