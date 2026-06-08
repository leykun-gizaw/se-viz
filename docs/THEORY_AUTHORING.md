# Theory Authoring Conventions (Phase 19)

Theory docs are the **read-first** conceptual explanation for a topic — the *telling* that precedes
SE-Viz's *showing*. A learning session runs **theory → visualization**. This file is the contract a
later theory-content pass authors against. Theory is a **separate content type from a `Trace`** (it
is not played by the engine); it does not touch the trace format.

## Depth expectation

**Write as detailed as the concept deserves — err long.** A theory doc is the lesson a good teacher
opens with, not a cheat-sheet. The two exemplars
([`pointers-arrays-strings/theory.md`](../src/content/se200/pointers-arrays-strings/theory.md) and
[`recursion/theory.md`](../src/content/se200/recursion/theory.md)) set the bar: ~150–250 lines,
genuinely thorough, accurate C throughout.

## File location & naming

One Markdown file per sidebar **topic**, named `theory.md`, in that topic's folder:

```
src/content/<course>/<topic>/theory.md
```

It is discovered automatically (a `?raw` glob in [`src/content/theory.ts`](../src/content/theory.ts))
and pinned **first** within its topic in the sidebar — above that topic's visualization modules. A
topic may have a theory doc, modules, or both; a topic with no `theory.md` simply shows no Theory
entry. No edit to `catalog.ts`, `App.tsx`, or any shared file is needed to add one.

## Required frontmatter

A YAML-ish frontmatter block (flat `key: value`, optionally quoted) at the very top:

```markdown
---
course: SE 200
topic: Pointers, Arrays and Strings
title: Pointers, Arrays & Strings
order: 50
---
```

| Field | Required | Meaning |
| --- | --- | --- |
| `course` | yes | Course code — **must match `docs/CURRICULUM.md`** (e.g. `SE 200`). Never fabricate. |
| `topic` | yes | Topic — **must match the topic its modules use** (the sidebar group string). |
| `title` | yes | Display title (reading-view heading + sidebar tooltip). |
| `order` | recommended | Sort hint. Use the topic's module `order` (theory always pins first regardless). |

`course`/`topic` are validated against the catalog by `src/content/theory.test.ts`; a typo there
fails the test.

## Recommended document structure

The body starts after the frontmatter (the `title` is rendered as the page `h1`, so do not repeat
it). Use `##` for sections, `###` for sub-sections. A strong doc covers, in roughly this order:

1. **What it is and why it matters** (a short, plain-language opening).
2. **The mental model** — the picture to hold in your head.
3. **Syntax and the rules that actually matter.**
4. **Common patterns.**
5. **Common pitfalls / misconceptions** (great as `watch-out` callouts).
6. **A worked example** (a fenced C code block).
7. **A pointer to the matching visualization** — a "See it run" section; the reading view also shows
   an automatic **"Continue to the visualization →"** button to the topic's first module.
8. **A short summary** (a `recap` callout works well).

## Supported Markdown (and only this)

Rendered by the small, dependency-free engine in [`src/engine/markdown.ts`](../src/engine/markdown.ts)
to a typed AST, then to React — **never to an HTML string**, so it is safe by construction (raw HTML
in the source is shown literally, never executed; do not rely on it).

- Headings `#`–`###`, paragraphs, unordered (`-`) and ordered (`1.`) lists, GFM pipe tables,
  blockquotes, horizontal rules (`---`).
- Inline: `**bold**`, `*italic*`, `` `code` ``, `[text](https://…)` links (http/https/mailto/in-page
  only; other schemes render as plain text).
- **Underscores are not emphasis** — so C identifiers like `node_t` read literally. Use `*…*` for
  italics. Wrap all C in backticks/code fences anyway.

### Code blocks

Fenced blocks with an info string get **C syntax highlighting** (reuses `highlightC`) and render in
`.se-code` with **ligatures off** (operators show literally: `->`, `!=`, `<=`, `*p`):

````markdown
```c
int *p = &x;   /* p holds the address of x */
*p = 7;        /* write through the pointer */
```
````

Use `c` (also `h`/`cpp`) to highlight; any other info string renders as plain monospace.

### Callouts (shared visual language with in-viz coaching)

A blockquote whose first line is `> [!variant] Optional title` becomes a **callout** styled with the
**coach variant tokens** (same color + glyph as the in-visualization coach notes). The set is small
and fixed:

| Syntax | Use for |
| --- | --- |
| `> [!idea]` | the key insight / mental model |
| `> [!watch-out]` | a pitfall, misconception, or UB warning |
| `> [!predict]` | a "what do you think happens?" prompt |
| `> [!recap]` | a short summary of what to retain |

```markdown
> [!watch-out] Forgetting the terminator
> A char buffer without a `\0` is not a string — `strlen` runs past the end.
```

Every continuation line of a callout (or plain blockquote) must be prefixed with `>`. An unknown
`[!type]` falls back to a plain blockquote.

## Link to the visualization

Always include a "See it run" section naming the topic's modules. The reading view additionally
renders an automatic **"Continue to the visualization →"** button that jumps to the first module of
the same topic — you do not author that link; it derives from the catalog.
