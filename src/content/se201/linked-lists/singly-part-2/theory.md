---
course: SE 201
topic: Singly Linked Lists Part 2
title: Deleting from a Singly Linked List
order: 30
---

## Why this matters

Removing a node is the trickiest basic list operation, because a singly linked node has **no pointer
back** to the one before it. To unlink a node you need its **predecessor** — and you must free memory
in exactly the right order.

Get this right and you understand pointers as well as you ever will.

---

## The mental model

> [!idea] Bridge over the doomed node
> To delete `current`, the node **before** it must skip over it: set `prev->next = current->next`.
> That bridges the list around `current`, after which `current` is unreferenced and can be freed.
> So you must track `prev` as you search.

```text
prev → [doomed] → rest        becomes        prev ─────────→ rest
```

---

## Find it, remembering prev

Walk with **two** pointers — `current` and the node behind it:

```c
node_t *prev = NULL, *current = head;
while (current != NULL && current->value != target) {
    prev = current;          /* remember the predecessor */
    current = current->next;
}
/* current is the match (or NULL if not found) */
```

---

## Unlink, then free — in that order

```c
prev->next = current->next;  /* 1. bridge prev around current */
free(current);               /* 2. now it's safe to free */
```

> [!watch-out] Read `current->next` BEFORE you free
> Reverse the order — `free(current)` then read `current->next` — and you're dereferencing a
> **freed** pointer (use-after-free) to find the rest of the list. Undefined behavior, and you may
> lose everything after the deleted node. Bridge first, free second.

---

## Mind the head and the missing node

> [!watch-out] Edge cases
> - **Deleting the head** (`prev == NULL`): there's no predecessor — move `head = current->next;`
>   instead, then free.
> - **Value not found** (`current == NULL`): don't dereference it — just return.
> - Forgetting to `free` the unlinked node **leaks** it.

---

## Recap

> [!recap] What to hold onto
> Delete by searching with `current` **and** `prev`; bridge with `prev->next = current->next`, **then**
> `free(current)` — never free first (use-after-free). Special-case deleting the head (`prev == NULL`
> → move `head`) and "not found" (`current == NULL`). Unlink, then free, then you're done.

---

## See it run

The **Delete a node** visualization is pointer surgery made visible:

- `prev` and `current` walk the list to find the target
- `prev->next` re-points **around** the doomed node (the bridge)
- the unlinked node turns to the freed state — and you can see why reading its `next` afterward would
  be a use-after-free

Press **Continue to the visualization →** to delete a node.
