/** Phase 37 concept view (`bars`): selection sort, generated from seeded values (not recorded). */
import { selectionSortSteps } from '../../engine/concept/bars.ts';
import { distinctInts, seeded } from '../../engine/concept/random.ts';
import { conceptModule } from '../../engine/concept/trace.ts';

const contentModule = conceptModule(
  {
    id: 'concept-selection-sort',
    title: 'Selection sort',
    topic: 'Search and sort',
    view: 'bars',
    summary:
      'Find the smallest remaining value and swap it into place: many comparisons, few swaps.',
    order: 54,
  },
  selectionSortSteps(distinctInts(seeded(3764), 8, 1, 20)),
);
export const selectionSortTrace = contentModule.trace;
export default contentModule;
