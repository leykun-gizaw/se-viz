/** Phase 37 concept view (`bars`): binary search for a value that is present (seeded values). */
import { binarySearchSteps } from '../../engine/concept/bars.ts';
import { distinctInts, seeded } from '../../engine/concept/random.ts';
import { conceptModule } from '../../engine/concept/trace.ts';

/** Ten distinct values from 1–40, sorted. */
export const BINARY_VALUES = distinctInts(seeded(3702), 10, 1, 40).sort((a, b) => a - b);

const contentModule = conceptModule(
  {
    id: 'concept-binary-search',
    title: 'Binary search',
    topic: 'Search and sort',
    view: 'bars',
    summary: 'Halve the range at every comparison: low, mid and high close in on the target.',
    order: 51,
  },
  binarySearchSteps(BINARY_VALUES, BINARY_VALUES[3]),
);
export const binarySearchTrace = contentModule.trace;
export default contentModule;
