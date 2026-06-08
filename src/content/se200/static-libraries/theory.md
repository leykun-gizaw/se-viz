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

## Separate compilation

> [!idea] Each `.c` becomes a `.o` independently
> The compiler turns one source file into one **object file** (`.o`) of machine code with a table of
> symbols it defines and ones it still needs. Change one `.c`, recompile just that one — not the rest.

```text
cc -c main.c      ->  main.o
cc -c circle.c    ->  circle.o
cc -c square.c    ->  square.o
```

---

## The build pipeline

Source flows left to right through tools into one executable:

```text
main.c   ┐                  ┌→ main.o ───────────────┐
circle.c ├→ cc -c (compile) ┼→ circle.o ┐            ├→ ld → app
square.c ┘                  └→ square.o ┴→ ar → .a ──┘
```

Each stage consumes files and produces the next: `.c` → `.o` → `.a` → executable.

---

## Archiving a static library

The `ar` tool bundles object files into a single **archive** — a `.a` static library:

```text
ar rcs libshapes.a circle.o square.o
```

`libshapes.a` is just a container holding `circle.o` and `square.o` (plus an index). It's the reusable
unit you can drop into other projects.

---

## Linking

> [!idea] The linker copies in the code it needs
> `ld` (the linker) takes `main.o`, finds its **unresolved symbols** (functions it calls but doesn't
> define), and resolves them against `libshapes.a` — **copying** the needed object code into one
> self-contained executable, `app`.

---

## Why "static"

"Static" means the library's code is **copied into the executable at link time**. So:

- the finished `app` **does not need** `libshapes.a` to run — it's all inside
- the trade-off: every program that links it gets its own copy (bigger binaries)

(A *shared* / dynamic library, by contrast, is loaded at run time — a topic for later.)

---

## Common pitfalls

> [!watch-out] Build & link traps
> - **"undefined reference to ..."** — you compiled but forgot to **link** the library that defines it.
> - **Link order** — archives go **after** the objects that use them (`cc main.o -lshapes`, not before).
> - **Header vs library** — the `.h` only **declares**; the `.a` **defines**. You need both.
> - **Recompiling everything** — change one `.c`, rebuild only its `.o`, then relink.

---

## Recap

> [!recap] What to hold onto
> Compile each `.c` to a `.o` independently. Bundle reusable objects into a `.a` archive with `ar`.
> Link your program's objects against the archive with `ld` — it **copies** the needed code into a
> self-contained executable. Static = copied in at link time, so the binary stands alone.

---

## See it run

The **Build pipeline** visualization animates exactly this, left to right:

- `main.c` / `circle.c` / `square.c` compile (`cc -c`) into `.o` objects
- `ar` archives `circle.o` + `square.o` into `libshapes.a`
- `ld` links `main.o` against the archive into the executable `app`, one stage at a time

Press **Continue to the visualization →** to watch the build.
