---
course: SE 201
topic: Hash Tables
title: Hash Tables
order: 70
---

## Why this matters

A linked list finds a value by **walking** — O(n). A **hash table** aims for **O(1)** average lookup
by *computing* where a key belongs instead of searching for it.

It's how dictionaries, sets, and database indexes get their speed. The whole idea: turn a key into an
array index with a **hash function**.

---

## The mental model

> [!idea] Key → number → bucket
> A **hash function** maps a key to an array index: `index = hash(key) % N`, where `N` is the number
> of **buckets**. To store or find a key you hash it, jump straight to that bucket, and look only
> there — not through the whole table.

```text
"cat" → hash → 312 → 312 % 8 → bucket 0
```

---

## A concrete hash

For short string keys, a simple, verifiable hash sums the character codes:

```c
int hash(const char *key) {
    int sum = 0;
    for (int i = 0; key[i] != '\0'; i++)
        sum += key[i];      /* add each char's code */
    return sum % 8;         /* fold into 8 buckets */
}
```

`"cat"` = 99 + 97 + 116 = **312**, and `312 % 8 = 0` → bucket 0. (Real hashes mix bits better, but the
shape is the same.)

---

## Collisions are inevitable

Different keys can hash to the **same** bucket:

- `"dog"` = 100 + 111 + 103 = 314 → `314 % 8 = 2`
- `"owl"` = 111 + 119 + 108 = 338 → `338 % 8 = 2`  ← same bucket!

With 8 buckets and many keys, collisions **must** happen (pigeonhole). A hash table is defined as much
by how it **resolves** collisions as by its hash.

---

## Separate chaining

> [!idea] Each bucket is a linked list
> In **separate chaining**, every bucket holds a **chain** (a linked list) of entries. On a collision,
> add the new entry to that bucket's chain — cheapest is to **prepend**:
> ```c
> e->next = table[i];   /* link onto the front of the chain */
> table[i] = e;         /* new entry is the bucket head */
> ```
> Lookup hashes to the bucket, then walks its (short) chain comparing keys.

---

## Common pitfalls

> [!watch-out] Hash table traps
> - **Comparing string keys with `==`** — that compares pointers. Use `strcmp` to match keys.
> - **Forgetting to handle collisions** — overwriting `table[i]` loses the entry already there.
> - **A bad hash** — if everything lands in one bucket, lookup degrades to O(n) (one long chain).
> - **`% N` with the wrong N** — the modulus must equal the bucket count, or you index out of range.

---

## Recap

> [!recap] What to hold onto
> A hash table computes a key's slot — `index = hash(key) % N` — for ~O(1) average access. Collisions
> are unavoidable; **separate chaining** makes each bucket a linked list and prepends on collision
> (`e->next = table[i]; table[i] = e;`). Lookup hashes, then walks that one short chain with `strcmp`.
> A good, spread-out hash keeps chains short.

---

## See it run

This topic's visualizations make the hash arithmetic explicit:

- **Insert with chaining** — `hash(key) % 8` is drawn as an arc to the chosen bucket; `"dog"` and
  `"owl"` collide in bucket 2 and `"owl"` is chained in front of `"dog"`
- **Lookup walks the chain** — hash to the bucket, then follow the chain comparing keys

Press **Continue to the visualization →** to insert into a hash table.
