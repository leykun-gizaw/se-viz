---
course: SE 200
topic: Even More Pointers, Arrays and Strings
title: Double Indirection & Copying Strings
order: 70
---

## Why this matters

Two more pointer skills that show up constantly:

- **Pointer to a pointer** — an address that names *another* address (`pp → p → x`)
- **Copying a string** — two pointers marching in lockstep, character by character

Both build directly on "a pointer holds an address" — just one more hop, or one more pointer.

---

## A pointer to a pointer

A pointer variable lives in a box too, so it has an address — and another pointer can hold it:

```c
int x = 5;
int *p = &x;      /* p → x */
int **pp = &p;    /* pp → p → x   (two hops) */
```

`pp` is an `int **`: "a pointer to a pointer to `int`." Following it twice reaches `x`.

---

## Reading the hops

| Write | Type | Means |
| --- | --- | --- |
| `x` | `int` | the value, `5` |
| `p` | `int *` | the address of `x` |
| `pp` | `int **` | the address of `p` |
| `*pp` | `int *` | `p` (one hop) |
| `**pp` | `int` | `x` (two hops) |

So `**pp = 9;` writes through both hops and sets `x` to `9`.

---

## Why double indirection

> [!idea] To change a caller's *pointer*, pass its address
> Pass-by-pointer let a function change a caller's `int`. To let a function change a caller's
> **pointer** (e.g. make it point somewhere new, or allocate and hand it back), pass a **pointer to
> that pointer** — an `int **`. Same trick, one level up.

---

## Pattern: copy a string

`strcpy` walks two pointers — `src` and `dst` — in lockstep, copying each character, **including** the
`\0`:

```c
while (*src != '\0') {
    *dst = *src;   /* copy one char */
    dst++;         /* both pointers */
    src++;         /* advance together */
}
*dst = '\0';       /* copy the terminator last */
```

Miss that final `\0` and `dst` isn't a valid string.

---

## Common pitfalls

> [!watch-out] Indirection & copy traps
> - **Forgetting the terminating `\0`** — the copy isn't a string without it.
> - **`dst` buffer too small** — copying past its end is a buffer overflow (corruption / crash).
> - **Confusing `*pp` and `**pp`** — one hop gives the pointer `p`; two hops give the value `x`.
> - **Uninitialized inner pointer** — `**pp` follows garbage if `p` was never set.

---

## Recap

> [!recap] What to hold onto
> `int **pp = &p` is a pointer to a pointer: `*pp` is `p`, `**pp` is `x`. Use it to let a function
> change a caller's pointer. To copy a string, march `src` and `dst` together copying each char, then
> copy the `\0` last. Every "extra" pointer is just one more address to follow.

---

## See it run

This topic has two visualizations:

- **Pointer to pointer** — double indirection drawn as a two-hop chain `pp → p → x`.
- **strcpy (two pointers)** — `src` and `dst` march in lockstep, the `\0` copied last.

Press **Continue to the visualization →** to start with *Pointer to pointer*.
