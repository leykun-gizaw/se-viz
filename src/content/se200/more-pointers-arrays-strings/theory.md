---
course: SE 200
topic: More Pointers, Arrays and Strings
title: More Pointers — Strings & Pass-by-Pointer
order: 60
---

## Why this matters

You know what a pointer is. Now you put it to work on the two jobs pointers do all day:

- **Walk a string** — march a pointer along characters until the `\0`
- **Pass by pointer** — hand a function an address so it can change your variable

Both are the same idea (`*p` reaches the box an address names) applied to real tasks.

---

## Quick refresher

> [!idea] The model, in one line
> A pointer holds an **address**. `*p` is the value **at** that address; `&x` **produces** the address
> of `x`. Adding `1` to a pointer advances by **one element** (its type's size), which is how you walk
> arrays and strings.

---

## Pattern: walk a string to the `\0`

A C string ends in a null terminator `\0`. To process it, march a pointer forward until you hit that
byte:

- start a pointer at the first character
- while `*p` is not `\0`: do the work, then `p++`
- stop at the terminator

The pointer **is** your position in the string.

---

## Worked example: `my_strlen`

Count characters by walking to the `\0`:

```c
int my_strlen(const char *s) {
    int n = 0;
    while (*s != '\0') {   /* not yet at the terminator */
        n++;
        s++;               /* advance one char */
    }
    return n;
}
```

For `"hi"` (`'h','i','\0'`) the loop runs twice, so it returns **2** — the `\0` is not counted.

---

## Pattern: pass by pointer

C passes arguments **by value** (a copy), so a function can't change a caller's variable directly. To
let it, pass the variable's **address** and work through the pointer.

```c
void swap(int *a, int *b) {
    int t = *a;   /* read through the pointer */
    *a = *b;      /* write through the pointer */
    *b = t;
}
```

---

## Why `swap` works

> [!idea] It never sees x and y — only their addresses
> `swap(&x, &y)` passes the **addresses** of `x` and `y`. Inside, `*a` and `*b` reach back across the
> stack into `main`'s frame and exchange the actual values. Pass `x, y` (not `&x, &y`) and `swap` would
> shuffle copies and change nothing.

---

## Common pitfalls

> [!watch-out] String + pointer traps
> - **No terminator** — walking a `char` buffer that isn't `\0`-terminated runs off the end.
> - **Forgetting `p++`** — the walk never advances, so the loop never ends.
> - **Passing values, not addresses** — `swap(x, y)` (no `&`) has no effect on the caller.
> - **Writing through a `const` pointer** — `const char *s` means "don't modify what `s` points at."

---

## Recap

> [!recap] What to hold onto
> Walk a string by marching a pointer (`*p` until `\0`, then `p++`). Let a function change a caller's
> variable by passing the variable's **address** and writing through the pointer (`*a = ...`). In both,
> the pointer is just an address you follow — `swap` and `my_strlen` are that one idea applied.

---

## See it run

This topic has two visualizations:

- **Walking a string (strlen)** — a pointer marches to the `\0`, its arrow gliding while the counter
  pulses each step.
- **Pass-by-pointer (swap)** — the pointers reach across frames into `main` and the two values
  visibly exchange.

Press **Continue to the visualization →** to start with *Walking a string*.
