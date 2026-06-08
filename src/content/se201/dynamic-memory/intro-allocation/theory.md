---
course: SE 201
topic: Introduction to Memory Allocation
title: Introduction to Memory Allocation
order: 10
---

## Why this matters

So far your variables lived on the **stack** — created and destroyed automatically with each function
call. But you often don't know how much memory you need until the program runs.

**Dynamic allocation** lets you request memory at run time from a region called the **heap**, use it
for as long as you like, and hand it back when you're done. It's how programs build data structures
whose size isn't known in advance.

---

## Stack vs heap

| | Stack | Heap |
| --- | --- | --- |
| Lifetime | tied to the function call | until **you** free it |
| Managed by | the compiler, automatically | you, with `malloc` / `free` |
| Size | fixed, known at compile time | decided at run time |
| Freed when | the function returns | you call `free` |

The heap gives you control — and the responsibility that comes with it.

---

## `malloc` — request memory

`malloc(n)` asks for `n` bytes on the heap and returns a **pointer** to them (or `NULL` if it fails):

```c
int *p = malloc(32);   /* 32 bytes of heap memory */
if (p == NULL) {       /* allocation can fail — always check */
    return 1;
}
```

The memory is uninitialized — it holds garbage until you write to it. `malloc` returns `void *`,
which converts to any pointer type.

---

## `free` — give it back

Every successful `malloc` must be paired with exactly one `free`:

```c
free(p);   /* return the block to the heap */
```

After `free(p)`, the block is no longer yours. `p` still holds the old address, but using it is
illegal — so the next two slides are the two ways this goes wrong.

---

## Pitfall: dangling pointers

> [!watch-out] Use-after-free
> After `free(p)`, the pointer `p` still points at the freed block — it now **dangles**. Reading or
> writing `*p`, or calling `free(p)` again (a double free), is **undefined behavior**: a crash or
> silent corruption. Set `p = NULL;` after freeing so a stray use fails loudly instead.

---

## Pitfall: memory leaks

> [!watch-out] Lost memory
> If you lose the **last pointer** to a block before `free`-ing it, that memory is gone for the
> program's lifetime — a **leak**. Overwriting `p` with a new `malloc` (without freeing the old one
> first), or returning from a function without freeing, both leak. Every block needs an owner that
> eventually frees it.

---

## Recap

> [!recap] What to hold onto
> The heap is run-time memory you manage by hand: `malloc(n)` returns a pointer to `n` uninitialized
> bytes (or `NULL` — check it), and `free(p)` returns the block. Pair every `malloc` with one `free`.
> Using a pointer after `free` **dangles** (undefined behavior); losing a pointer before `free`
> **leaks**. Set freed pointers to `NULL`.

---

## See it run

This topic's visualizations show the heap as a region you allocate into and free from:

- **malloc(32)** — a block appears on the heap and the pointer's arrow lands on it
- **free & dangling** — after `free`, the block turns to a freed/dangling state and the pointer's
  arrow goes red (UB)
- **Memory leak** — overwriting the only pointer strands a block with no owner

Press **Continue to the visualization →** to allocate your first block.
