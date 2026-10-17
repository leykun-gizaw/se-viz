/**
 * Phase 37 concept view (`bars`): binary search for a value that is not in the array, so the range
 * empties (`low` passes `high`). Same array as `conceptBinarySearch.ts`.
 */
import { binarySearchSteps } from '../../engine/concept/bars.ts';
import { conceptModule } from '../../engine/concept/trace.ts';
import { BINARY_VALUES } from './conceptBinarySearch.ts';

/** The smallest whole number above the 6th value that is not in the array. */
let absent = BINARY_VALUES[5] + 1;
while (BINARY_VALUES.includes(absent)) absent++;

const contentModule = conceptModule(
  {
    id: 'concept-binary-search-absent',
    title: 'Binary search: not found',
    topic: 'Search and sort',
    view: 'bars',
    summary: 'When the target is missing, the range shrinks until low passes high.',
    order: 52,
  },
  binarySearchSteps(BINARY_VALUES, absent),
);
export const binarySearchAbsentTrace = contentModule.trace;
export default contentModule;
