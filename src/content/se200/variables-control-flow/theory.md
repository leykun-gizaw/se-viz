---
course: SE 200
topic: Variables, if, else, while
title: Variables & Control Flow
order: 20
---

## Why this matters

A program that only runs straight down, once, can't do much. Real programs need two more powers:

- **Variables** — remember values and change them as you go
- **Control flow** — make **decisions** (`if` / `else`) and **repeat** work (`while`)

With these three — store, decide, repeat — you can already express most everyday logic.

---

## Variables: named boxes

A variable is a **named box** with a **type** and a **value**:

```c
int n = 4;    /* declare an int named n, put 4 in it */
int sum = 0;
```

- the **type** (`int`) fixes what fits and how big the box is
- the **name** lets you read and write it
- assignment `=` **stores** a value: `sum = sum + n;`

---

## A few operators

- **Arithmetic:** `+  -  *  /` and `%` (remainder, "modulo")
- **Comparison:** `==  !=  <  <=  >  >=` — each yields true/false
- `n % 2` is `0` when `n` is even, `1` when odd

> [!idea] In C, a condition is just an `int`
> There's no separate boolean type in beginner C: **`0` is false, any non-zero value is true**. A
> comparison like `n <= 4` simply produces `1` or `0`.

---

## `if` / `else`: make a decision

Run one branch **or** the other, based on a condition:

```c
if (n % 2 == 0)
    printf("even\n");
else
    printf("odd\n");
```

The `else` is optional. If the condition is true the first branch runs; otherwise the `else` branch
(if any) runs. Exactly one path is taken.

---

## `while`: repeat while true

A `while` loop runs its body **over and over** as long as the condition holds:

```c
int i = 1;
while (i <= n) {
    sum = sum + i;   /* do the work */
    i = i + 1;       /* make progress toward the exit */
}
```

Every loop needs to **make progress** toward making the condition false — here, `i` grows until
`i <= n` fails.

---

## Worked example

Put it together with `n = 4`:

```c
int n = 4, sum = 0;
if (n % 2 == 0) printf("even\n");   /* 4 is even → prints "even" */
else            printf("odd\n");
int i = 1;
while (i <= n) { sum = sum + i; i = i + 1; }
printf("sum = %d\n", sum);          /* 1+2+3+4 = 10 → "sum = 10" */
```

`n = 4` is even, and the loop adds `1 + 2 + 3 + 4`, so `sum` ends at **10**.

---

## Common pitfalls

> [!watch-out] Four bugs to expect
> - **`=` vs `==`**: `if (n = 0)` *assigns* and is always... well, `0`/false here — you meant `==`.
> - **Infinite loop**: forgetting `i = i + 1` means the condition never becomes false.
> - **Off-by-one**: `i < n` vs `i <= n` changes whether the last value is included.
> - **Uninitialized variable**: reading `sum` before you set it gives garbage. Initialize it.

---

## Recap

> [!recap] What to hold onto
> Variables are typed, named boxes you read and write with `=`. `if` / `else` picks one branch from a
> condition (where `0` is false, non-zero is true). `while` repeats its body until the condition
> fails — and the body must make progress, or it never stops.

---

## See it run

The **Variables & control flow** visualization runs exactly this program:

- `n`, `sum`, and `i` appear as cells in `main`'s frame, updating as they change
- the `if` / `else` branch lights up the path actually taken
- the `while` loop visibly iterates, `sum` climbing 1 → 3 → 6 → 10

Press **Continue to the visualization →** to watch it.
