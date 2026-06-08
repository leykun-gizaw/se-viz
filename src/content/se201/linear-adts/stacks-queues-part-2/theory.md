---
course: SE 201
topic: Stacks, Queues, LIFO, FIFO Part 2
title: Linked Stacks & Queues
order: 60
---

## Why this matters

The array stack and queue had a ceiling — a fixed `CAP`. Back them with a **linked list** instead and
they grow as needed, one node at a time. Same LIFO / FIFO rules, no fixed capacity.

The trick is choosing **which end** to operate on so every operation stays **O(1)** — no walking.

---

## Linked stack: push/pop at the head

A stack only touches one end, and the **head** of a list is the cheap end:

```c
void push(node_t **top, int x) {
    node_t *n = malloc(sizeof(node_t));
    n->value = x;
    n->next  = *top;   /* link on top of the old stack */
    *top = n;          /* new node is the new top */
}
int pop(node_t **top) {
    node_t *n = *top;
    *top = n->next;    /* unlink the head */
    int v = n->value;
    free(n);
    return v;          /* LIFO: last pushed comes back first */
}
```

Both are **O(1)** — prepend and remove-head. (Note the `node_t **`: to change the caller's `top`
pointer, pass its address.)

---

## Linked queue: head and tail

FIFO adds at one end and removes from the other, so keep **two** pointers — `head` and `tail`:

- **dequeue** from the `head` (remove-head is O(1))
- **enqueue** at the `tail` (with a `tail` pointer, append is O(1) — no walk)

```c
/* enqueue: link after tail, then advance tail */
if (tail) tail->next = n;
else      head = n;     /* was empty */
tail = n;
n->next = NULL;
```

---

## Keep head and tail in sync

> [!watch-out] The empty-list transitions
> The bugs live at the boundaries. **Enqueue into an empty queue** must set **both** `head` and
> `tail` to the new node. **Dequeue the last element** must set `tail = NULL` when `head` becomes
> `NULL` — otherwise `tail` dangles at a freed node. Check the empty cases on every enqueue/dequeue.

---

## Array vs linked — the trade-off

| | Array-backed | Linked |
| --- | --- | --- |
| Capacity | fixed (`CAP`) | grows as needed |
| Memory | one block, no per-item overhead | a node (+ pointer) per item |
| Per-op cost | O(1), no allocation | O(1), but `malloc`/`free` each time |

Pick array when the size is bounded and known; linked when it isn't.

---

## Recap

> [!recap] What to hold onto
> Back a stack/queue with a list to drop the fixed-capacity limit. A **linked stack** pushes/pops at
> the **head** (O(1)). A **linked queue** keeps **head + tail**: dequeue at head, enqueue at tail
> (O(1)). Handle the empty-queue transitions — enqueue-into-empty sets both pointers; dequeue-last
> resets `tail` to `NULL`.

---

## See it run

This topic's visualizations show node-backed ADTs:

- **Linked stack (LIFO)** — push prepends a node at the head; pop unlinks and frees it
- **Linked queue (FIFO)** — enqueue links a node at the tail, dequeue unlinks from the head, with
  `head`/`tail` tracked as live arrows

Press **Continue to the visualization →** to push onto a linked stack.
