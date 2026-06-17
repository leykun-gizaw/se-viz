---
course: SE 201
topic: The C Memory Map
title: The C Memory Map
order: 5
---

## Why this matters

Every variable in a C program lives **somewhere** — and *where* decides how long it lives, whether
you can change it, and who cleans it up.

"On the stack" and "on the heap" is the half of the story you've met. The full picture has more
regions, and knowing them turns mysterious bugs — a crash writing to a string literal, a local array
that "disappears" — into things you can predict.

---

## The map

A running program's memory is laid out in regions. Low addresses at the bottom, high at the top:

| Region | What lives here | Lifetime |
| --- | --- | --- |
| **Stack** | locals, parameters, frames | per function call |
| **Heap** | `malloc` blocks | until you `free` |
| **`.bss`** | zero / uninitialized globals | whole program |
| **`.data`** | initialized globals & statics | whole program |
| **`.rodata`** | string literals, `const` | whole program (read-only) |
| **Text** | the compiled code | whole program (read-only) |

The **stack grows down**, the **heap grows up**, toward each other.

---

## The static segment

The bottom three data regions — `.data`, `.bss`, `.rodata` — are the **static segment**: storage for
globals and `static`s that exists for the *entire* run.

- **`.data`** — globals with a **nonzero initializer**: `int counter = 7;`
- **`.bss`** — globals with **no / zero initializer**: `int total;` (zeroed at load — it costs no
  space in the executable, just a size)
- **`.rodata`** — **read-only** data: string literals (`"rows"`) and `const` values

> [!idea] Lifetime, not syntax, picks the region
> A global isn't "special" because of where you write it — it's static because it lives for the whole
> program. That's why it goes in the static segment, never on the stack.

---

## The code IS the text segment

There's one more read-only region: **text**, the machine code itself.

In SE-Viz the **code panel on the left is the text segment** — so the memory canvas draws the other
regions: the static segment, the heap, and the stack. You're always looking at the whole map.

---

## A local array is stack memory

The classic trap:

```c
int squares[3];   /* a LOCAL array */
int *heap = malloc(3 * sizeof(int));
```

`squares` is **on the stack**, inside the current frame — declaring an array does **not** touch the
heap. Only `malloc` allocates heap memory. When the function returns, `squares` is gone; the `malloc`
block lives on until you `free` it.

---

## Pitfall: writing to `.rodata`

> [!watch-out] String literals are read-only
> `char *p = "rows";` makes `p` point into `.rodata`. Reading it is fine, but `p[0] = 'R';` writes to
> read-only memory — a crash (segfault) on most systems. Want a writable string? Copy it into a stack
> or heap buffer first: `char buf[5]; strcpy(buf, "rows");`

---

## Pitfall: returning a local's address

> [!watch-out] Don't return the address of a stack local
> A local (scalar or array) dies when its function returns, so a pointer to it **dangles**. Returning
> `&local` or a local array hands back an address that's already invalid. To return data that
> outlives the call, put it in the heap (`malloc`) or in static storage.

---

## Worked example

```c
int counter = 7;            /* .data   */
int total;                  /* .bss    */
const char *label = "rows"; /* .rodata */

int main(void) {
    int n = 3;              /* stack          */
    int squares[3];         /* stack (array!) */
    int *heap = malloc(12); /* heap           */
    total = counter + squares[2];
}
```

Five declarations, five regions. The visualization steps through exactly this.

---

## Recap

> [!recap] Where does it live?
> **Stack** — locals & frames, per call. **Heap** — `malloc`, until `free`. **Static segment** —
> globals & statics for the whole run: `.data` (initialized), `.bss` (zeroed), `.rodata` (read-only).
> **Text** — the code. A local array is stack memory; a string literal is read-only `.rodata`.

---

## See it run

The visualization puts one small program across **all** the regions at once:

- **Memory segments — all regions** — watch `counter` (.data), `total` (.bss), and `"rows"`
  (.rodata) sit in the static segment while a local array fills on the stack and a `malloc` block
  fills on the heap — then `free` leaves the stack pointer dangling.

Press **Continue to the visualization →** to see the whole map in motion.
