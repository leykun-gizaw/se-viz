---
course: SE 200
topic: Static Libraries
title: Static Libraries
order: 90
---

## Why this matters

Real programs are **many** source files, and you reuse code across projects. Two ideas make that
practical:

- **Separate compilation** — compile each `.c` on its own, not the whole program every time
- **Static libraries** — bundle reusable object files into one archive you link against

This is about how source becomes a runnable program — the build, not the runtime.

---

## Our example: a tiny shapes library

Every file that uses the library includes its header. The header only **declares** the functions —
name, parameter types, return type — with **no code**:

```c
/* shapes.h — the library's interface */
/* the #ifndef guard stops double inclusion — see Preprocessor */
#ifndef SHAPES_H
#define SHAPES_H

double area_circle(double r);
double area_square(double s);

#endif
```

---

## The library's code

Each library file **defines** one function — the actual code. These two files become the library:

```c
/* circle.c */
#include "shapes.h"
double area_circle(double r) { return 3.14159 * r * r; }

/* square.c */
#include "shapes.h"
double area_square(double s) { return s * s; }
```

---

## The program that uses it

`main.c` calls both functions but contains **neither** — it only has their declarations:

```c
#include <stdio.h>
#include "shapes.h"

int main(void) {
    printf("%.2f\n", area_circle(1.0));   /* 3.14 */
    printf("%.2f\n", area_square(2.0));   /* 4.00 */
    return 0;
}
```

How does a call reach code that lives in another file? That is the whole story of this deck.

---

## Separate compilation

Each `.c` file is compiled **on its own** into an **object file** (`.o`) with `cc -c`:

```pipeline
caption: cc -c main.c · cc -c circle.c · cc -c square.c — three independent runs
main.c | source | @0
circle.c | source | @0
square.c | source | @0
cc1: cc -c | process | compile | @1
cc2: cc -c | process | compile | @1
cc3: cc -c | process | compile | @1
main.o | object | @2
circle.o | object | @2
square.o | object | @2
main.c -> cc1 -> main.o
circle.c -> cc2 -> circle.o
square.c -> cc3 -> square.o
```

---

## What is inside a `.o`

An object file holds two things:

- **machine code** for the functions in that one `.c`
- a **symbol table**: the names it **defines**, and the names it **needs** from elsewhere

Every call in `main.c` to a function it doesn't define becomes a **need**:

```symbol-table
caption: main.o defines main — and needs three functions it never saw the code for
file main.o
defines: main
needs: area_circle, area_square, printf
```

---

## Unresolved symbols are normal

`nm` lists an object's symbol table. `T` = defined here (in the code section); `U` = **undefined** here:

```text
$ nm main.o
                 U area_circle
                 U area_square
0000000000000000 T main
                 U printf
```

> [!idea] A `.o` is allowed to have holes
> `main.c` only needed the **declarations** in `shapes.h` to compile. Filling the holes with real
> code is a different tool's job: the **linker**.

---

## The full build pipeline

Source flows left to right through three tools into one executable:

```pipeline
caption: .c → .o → .a → executable — compile, archive, link
main.c | source | @0
circle.c | library source | @0
square.c | library source | @0
cc: cc -c | process | compile | @1
main.o | object | @2
circle.o | object | @2
square.o | object | @2
ar: ar rcs | process | archive | @3
libshapes.a | static library | @4
ld | process | link | @5
app | executable | @6 | accent
main.c -> cc
circle.c -> cc
square.c -> cc
cc -> main.o
cc -> circle.o
cc -> square.o
circle.o -> ar
square.o -> ar
ar -> libshapes.a
main.o -> ld
libshapes.a -> ld
ld -> app
```

---

## Archiving with `ar`

`ar` bundles object files into one **archive** — a `.a` static library:

```text
ar rcs libshapes.a circle.o square.o
```

