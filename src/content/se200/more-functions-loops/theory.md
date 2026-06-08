---
course: SE 200
topic: More Functions, More Nested Loops
title: Functions Inside Loops
order: 40
---

## Why combine them

You know functions, and you know nested loops. Real programs **combine** them: a helper function
called **repeatedly** from inside a loop.

- the **loops** decide *which* cases to handle (every row × column)
- the **function** decides *what* to compute for each case

This split — drive vs. compute — is one of the most common shapes in all of programming.

---

## The pattern

A small helper does one cell's work; nested loops call it across a grid:

```c
int product(int a, int b) {
    return a * b;          /* one cell's work */
}

int main(void) {
    for (int row = 1; row <= 2; row++)
        for (int col = 1; col <= 2; col++)
            printf("%d ", product(row, col));
}
```

The loops walk every `(row, col)`; `product` is called for each.

---

## Worked example

With `row` and `col` each running `1 → 2`:

- `product(1, 1)` = 1
- `product(1, 2)` = 2
- `product(2, 1)` = 2
- `product(2, 2)` = 4

Output: `1 2 2 4`. Four cells, so **four calls**.

---

## The stack churns

> [!idea] One frame at a time, over and over
> Each `product(...)` call pushes a **new stack frame**, runs, returns, and **pops** — before the next
> call pushes its own. The frames are short-lived and appear **one at a time**, not all at once
> (that's recursion, later). The visualization shows this push-pop rhythm.

---

## Separation of concerns

Why not just write `row * col` inline?

- **Naming** — `product(row, col)` says *what* it means
- **Reuse** — change the computation in one place
- **Testing** — you can check `product` on its own

The loop shouldn't care *how* a cell is computed; the function shouldn't care *which* cells exist.

---

## Counting the calls

> [!idea] Nested loops multiply
> An outer loop of `R` steps around an inner loop of `C` steps makes `R × C` passes — and here, `R ×
> C` **function calls**. `2 × 2 = 4`. Grow either bound and the call count grows with the product, not
> the sum.

---

## Common pitfalls

> [!watch-out] Easy mistakes here
> - **Duplicating the work inline** in several places instead of one helper — bugs then need fixing
>   everywhere.
> - **Wrong counter passed** — `product(col, row)` or reusing one loop variable for both loops.
> - **Off-by-one bounds** changing how many cells (and calls) happen.
> - **A slow helper in a hot loop** — it runs `R × C` times, so its cost multiplies.

---

## Recap

> [!recap] What to hold onto
> Combine the two: nested loops decide **which** cells, a helper function decides **what** each cell
> computes. Every call gets its own stack frame that pushes, returns, and pops before the next — one
> at a time. The number of calls is the **product** of the loop bounds (`2 × 2 = 4`). Prefer a named
> helper over duplicated inline work.

---

## See it run

The **Function inside nested loops** visualization shows `product(row, col)` called for every cell:

- the outer/inner loop counters drive `(row, col)`
- a fresh `product()` frame pushes on each call, returns its value, and pops
- the result is stored and printed, cell by cell

Press **Continue to the visualization →** to watch the push-pop rhythm.
