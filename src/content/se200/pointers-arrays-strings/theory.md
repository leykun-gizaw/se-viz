---
course: SE 200
topic: Pointers, Arrays and Strings
title: Pointers, Arrays & Strings
order: 50
---

## Why pointers matter

A pointer is just **a variable whose value is a memory address**. Not magic, not advanced.

Once it clicks, the rest of C follows. Pointers let you:

- Refer to one thing from many places, without copying it
- Let a function change its **caller's** variables
- Walk arrays and strings one element at a time
- Manage memory you request at runtime (the heap)

---

## The one-sentence model

> [!idea] Hold exactly this
> A pointer holds an **address**. `*p` means "go to that address and use what's there." `&x` means
> "the address of `x`." Those two operators are the whole game.

---

## Mental model: boxes & addresses

Picture memory as labelled boxes. Each box has an **address** (where it is) and a **value** (what's
in it).

- `int x = 42;` → the machine picks a box, say `0x7ffd2018`, and writes `42`
- `int *p = &x;` → a second box holding **the address of the first**

Now `p ──▶ x`, and reading `*p` follows the arrow to `42`. The arrow *is* the address — exactly what
the visualization draws.

---

## Syntax that actually matters

| Syntax | Read it as |
| --- | --- |
| `int *p;` | `p` is a pointer to `int` |
| `p = &x;` | store the **address of** `x` in `p` |
| `*p` | the value **at** that address (dereference) |
| `*p = 7;` | write `7` into the box `p` points at |
| `p == NULL` | `p` points at nothing (address `0`) |

---

## Three rules that prevent most bugs

1. **A pointer has a type.** `int *` points at `int`-sized boxes; the type tells `*p` how many bytes
   to read.
2. **Declaring a pointer doesn't create a target.** `int *p;` alone is *wild* — garbage until
   assigned.
3. **`NULL` means "points at nothing."** Set unused pointers to `NULL`; never dereference `NULL`.

---

## Watch the wild pointer

> [!watch-out] Dereferencing a wild or NULL pointer
> `int *p; *p = 5;` writes `5` to whatever random address was in `p` — a crash, or silent
> corruption. A pointer must point at something real before you use `*p`.

---

## Arrays are pointers in disguise

An array name in an expression **decays to the address of its first element**: for `int a[4]`, `a`
behaves like `&a[0]`.

> [!idea] `a[i]` is `*(a + i)`
> Indexing *is* pointer arithmetic. Adding `1` to an `int *` advances by one **element**
> (`sizeof(int)` bytes), because the type knows the element size.

---

## See it: indexing == arithmetic

```c
int a[4] = {10, 20, 30, 40};
int *p = a;            /* p points at a[0] */
printf("%d\n", *p);       /* 10 */
printf("%d\n", *(p + 1)); /* 20 — advances one int, not one byte */
printf("%d\n", a[2]);     /* 30 — a[i] is *(a + i) */
```

The one difference: `sizeof a` is the whole array; `sizeof p` is one pointer. And `a` can't be
reassigned; `p` can.

---

## Strings are char arrays + `\0`

C has no string type. A string is a `char` array ending in the **null terminator** `'\0'` (value
`0`). Every string function walks forward until it hits that byte.

```c
char s[] = "hi";   /* 3 bytes: 'h', 'i', '\0' */
size_t len = 0;
while (s[len] != '\0') {
    len++;          /* stops at '\0', so len == 2 */
}
```

---

## The terminator is not optional

> [!watch-out] A buffer without `\0` is not a string
> `strlen` and `printf("%s")` run *past* the end of your array hunting for a `0` that isn't there.
> Always leave room: a 5-character word needs `char[6]`.

---

## Pass-by-pointer

C passes arguments **by value** (a copy), so a plain swap does nothing. Pass **addresses** to reach
back into the caller:

```c
void swap(int *a, int *b) {
    int t = *a;   /* read through the pointer */
    *a = *b;      /* write through the pointer */
    *b = t;
}
int x = 1, y = 2;
swap(&x, &y);     /* now x == 2, y == 1 */
```

This is the pattern linked lists are built on.

---

## Common pitfalls

- **"A pointer *is* the value."** No — it's the *address*. `p` is the arrow; `*p` is what it points
  at.
- **`int *p, q;`** makes one pointer `p` and a plain `int q`. The `*` binds to the name.
- **Returning the address of a local** — its box is reused after `return`; the pointer dangles.
- **`a[n]` for `int a[n]`** is one past the end. Valid indices are `0 .. n-1`.

---

## Recap

> [!recap] What to hold onto
> A pointer stores an address; `*p` follows it, `&x` produces it. Arrays decay to a pointer to their
> first element and `a[i]` is `*(a + i)`. Strings are `char` arrays terminated by `\0`. Pass a
> variable's address to let a function change it.

---

## See it run

Watching an arrow re-target beats reading about one. In this topic's visualizations:

- **Pointer basics** — `&x`, `*p`, and pass-by-pointer as live arrows
- **Array indexing** — watch `*(a + i)` land on the same box as `a[i]`
- **Strings** — walk to the `\0`

Press **Continue to the visualization →** to start with Pointer basics.
