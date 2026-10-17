/** Phase 37 concept view (`bars`): insertion sort, generated from seeded values (not recorded). */
import { insertionSortSteps } from '../../engine/concept/bars.ts';
import { distinctInts, seeded } from '../../engine/concept/random.ts';
import { conceptModule } from '../../engine/concept/trace.ts';

const contentModule = conceptModule(
  {
    id: 'concept-insertion-sort',
    title: 'Insertion sort',
    topic: 'Search and sort',
    view: 'bars',
    summary: 'Each new value moves left past bigger ones into the growing sorted part.',
    order: 55,
  },
  insertionSortSteps(distinctInts(seeded(3765), 8, 1, 20)),
);
export const insertionSortTrace = contentModule.trace;
export default contentModule;