```pipeline
circle.o | object | @0
square.o | object | @0
ar: ar rcs | process | archive | @1
libshapes.a | 2 members + index | @2
circle.o -> ar
square.o -> ar
ar -> libshapes.a
```

`r` inserts (or replaces) members · `c` creates the archive · `s` writes the symbol index.

---

## The archive index

The `s` in `ar rcs` writes an **index**: which member defines which symbol. `nm -s` prints it:

```text
$ nm -s libshapes.a
Archive index:
area_circle in circle.o
area_square in square.o
```

The linker looks a needed symbol up in this index to find the member to pull — no scanning every
member. (`ranlib libshapes.a` writes the same index for an archive made without `s`.)

---

## Linking, drawn

`cc main.o -L. -lshapes -o app` hands the objects to the linker `ld`, which matches every **need**
to a **definition**:

```symbol-table
file main.o @0
defines: main
needs: area_circle, area_square, printf
file libshapes.a(circle.o) @1
defines: area_circle
file libshapes.a(square.o) @1
defines: area_square
file libc.so.6 @1
defines: printf
main.o:area_circle -> libshapes.a(circle.o):area_circle
main.o:area_square -> libshapes.a(square.o):area_square
main.o:printf -> libc.so.6:printf
```

The two archive members are **copied into `app`**. `printf` comes from the shared C library instead.

---

## The whole build, start to finish

Three tools, four commands — then run it:

```text
$ cc -c main.c circle.c square.c          # compile: three .o files
$ ar rcs libshapes.a circle.o square.o    # archive
$ cc main.o -L. -lshapes -o app           # link
$ ./app
3.14
4.00
```

`cc -c` with several files still compiles each one **separately**: one `.o` per `.c`.

---

## A link error you will see

Add a declaration to `shapes.h`, and a call to `main.c` — but **no** `.c` file that defines it:

```c
double area_triangle(double b, double h);      /* shapes.h */
printf("%.2f\n", area_triangle(3.0, 4.0));     /* main.c */
```

`cc -c main.c` compiles cleanly — the declaration is enough. **Linking** fails:

```text
$ cc main.o -L. -lshapes -o app
/usr/bin/ld: main.o: in function `main':
main.c:(.text+0x…): undefined reference to `area_triangle'
collect2: error: ld returned 1 exit status
```

`ld` is complaining, not the compiler: `main.c` itself is fine.

---

## "undefined reference", drawn

```symbol-table
caption: every need found a home — except area_triangle
file main.o @0
defines: main
needs: area_circle, area_square, area_triangle!, printf
file libshapes.a(circle.o) @1
defines: area_circle
file libshapes.a(square.o) @1
defines: area_square
file libc.so.6 @1
defines: printf
main.o:area_circle -> libshapes.a(circle.o):area_circle
main.o:area_square -> libshapes.a(square.o):area_square
main.o:printf -> libc.so.6:printf
```

No box defines `area_triangle`, so `ld` has nothing to point it at: *undefined reference*.

---

## Link order

`ld` reads inputs **left to right**, pulling archive members only for symbols **already needed**.

✓ `cc main.o -L. -lshapes -o app`

```symbol-table
caption: main.o's needs are known by the time libshapes.a is read
file main.o
needs: area_circle, area_square
file libshapes.a
defines: area_circle, area_square
main.o:area_circle -> libshapes.a:area_circle
main.o:area_square -> libshapes.a:area_square
```

