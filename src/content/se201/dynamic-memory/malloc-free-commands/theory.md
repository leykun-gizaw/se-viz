---
course: SE 201
topic: malloc/free Commands
title: Sizing Allocations & realloc
order: 13
---

## Why this matters

You can `malloc` and `free`. Now do it **correctly and flexibly**:

- size allocations with `sizeof` so they're right on every platform
- allocate **arrays** on the heap
- **grow** an allocation when you need more room, with `realloc`

This is the everyday craft of heap memory.

---

## Always size with `sizeof`

Never hard-code byte counts — ask the compiler for the type's size:

```c
int *a = malloc(4 * sizeof(int));   /* room for 4 ints */
```

> [!idea] `n * sizeof(T)`, every time
> `sizeof(int)` may be 4 on one machine and something else elsewhere. Writing `malloc(4 * sizeof(int))`
> (not `malloc(16)`) is correct everywhere and says your intent: "four ints."

---

## A heap array

The returned pointer is the base of a contiguous block — index it like any array:

```c
int *a = malloc(4 * sizeof(int));
for (int i = 0; i < 4; i++)
    a[i] = i * i;       /* 0, 1, 4, 9 */
free(a);
```

`a[i]` is `*(a + i)` — the same pointer arithmetic as a stack array, just on heap memory.

---

## `realloc` — resize a block

`realloc` grows (or shrinks) an existing allocation, preserving its contents:

```c
a = realloc(a, 8 * sizeof(int));   /* now room for 8 */
```

It may **move** the block to a bigger free spot, copying the old data for you and returning the
(possibly new) address. The old pointer is no longer valid after a move.

---

## Use a temp pointer with realloc

> [!watch-out] Don't overwrite your only pointer
> `a = realloc(a, ...)` looks fine — until `realloc` **fails** and returns `NULL`. Then you've
> overwritten `a` with `NULL` and **leaked** the original block. Capture into a temp first:
> ```c
> int *tmp = realloc(a, n * sizeof(int));
> if (tmp == NULL) { /* a is still valid; handle error */ }
> else a = tmp;
> ```

---

## More pitfalls

> [!watch-out] Sizing & realloc traps
> - **Hard-coded sizes** — `malloc(16)` breaks where `sizeof(int) != 4`. Use `sizeof`.
> - **`sizeof` on a pointer** — `sizeof(a)` is the pointer's size, not the array's. Track the count
>   yourself.
> - **Using the old pointer after a realloc move** — only the returned pointer is valid.
> - Still: every block needs exactly one `free`.

---

## Recap

> [!recap] What to hold onto
> Size allocations as `n * sizeof(T)` so they're correct everywhere. A heap pointer indexes like an
> array (`a[i]` == `*(a + i)`). `realloc` resizes and may **move** the block (copying your data),
> returning the new address — assign it through a **temp** so a `NULL` failure doesn't leak the
> original.

---

## See it run

This topic's visualizations show sizing and resizing on the heap:

- **malloc(16)** — `4 * sizeof(int)` carves a right-sized block; the array fills in
- **realloc** — the block grows, contents preserved, the pointer re-targets the (possibly moved) memory

Press **Continue to the visualization →** to size an allocation.
