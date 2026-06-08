---
course: SE 200
topic: Hello, World
title: Hello, World
order: 10
---

## Why start here

Every C programmer writes "Hello, World" first — and it's not a throwaway. A tiny program that
prints one line proves a surprising amount:

- Your **compiler** and **toolchain** are installed and working
- You can **edit → compile → run** a program end to end
- You've met the **skeleton** every C program is built on

Get this running and the rest of the course is just filling in the middle.

---

## The whole program

```c
#include <stdio.h>

int main(void) {
    printf("Hello, World!\n");
    return 0;
}
```

Five lines, and every one earns its place. The next slides take them one at a time.

---

## Anatomy, line by line

- `#include <stdio.h>` — pull in the **standard I/O** declarations (so `printf` is known)
- `int main(void)` — the function where the program **begins**; returns an `int`
- `{ ... }` — the **body**: the statements that run, in order
- `printf("Hello, World!\n");` — print text to the screen
- `return 0;` — hand an **exit status** back to the operating system

---

## `#include` runs before compiling

> [!idea] The preprocessor goes first
> Lines starting with `#` are handled by the **preprocessor** before the compiler proper. `#include
> <stdio.h>` literally pastes in the declarations for `printf`, `scanf`, and friends. Without it, the
> compiler doesn't know what `printf` is.

---

## `main` is where it begins

When you run the program, the system calls **`main`** — that's the entry point. Execution starts at
its first statement and runs down, top to bottom.

`main` gets one **stack frame**: its own workspace for its local variables. When `main` returns, the
program ends. (You'll watch that single frame appear in the visualization.)

---

## `printf` writes to the screen

`printf` sends text to **standard output** (your terminal).

- The text in `"..."` is printed literally...
- ...except **escape sequences** like `\n`, which is a **newline** (move to the next line)
- It's declared in `<stdio.h>` — that's why we include it

`printf("Hello, World!\n");` prints the greeting, then moves the cursor to a fresh line.

---

## `return 0` is the exit status

`main` returns an `int` to the operating system: the program's **exit status**.

- `0` means **success** — "everything went fine"
- A non-zero value signals an **error** (scripts and tools check this)

`return 0;` at the end of `main` is the conventional "all good."

---

## Compile, then run

C is a **compiled** language — a separate step turns your source into a runnable program:

1. Write `hello.c`
2. **Compile** it: `cc hello.c -o hello` (or `gcc ...`)
3. **Run** it: `./hello`
4. See `Hello, World!` printed

Edit the source and you must compile again — the executable doesn't update itself.

---

## First-program mistakes

> [!watch-out] The classic beginner trip-ups
> Forgetting the `;` at the end of a statement; leaving off `#include <stdio.h>` (so `printf` is
> "implicitly declared"); writing `\n` outside the quotes; or omitting `return` / the `int` on
> `main`. The compiler's first error message usually points at the line — read it.

---

## Recap

> [!recap] What to hold onto
> A minimal C program is `#include <stdio.h>`, then `int main(void) { ... return 0; }`. Execution
> begins at `main`, statements run top to bottom in its stack frame, `printf` writes to the screen
> (with `\n` for a newline), and `return 0` reports success. You **compile** the source, then **run**
> the executable.

---

## See it run

The **Hello, World** visualization shows exactly this program:

- `main`'s single stack frame appears as the program starts
- the line highlights move down through `printf` and `return 0`
- the console panel shows `Hello, World!` printed

Press **Continue to the visualization →** to step through it.
