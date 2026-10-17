/**
 * Python live coding's stored inputs (Phase 31): the `localStorage` keys for the editor text, the
 * stdin box and the limits, and how the stdin box becomes `input()` lines.
 *
 * @packageDocumentation
 */

export const PY_SOURCE_KEY = 'se-viz-live-python-source';
export const PY_STDIN_KEY = 'se-viz-live-python-stdin';
export const PY_LIMITS_KEY = 'se-viz-live-python-limits';

/** The stdin box's lines, one per `input()`. A final newline doesn't add an empty line. */
export function stdinLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}
