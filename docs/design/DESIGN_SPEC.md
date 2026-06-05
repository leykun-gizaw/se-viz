# SE-Viz — Visual Design Prompt

Use this with a design/mockup tool (e.g. Claude, v0, Figma AI) to generate visual style
explorations for **SE-Viz**, a teaching tool that replaces PowerPoint for live C and
data-structures lessons. Generate static, high-fidelity mockup screens — not working code.

## What the product is
An instructor stands in front of a class and *runs C code visually*. The screen shows the
source with the current line highlighted, an animated picture of memory (call stack, heap,
pointers, data structures) changing step by step, and a one-line narration of what's happening.
It is used live and projected, and also explored by students afterward.

## Screens to mock up
The style must work for the **entire SE 200 / SE 201 curriculum**, not just pointers and lists.
Mock up these so the system is validated against every layout it will have to support.

**Core memory screens** (these share one memory canvas):
1. **Recursion / call stack** — `factorial(4)` mid-recursion: several stacked frames, each with
   its own `n` and return value, the deepest frame highlighted as active.
2. **Linked-list traversal** — a stack frame with `head` and `current` pointers, a row of
   heap-allocated nodes connected by `next` arrows, the `current` pointer aimed at one node.
   (Doubly linked = the same with `prev` arrows too.)
3. **Pointer arithmetic over an array** — a contiguous array of cells with indices and
   addresses, a pointer `p` sitting on one element, showing `*(p + 2)`.
4. **malloc / free (the heap)** — heap blocks with addresses; show the four allocation states
   visually: allocated, freed, dangling pointer (points at freed memory), and a leaked block
   (no pointer references it).
5. **Hash table** — an array of buckets, a "hash function" box mapping a key to a bucket index,
   and a collision chain (a small linked list) hanging off one bucket.
6. **Stack / queue (LIFO / FIFO)** — a sequence with a highlighted `top` (stack) or
   `front`/`rear` (queue) and a push/pop or enqueue/dequeue in progress.

**Special views** (apply the same color/type system, but the canvas isn't live memory):
7. **Static-library build pipeline** — a left-to-right diagram: `.c` source → `.o` object →
   `.a` archive → linked binary. A concept diagram, not a memory snapshot.
8. **Preprocessor expansion** — a before → after view of source: `#define`/`#include` on the
   left, the textually-substituted result on the right.
9. **Debugging (dual trace)** — the same program run two ways (buggy vs fixed) side by side,
   with the step where their state first diverges flagged.

Plus the shared chrome on every screen: a slim top bar (product name, lesson breadcrumb,
`Step k / N`, and transport controls: reset, step-back, play/pause, step-forward), an optional
**console/output panel** for `printf` output, and a narration bar at the bottom. Default
layout: code panel and memory panel side by side; narration spans the width.

## Visual direction (the look I want)
- **IDE-grade and calm**, not playful or gamified. It should feel like a refined code editor
  that happens to draw memory. Flat surfaces, no gradients, no drop shadows, no neon/glow.
- **Dark-first** (it's projected in classrooms — reduce glare), with a clean high-contrast
  light variant. Every color must read in both.
- **Generous whitespace**, rounded cards for memory entities (≈8–12px radius), thin 0.5px
  borders, clear typographic hierarchy.

## Color = meaning (semantic, not decorative)
Assign each memory concept one consistent color and reuse it everywhere:
- **Pointers, addresses, and arrows → azure (blue).** Pointer cells, `next`/`prev` links, and
  every connector arrow share this hue. This is the signature accent.
- **Heap-allocated data (nodes, malloc'd blocks) → teal.**
- **Stack frames and scalar locals → neutral / desaturated** (let them recede; the action is
  in pointers and heap).
- **Active element → a stronger ring + a small `active` / `current` badge.** Exactly one thing
  is "current" per step.
- **Value just changed → a brief highlight** (e.g. soft amber/green flash) that fades.
- **Allocation states (heap)** must be visually distinct: allocated (normal teal), freed
  (desaturated/hatched), dangling (a pointer arrow into a freed block, flagged), leaked (a
  block with a warning marker and no incoming arrow).
- **Function/index boxes** (the hash function, a build-pipeline stage, a preprocessor step) use
  a neutral structural treatment so they read as "process," distinct from memory cells.
Keep it to ~3 hues total plus the semantic state flags. Avoid rainbow coding.

## Typography
- **Monospace for everything technical** — code, variable names, values, types, and hex
  addresses. A clean coding font (JetBrains Mono / Fira Code / SF Mono feel).
- A clean sans (Inter-like) only for chrome labels, breadcrumb, and narration prose.
- Large and legible — it gets projected. Sentence case, never ALL CAPS.

## How a memory cell should look
Each variable/cell is a small card showing, in order: the **name**, a muted **type** label
(`int`, `int *`, `node_t *`, `char[6]`), the **value** (emphasized), and a tiny muted
**address** (`@0x7ffe18`). Pointer cells show the address they hold and emit an arrow to their
target. Heap nodes show their own address as a header plus their fields.

## Motion (describe it, even in a static mock — note it in annotations)
- Stack frames **spring in** on call and **spring out** on return (physical, ~250ms, not
  bouncy-cartoonish).
- Pointer reassignment **animates the arrowhead** from old target to new target.
- Value changes pulse once. Stepping backward reverses the same transitions.
- Everything is smooth and deliberate — this is a teaching aid; clarity beats flashiness.

## Interaction affordances to show
- Hovering a stack frame reveals a tooltip listing its locals.
- Hovering a node/cell reveals its full type, value, and address.
- A presentation/fullscreen mode with keyboard navigation (←/→ to step).

## Locked-spec notes from the design review (carry into the engine build)
The 9-screen exploration is the locked visual spec. Three rules came out of reviewing it and
must hold in the real implementation:
- **No font ligatures in the code panel.** Set `font-variant-ligatures: none` (or equivalent) so
  C operators render literally — `->`, `!=`, `<=`, `++` must appear exactly as typed, not as
  `→`, `≠`, `≤`. This is a teaching tool for beginners; they must see real C syntax.
- **All breadcrumb / course / lesson metadata comes from the curriculum data, never invented.**
  Static libraries is SE 200 (the exploration mislabeled it "SE 220"). Course codes, week, and
  project names must be sourced from `docs/CURRICULUM.md`, not fabricated per screen.
- **Traces must be authored for strict correctness.** The exploration's sample traces had minor
  placeholder inconsistencies (a `count` value, a heap address). Real traces are teaching
  artifacts — every value, address, and step must be verifiably correct.

## Deliverable
Polished mockup screens covering the range above — at minimum recursion, linked-list, heap
(malloc/free with its states), hash table, and one special view (build pipeline or preprocessor)
— so the style is proven across every layout type, not just one. Dark variant primary, one light
variant, each labeled, plus a swatch legend showing the semantic color mapping (pointer, heap,
stack, active, value-changed, allocation states, process box). No working code required — this
is a visual style exploration to react to.
