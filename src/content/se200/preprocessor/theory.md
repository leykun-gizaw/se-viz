---
course: SE 200
topic: Preprocessor
title: The C Preprocessor
order: 105
---

## Why this matters

Before the compiler ever sees your code, another tool rewrites it: the **preprocessor** (`cpp`). It's
where `#include` and `#define` live.

> [!idea] It works on raw text, first
> The preprocessor runs **before** compilation and treats your program as **plain text** — pasting in
> files and substituting tokens. It knows nothing about C types or syntax. Lines starting with `#` are
> its directives.

---

## `#include` — paste a file

`#include` replaces its line with the **entire text** of another file (usually declarations):

- `#include <stdio.h>` — a **system** header (searched in standard paths)
- `#include "bounds.h"` — **your** header (searched next to your source first)

After this step, the header's text sits inline where the `#include` was.

---

## `#define` — object-like macros

`#define NAME text` makes the preprocessor replace every `NAME` **token** with `text`:

```c
#define MAX 100
int cap = MAX;     /* becomes:  int cap = 100; */
```

It's a name for a constant value — pure text substitution, no memory, no type.

---

## `#define` — function-like macros

A macro can take parameters; the arguments are pasted into the body **verbatim**:

```c
#define SQ(x) ((x) * (x))
int area = SQ(3 + 1);   /* becomes:  ((3 + 1) * (3 + 1)) = 16 */
```

`SQ` looks like a function call but it's text expansion — there's no function and no copy.

---

## Worked example: after `cpp`

What the compiler actually sees, after the preprocessor runs:

```c
/* #include "bounds.h" → the header's text is pasted in here */
int cap  = 100;                  /* MAX */
int area = ((3 + 1) * (3 + 1));  /* SQ(3 + 1) = 16 */
```

The `#define` lines are gone; each use has been replaced by its substituted text.

---

## Why all the parentheses

> [!watch-out] Macros are text, so parenthesize everything
> Define it carelessly as `#define SQ(x) x * x` and `SQ(3 + 1)` expands to `3 + 1 * 3 + 1`, which is
> `3 + 3 + 1 = 7` — not `16`. Because expansion is textual, wrap **each parameter and the whole body**
> in parentheses: `((x) * (x))`.

---

## More pitfalls

> [!watch-out] Macro hazards
> - **Double evaluation** — `SQ(i++)` expands to `((i++) * (i++))`, incrementing `i` twice.
> - **No type checking** — a macro will happily expand on the wrong kind of argument.
> - **A stray `;`** — `#define N 5;` then `int a[N];` becomes `int a[5;];`. Don't end value macros with `;`.
> - Prefer `const`, `enum`, or an `inline` function when one will do — they respect types and scope.

---

## Recap

> [!recap] What to hold onto
> The preprocessor runs first and edits **text**: `#include` pastes a file inline; object-like
> `#define MAX 100` replaces a token; function-like `#define SQ(x) ((x)*(x))` pastes arguments into a
> body. Because it's textual, **parenthesize macro parameters and bodies**, and beware double
> evaluation. `SQ(3 + 1)` → `((3+1)*(3+1))` → `16`.

---

## See it run

The **Macro expansion** visualization shows `macros.c` **before and after** the preprocessor:

- `#include "bounds.h"` is replaced by the header's text
- `MAX` becomes `100`; `SQ(3 + 1)` becomes `((3 + 1) * (3 + 1))`
- the `#define` lines disappear — that's the translation unit the compiler then compiles

Press **Continue to the visualization →** to watch the expansion.
