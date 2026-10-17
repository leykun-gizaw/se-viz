/** Phase 37 concept view (`bars`): linear search, generated from seeded values (not recorded). */
import { linearSearchSteps } from '../../engine/concept/bars.ts';
import { distinctInts, seeded } from '../../engine/concept/random.ts';
import { conceptModule } from '../../engine/concept/trace.ts';

const values = distinctInts(seeded(3701), 8, 1, 20);

const contentModule = conceptModule(
  {
    id: 'concept-linear-search',
    title: 'Linear search',
    topic: 'Search and sort',
    view: 'bars',
    summary:
      'Check each value in turn until the target turns up: one comparison per value checked.',
    order: 50,
  },
  linearSearchSteps(values, values[5]),
);
export const linearSearchTrace = contentModule.trace;
export default contentModule;
