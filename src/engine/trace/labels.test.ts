import { describe, expect, it } from 'vitest';
import { frameLabel, functionParams, lineTexts } from './labels.ts';
import type { StackFrame } from './types.ts';

const SRC = [
  '#include <stdio.h>',
  'int factorial(int n) {',
  '    return n * factorial(n - 1);',
  '}',
  'node_t *insert_head(node_t *head, int value) {',
  'static int sum(const int arr[], int len)',
  '{',
  'int main(void) {',
  'int proto(int a);',
  'void log_all(const char *fmt, ...) {',
].join('\n');

describe('functionParams', () => {
  it('reads parameter names from a definition line', () => {
    expect(functionParams(SRC, 'factorial')).toEqual(['n']);
    expect(functionParams(SRC, 'insert_head')).toEqual(['head', 'value']);
    expect(functionParams(SRC, 'sum')).toEqual(['arr', 'len']);
    expect(functionParams(SRC, 'main')).toEqual([]);
  });

  it('ignores calls and prototypes, and gives up on what it cannot name', () => {
    expect(functionParams(SRC, 'proto')).toBeNull();
    expect(functionParams(SRC, 'log_all')).toBeNull();
    expect(functionParams(SRC, 'missing')).toBeNull();
  });
});

describe('frameLabel', () => {
  const frame = (name: string, vars: StackFrame['variables']): StackFrame => ({
    id: name,
    name,
    callId: 0,
    variables: vars,
  });

  it('shows scalar arguments', () => {
    expect(
      frameLabel(
        frame('factorial', [
          { kind: 'scalar', id: 'n', name: 'n', type: 'int', value: 3 },
          { kind: 'scalar', id: 'r', name: 'return', type: 'int', value: null },
        ]),
        SRC,
      ),
    ).toBe('factorial(3)');
    expect(frameLabel(frame('main', []), SRC)).toBe('main()');
  });

  it('falls back to the bare name for pointer, missing or unknown arguments', () => {
    const head = {
      kind: 'pointer',
      id: 'h',
      name: 'head',
      type: 'node_t *',
      target: null,
    } as const;
    const value = { kind: 'scalar', id: 'v', name: 'value', type: 'int', value: 2 } as const;
    expect(frameLabel(frame('insert_head', [head, value]), SRC)).toBe('insert_head');
    expect(frameLabel(frame('factorial', []), SRC)).toBe('factorial');
    expect(frameLabel(frame('nowhere', []), SRC)).toBe('nowhere');
  });
});

describe('lineTexts', () => {
  it('returns trimmed source lines in line order, skipping out-of-range lines', () => {
    expect(lineTexts(SRC, [3, 2, 99])).toEqual([
      'int factorial(int n) {',
      'return n * factorial(n - 1);',
    ]);
  });
});
