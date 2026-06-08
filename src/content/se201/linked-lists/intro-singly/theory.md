---
course: SE 201
topic: Introduction to Singly Linked Lists
title: Introduction to Singly Linked Lists
order: 15
---

## Why this matters

An array stores elements **contiguously** — great for indexing, awkward for inserting in the middle
(everything after has to shift). A **linked list** stores each element in its own heap **node** that
**points to the next** one.

- grows one node at a time, no resizing
- insert/remove by **re-pointing**, not shifting
- the trade-off: no random access — you must **walk** from the front

It's the first pointer-built data structure, and the foundation for the rest of this course.

---

## The node

A node bundles a value with a pointer to the next node:

```c
struct node {
    int value;
    struct node *next;   /* the link to the next node (self-referential) */
};
```

`next` is a pointer to the **same** struct type — that self-reference is what chains nodes together.

---

## The mental model

> [!idea] A chain of nodes ending in NULL
> A list is a `head` pointer to the first node; each node's `next` points to the following one; the
> **last** node's `next` is `NULL`, marking the end. `head == NULL` is the empty list. The list isn't
> one block — it's nodes scattered on the heap, linked by addresses.

```text
head → [1|·] → [2|·] → [3|NULL]
```

---

## Traversal

To visit every element, start at `head` and follow `next` until `NULL`:

```c
struct node *p = head;
while (p != NULL) {     /* NULL marks the end */
    printf("%d ", p->value);
    p = p->next;        /* step to the next node */
}
```

`p->value` is `(*p).value` — `->` dereferences and selects a field in one step.

---

## Common pitfalls

> [!watch-out] Traversal traps
> - **Forgetting `p = p->next`** — the walk never advances; infinite loop.
> - **Dereferencing `NULL`** — `p->value` when `p` is `NULL` crashes; test `p != NULL` first.
> - **Losing the head** — if you advance `head` itself instead of a temp `p`, you lose the list.
>   Walk with a **separate** pointer.

---

## Recap

> [!recap] What to hold onto
> A singly linked list is a `head` pointer into a chain of heap nodes, each holding a `value` and a
> `next` pointer; the last `next` is `NULL`. Traverse with a **separate** pointer: `p = head; while (p)
> { ...; p = p->next; }`. You trade random access for cheap insert/remove by re-pointing.

---

## See it run

The **Traverse** visualization walks a singly linked list:

- the `head` pointer and each node's `next` arrow are drawn as live links
- a walking pointer steps node → node, lighting each up, and stops at the `NULL` terminator

Press **Continue to the visualization →** to walk the list.
