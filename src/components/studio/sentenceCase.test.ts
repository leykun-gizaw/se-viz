import { describe, expect, it } from 'vitest';
import { sentenceCase } from './sentenceCase.ts';

describe('sentenceCase', () => {
  it('lowers Title Case words after the first', () => {
    expect(sentenceCase('Singly Linked Lists Part 1')).toBe('Singly linked lists part 1');
    expect(sentenceCase('Hello, World')).toBe('Hello, world');
    expect(sentenceCase('Even More Pointers, Arrays and Strings')).toBe(
      'Even more pointers, arrays and strings',
    );
  });

  it('keeps acronyms, single capitals, code and already-lower labels', () => {
    expect(sentenceCase('Stacks, Queues, LIFO, FIFO Part 2')).toBe(
      'Stacks, queues, LIFO, FIFO part 2',
    );
    expect(sentenceCase('The C Memory Map')).toBe('The C memory map');
    expect(sentenceCase('malloc/free Commands')).toBe('malloc/free commands');
    expect(sentenceCase('argc, argv')).toBe('argc, argv');
    expect(sentenceCase('factorial(n)')).toBe('factorial(n)');
  });
});
