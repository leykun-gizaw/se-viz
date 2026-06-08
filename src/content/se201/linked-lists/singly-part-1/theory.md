---
course: SE 201
topic: Singly Linked Lists Part 1
title: Inserting into a Singly Linked List
order: 20
---

## Why this matters

A list is only useful if you can **grow** it. Two insertions cover most cases:

- **at the head** — prepend, the fast O(1) case
- **at the tail** — append, which means walking to the end first

Both are just **pointer re-wiring** — no shifting, unlike arrays. The subtlety is doing the steps in
the right order.

---

## Insert at head

Make a new node, point it at the old first node, then move `head`:

```c
node_t *insert_head(node_t *head, int value) {
    node_t *new = malloc(sizeof(node_t));
    new->value = value;
    new->next  = head;   /* 1. link new node to the old list */
    head = new;          /* 2. new node becomes the head */
    return head;
}
```

This is **O(1)** — no walking, just two pointer writes.

---

## Order matters at the head

> [!watch-out] Link before you move
> Do `new->next = head;` **before** `head = new;`. If you set `head = new` first, you've lost the
> address of the old first node — the rest of the list leaks, and `new->next` points at itself or
> garbage. Always link the new node into the list before you re-point `head`.

---

## Insert at tail

There's no direct pointer to the end, so **walk** there, then link:

```c
node_t *last = head;
while (last->next != NULL)   /* stop at the last node */
    last = last->next;
last->next = new;            /* append; new->next is already NULL */
new->next  = NULL;
```

This is **O(n)** — you traverse the whole list to reach the tail. (Keeping a `tail` pointer makes it
O(1), a later refinement.)

---

## Don't forget the empty list

> [!watch-out] The head == NULL case
> Insert-at-tail by walking assumes there **is** a last node. If `head == NULL` (empty list), there's
> nothing to walk — the new node simply becomes the head. Handle the empty case first, or
> `last->next` dereferences `NULL`.

---

## Recap

> [!recap] What to hold onto
> Insert at head: `new->next = head; head = new;` — **O(1)**, and link **before** moving `head`.
> Insert at tail: walk `while (last->next)` to the end, then `last->next = new;` — **O(n)** unless you
> keep a tail pointer. Insertion is re-pointing, not shifting — but mind the order and the empty list.

---

## See it run

This topic's visualizations show insertion as live pointer re-wiring:

- **Insert at head** — the new node's `next` links to the old head, then `head` re-targets the new node
- **Insert at tail** — a pointer walks to the last node, then its `next` arrow swings to the new node

Press **Continue to the visualization →** to insert at the head.
