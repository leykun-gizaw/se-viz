/**
 * Sentence case for course-map labels (Phase 28). Topic names in the catalog are Title Case
 * ("Singly Linked Lists Part 1"); the course map shows them in sentence case ("Singly linked lists
 * part 1") without touching the data.
 *
 * Only plain Capitalized words after the first are lowered. Everything that might be a name or
 * code is kept as written: all-caps words and single capitals (`LIFO`, `C`), mixed case (`ADTs`),
 * words with digits, and lower-case identifiers (`malloc/free`, `argc`).
 */
export function sentenceCase(label: string): string {
  let first = true;
  return label.replace(/[A-Za-z][A-Za-z0-9']*/g, (word) => {
    const isFirst = first;
    first = false;
    if (isFirst) return word;
    return /^[A-Z][a-z']+$/.test(word) ? word.toLowerCase() : word;
  });
}
