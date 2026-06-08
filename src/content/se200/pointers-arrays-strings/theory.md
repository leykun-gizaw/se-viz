---
course: SE 200
topic: Pointers, Arrays and Strings
title: Pointers, Arrays & Strings
order: 50
---

Pointers are the idea that scares people away from C — and the idea that, once it clicks, makes the
rest of C feel obvious. A pointer is not magic and it is not advanced. It is just **a variable whose
value is a memory address**. Everything else in this topic — arrays, strings, pass-by-pointer —
is built directly on that one sentence.

This page is the *why* and the *mental model*. When you are ready to watch the addresses move, open
the visualizations for this topic and step through them line by line.

## Why pointers exist

A running C program has one giant array of bytes called **memory**, and every byte has a numbered
position called its **address**. A normal variable like `int x = 42;` reserves some of those bytes
and remembers the value. A pointer reserves bytes too — but the value it stores is *an address of
some other variable*, not an `int` you'd compute with.

Pointers earn their keep because they let you:

- **Refer to one thing from many places** without copying it (a linked list is nodes pointing at
  nodes).
- **Let a function change its caller's variables** (C passes arguments *by value* — a pointer is how
  you opt out of that copy).
- **Walk through arrays and strings** efficiently, one element at a time.
- **Manage memory you request at runtime** (the heap, in the next course).

> [!idea] The one-sentence model
> A pointer holds an **address**. `*p` means "go to that address and use what is there." `&x` means
> "the address of `x`." Hold those two and the syntax stops fighting you.

## The mental model: boxes and addresses

Picture memory as a column of labeled boxes. Each box has an **address** (where it is) and a
**value** (what is in it).

When you write `int x = 42;`, the machine picks a box — say address `0x7ffd2018` — and writes `42`
in it. When you write `int *p = &x;`, you get a *second* box holding the **address of the first
box**. Now `p`'s value is `0x7ffd2018`, and the picture is `p ──▶ x`. Reading `*p` follows that
arrow and finds `42`.

This is exactly what the visualization draws: a pointer cell with an arrow to the box it names. The
arrow *is* the address.

## Syntax and the rules that actually matter

| Syntax | Read it as |
| --- | --- |
| `int *p;` | `p` is a pointer to `int` (it can hold the address of an `int`) |
| `p = &x;` | store the **address of** `x` in `p` |
| `*p` | the value **at** the address in `p` (dereference) |
| `*p = 7;` | write `7` into the box `p` points at |
| `p == NULL` | `p` points at nothing (the address `0`) |

A few rules that prevent most beginner bugs:

1. **A pointer has a type.** `int *` points at `int`-sized boxes; `char *` at `char`-sized boxes.
   The type tells `*p` how many bytes to read and how to interpret them.
2. **Declaring a pointer does not create a box to point at.** `int *p;` alone is a *wild* pointer —
   it holds garbage until you assign it a real address.
3. **`NULL` means "points at nothing."** Always set a pointer to `NULL` when it has no target, and
   never dereference a `NULL` pointer.

> [!watch-out] Dereferencing a wild or NULL pointer
> `int *p; *p = 5;` writes `5` to *whatever random address* was in `p` — a crash, or worse, silent
> corruption. A pointer must point at something real before you use `*p`.

## Arrays are pointers in disguise (almost)

An array is a run of equal-sized boxes laid end to end. Its name, used in an expression, **decays to
the address of its first element**. So for `int a[4];`, the name `a` behaves like `&a[0]`, and these
two lines mean the same thing:

```c
int a[4] = {10, 20, 30, 40};
int *p = a;        /* p points at a[0] */
printf("%d\n", *p);      /* 10 */
printf("%d\n", *(p + 1)); /* 20 — pointer arithmetic moves by element, not by byte */
printf("%d\n", a[2]);     /* 30 — a[i] is just *(a + i) */
```

The key insight: **`a[i]` is defined as `*(a + i)`**. Indexing is pointer arithmetic with friendlier
syntax. Adding `1` to an `int *` advances by `sizeof(int)` bytes, because the type knows how big each
element is.

> [!idea] `a[i]` ≡ `*(a + i)`
> Since addition commutes, `a[i]` and `i[a]` are *both legal C* and mean the same thing. You should
> never write `i[a]` — but the fact that you *can* tells you indexing is pure pointer arithmetic.

The one place an array is **not** a pointer: `sizeof a` gives the size of the whole array, while
`sizeof p` gives the size of one pointer. And you cannot reassign an array name (`a = ...;` is an
error), but you can reassign a pointer.

## Strings are just `char` arrays ending in `\0`

C has no string type. A "string" is a `char` array whose end is marked by a **null terminator**, the
byte `'\0'` (value `0`). Every standard string function — `strlen`, `strcpy`, `printf("%s")` —
walks forward until it sees that `0` byte.

```c
char s[] = "hi";   /* actually 3 bytes: 'h', 'i', '\0' */
/* strlen counts characters before the terminator */
size_t len = 0;
while (s[len] != '\0') {
    len++;          /* stops at the '\0', so len == 2 */
}
```

> [!watch-out] Forgetting the `\0`
> A `char` buffer without a terminator is not a string. `strlen` and `printf("%s")` will run *past*
> the end of your array looking for a `0` that isn't there — reading whatever memory follows. Always
> leave room for the terminator: a 5-character word needs `char[6]`.

## Pass-by-pointer: letting a function change your variable

C passes arguments **by value** — the function gets a *copy*. So this swap silently does nothing:

```c
void broken_swap(int a, int b) { int t = a; a = b; b = t; } /* swaps copies */
```

To change the caller's variables, pass their **addresses** and work through the pointers:

```c
void swap(int *a, int *b) {
    int t = *a;   /* read through the pointer */
    *a = *b;      /* write through the pointer */
    *b = t;
}

int x = 1, y = 2;
swap(&x, &y);     /* pass addresses; now x == 2, y == 1 */
```

The function never sees `x` or `y` — it sees their addresses and reaches back through them. This is
the single most important pattern pointers unlock, and the linked lists in the next course are built
entirely on it.

## Common pitfalls & misconceptions

- **"A pointer *is* the value."** No — a pointer is the *address*. `p` is the arrow; `*p` is the
  thing the arrow points at. Mixing them up is the root of most pointer bugs.
- **"`int *p, q;` makes two pointers."** It makes one pointer `p` and one plain `int q`. The `*`
  binds to the *name*, not the type. Declare one pointer per line until this is second nature.
- **Returning the address of a local variable.** A local lives only for the function call; its box is
  reused after `return`. A pointer to it immediately dangles.
- **Off-by-one past the array.** `a[n]` for `int a[n]` is one element *past* the end — out of bounds.
  Valid indices are `0 .. n-1`.

> [!recap] What to hold onto
> A pointer stores an address; `*p` follows it, `&x` produces it. Arrays decay to a pointer to their
> first element and `a[i]` is `*(a + i)`. Strings are `char` arrays terminated by `\0`. Pass a
> variable's address to let a function change it. Everything harder in C is these four ideas combined.

## See it run

Reading about an arrow is not the same as watching one re-target. The visualizations for this topic
draw each pointer as a live arrow to the box it addresses, highlight the cell that changes on every
line, and let you step backward when you lose the thread. Start with **Pointer basics**, then
**Array indexing** and **Strings**, and watch `*(a + i)` land on the same box as `a[i]`.
