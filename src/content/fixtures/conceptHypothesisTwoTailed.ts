/** Phase 37 concept view (`distribution`, hypothesis mode): the two-tailed version of the test. */
import { testSteps } from '../../engine/concept/distribution.ts';
import { conceptModule } from '../../engine/concept/trace.ts';
import { PLANTS, TEST_BINS, TEST_SCHEDULE, TEST_SEED } from './conceptHypothesisTest.ts';

const contentModule = conceptModule(
  {
    id: 'concept-hypothesis-two-tailed',
    title: 'Hypothesis test: two-tailed',
    topic: 'Statistics',
    view: 'distribution',
    summary: 'The same shuffles, counted in both tails: this far from 0 in either direction.',
    order: 72,
  },
  testSteps(PLANTS, 'two', TEST_SEED, TEST_SCHEDULE, TEST_BINS).steps,
);
export const hypothesisTwoTailedTrace = contentModule.trace;
export default contentModule;