✗ `cc -L. -lshapes main.o -o app` → *undefined reference to `area_circle'*

```symbol-table
caption: libshapes.a was read before anything needed it — nothing was pulled
file libshapes.a
defines: area_circle, area_square
file main.o
needs: area_circle!, area_square!
main.o:area_circle -x libshapes.a:area_circle
main.o:area_square -x libshapes.a:area_square
```

---

## Header vs library

The `.h` and the `.a` answer different questions, at different times:

```pipeline
main.c | source | @0
shapes.h | declares · compile time | @0
cc: cc -c | process | compile | @1
main.o | object | @2
libshapes.a | defines · link time | @2
ld | process | link | @3
app | executable | @4 | accent
main.c -> cc
shapes.h -> cc
cc -> main.o
main.o -> ld
libshapes.a -> ld
ld -> app
```

You need **both**: the header's `double area_circle(double r);` to compile `main.c`, and the
library's **definition** of it to link `app`.

---

## Why "static"

"Static" means the library's code is **copied into the executable at link time** — so `app` no
longer needs `libshapes.a` at all:

```text
$ rm libshapes.a
$ ./app
3.14
4.00
```

The trade-off: every program that links it carries its **own copy** of that code (bigger binaries).

---

## Static vs dynamic

| | Static library (`.a`) | Shared library (`.so`) |
| --- | --- | --- |
| Code joins the program | at **link time** — copied into `app` | at **run time** — loaded when `app` starts |
| Needed to run `app`? | no | yes — the `.so` must be found |
| Binary size | bigger (its own copy) | smaller (one copy, shared) |
| Library bug fix | relink every program | replace the `.so` once |

Shared libraries are a topic for later. The `printf` in our `app` already comes from one.

---

## Incremental rebuild

Change `circle.c`, and only **its** path re-runs. `main.o` and `square.o` are reused as they are:

```pipeline
caption: amber = re-runs after editing circle.c · everything else is reused
main.c | source | @0
circle.c | source | @0 | highlight
square.c | source | @0
cc1: cc -c | process | compile | @1
cc2: cc -c | process | compile | @1 | highlight
cc3: cc -c | process | compile | @1
main.o | object | @2
circle.o | object | @2 | highlight
square.o | object | @2
ar: ar rcs | process | archive | @3 | highlight
libshapes.a | static library | @4 | highlight
ld | process | link | @5 | highlight
app | executable | @6 | highlight
main.c -> cc1 -> main.o
circle.c -> cc2 -> circle.o
square.c -> cc3 -> square.o
circle.o -> ar
square.o -> ar
ar -> libshapes.a
main.o -> ld
libshapes.a -> ld
ld -> app
```

```text
cc -c circle.c  &&  ar rcs libshapes.a circle.o  &&  cc main.o -L. -lshapes -o app
```

---

## Common pitfalls

> [!watch-out] Build & link traps
> - **"undefined reference to ..."** — a need nothing defines: a missing `.c`, or a library you
>   forgot to link (*"undefined reference", drawn*).
> - **Link order** — archives go **after** the objects that use them (*Link order*).
> - **Header vs library** — the `.h` only **declares**; the `.a` **defines**. You need both.
> - **Recompiling everything** — change one `.c`, rebuild only its `.o`, then relink (*Incremental
>   rebuild*).

---

## Commands recap

| Command | Stage | Result |
| --- | --- | --- |
| `cc -c circle.c` | compile | `circle.o` (likewise `main.o`, `square.o`) |
| `ar rcs libshapes.a circle.o square.o` | archive | `libshapes.a` with an index |
| `ar t libshapes.a` | inspect | lists `circle.o`, `square.o` |
| `cc main.o -L. -lshapes -o app` | link | `app` |

`-L.` adds the current directory to the library search path; `-lshapes` means `libshapes.a`.

---

## Recap

> [!recap] What to hold onto
> Compile each `.c` to a `.o` independently — its symbol table records what it defines and what it
> still needs. Bundle reusable objects into a `.a` with `ar rcs`. Link your objects **before** the
> archive; `ld` matches every need to a definition and **copies** the archive members it uses into a
> self-contained executable. Static = copied in at link time, so the binary stands alone.

---

## See it run

The **Build pipeline** visualization animates exactly this, left to right:

- `main.c` / `circle.c` / `square.c` compile (`cc -c`) into `.o` objects
- `ar` archives `circle.o` + `square.o` into `libshapes.a`
- `ld` links `main.o` against the archive into the executable `app`, one stage at a time

Press **Continue to the visualization →** to watch the build.
