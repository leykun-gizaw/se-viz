/** Phase 37 concept view (`bars`): bubble sort, generated from seeded values (not recorded). */
import { bubbleSortSteps } from '../../engine/concept/bars.ts';
import { distinctInts, seeded } from '../../engine/concept/random.ts';
import { conceptModule } from '../../engine/concept/trace.ts';

const contentModule = conceptModule(
  {
    id: 'concept-bubble-sort',
    title: 'Bubble sort',
    topic: 'Search and sort',
    view: 'bars',
    summary:
      'Neighbours swap until the biggest values bubble to the end; the sorted region grows from the right.',
    order: 53,
  },
  bubbleSortSteps(distinctInts(seeded(3763), 8, 1, 20)),
);
export const bubbleSortTrace = contentModule.trace;
export default contentModule;
