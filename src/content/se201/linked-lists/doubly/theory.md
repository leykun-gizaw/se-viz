---
course: SE 201
topic: Doubly Linked Lists
title: Doubly Linked Lists
order: 40
---

## Why this matters

A singly linked list only goes forward, and to delete a node you had to hunt for its predecessor. A
**doubly linked list** gives each node a pointer **backward** as well as forward:

- traverse in **both** directions
- delete a node **without** searching for its predecessor (you already have it)

The cost is one more pointer per node — and one more link to keep correct.

---

## The node

Two links instead of one:

```c
struct dnode {
    int value;
    struct dnode *prev;   /* the node before */
    struct dnode *next;   /* the node after */
};
```

The first node's `prev` is `NULL`; the last node's `next` is `NULL`.

```text
NULL ← [1] ⇄ [2] ⇄ [3] → NULL
```

---

## Traverse both ways

Forward is the same as before; backward follows `prev`:

```c
for (dnode_t *p = head; p != NULL; p = p->next)   /* forward */
    printf("%d ", p->value);

for (dnode_t *p = tail; p != NULL; p = p->prev)   /* backward */
    printf("%d ", p->value);
```

Every node can reach its neighbors on both sides.

---

## Insert at head — fix BOTH links

The new node needs both pointers set, **and** the old head's `prev` must point back:

```c
dnode_t *insert_head(dnode_t *head, int value) {
    dnode_t *new = malloc(sizeof(dnode_t));
    new->value = value;
    new->prev  = NULL;
    new->next  = head;            /* forward link */
    if (head != NULL)
        head->prev = new;         /* the backward link — easy to forget! */
    return new;                   /* new is the head */
}
```

---

## The backward link is the catch

> [!watch-out] Both directions must agree
> Every doubly linked operation has to keep `prev` and `next` **consistent**. Set `new->next = head`
> but forget `head->prev = new`, and the backward chain is broken — a backward traversal won't find
> the new node. For each link you make forward, make the matching link backward.

---

## More pitfalls

> [!watch-out] Doubly linked traps
> - **The empty list** — if `head == NULL`, don't dereference `head->prev`; guard it.
> - **Endpoints** — the head's `prev` and the tail's `next` must stay `NULL`.
> - **Deletion** — relink **both** neighbors: `node->prev->next = node->next` *and*
>   `node->next->prev = node->prev` (guarding `NULL` ends), then free.

---

## Recap

> [!recap] What to hold onto
> A doubly linked node has `prev` and `next`, so you can walk both ways and delete in place. The
> discipline: **every forward link needs its matching backward link**. Insert at head sets
> `new->next = head` **and** `head->prev = new` (when `head` isn't `NULL`); endpoints keep their outer
> pointers `NULL`.

---

## See it run

This topic's visualizations show both links staying consistent:

- **Doubly: traverse both ways** — forward via `next`, backward via `prev`, over the same nodes
- **Doubly: insert at head** — `new->next`, `head->prev`, and `head = new` each shown as a distinct
  arrow re-target, so you see the backward link being fixed

Press **Continue to the visualization →** to traverse both ways.
