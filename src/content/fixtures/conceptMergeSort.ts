/** Phase 37 concept view (`bars`): merge sort, generated from seeded values (not recorded). */
import { mergeSortSteps } from '../../engine/concept/bars.ts';
import { distinctInts, seeded } from '../../engine/concept/random.ts';
import { conceptModule } from '../../engine/concept/trace.ts';

const contentModule = conceptModule(
  {
    id: 'concept-merge-sort',
    title: 'Merge sort',
    topic: 'Search and sort',
    view: 'bars',
    summary: 'Split into halves down to single values, then merge the pieces back in order.',
    order: 56,
  },
  mergeSortSteps(distinctInts(seeded(3766), 8, 1, 20)),
);
export const mergeSortTrace = contentModule.trace;
export default contentModule;
