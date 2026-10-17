/**
 * Phase 37 concept view (`distribution`, hypothesis mode): a one-tailed permutation test. The data,
 * seed and schedule are shared with `conceptHypothesisTwoTailed.ts`, so both show the same shuffles.
 */
import { testSteps, type TestData } from '../../engine/concept/distribution.ts';
import { conceptModule } from '../../engine/concept/trace.ts';

/** Plant growth in tenths of a centimetre: 10 plants with fertilizer, 10 without. */
export const PLANTS: TestData = {
  labels: ['fertilizer', 'control'],
  a: [146, 120, 157, 135, 128, 148, 132, 118, 139, 127],
  b: [121, 108, 138, 108, 125, 110, 134, 120, 137, 119],
};
export const TEST_SEED = 3730;
/** Cumulative shuffles after each step. */
export const TEST_SCHEDULE = [1, 2, 3, 10, 50, 100, 250, 500, 1000];
/** Bins between 0 and the observed difference. */
export const TEST_BINS = 6;

const contentModule = conceptModule(
  {
    id: 'concept-hypothesis-one-tailed',
    title: 'Hypothesis test: one-tailed',
    topic: 'Statistics',
    view: 'distribution',
    summary:
      'Shuffle the group labels to build the null distribution; the p-value is the right tail.',
    order: 71,
  },
  testSteps(PLANTS, 'right', TEST_SEED, TEST_SCHEDULE, TEST_BINS).steps,
);
export const hypothesisOneTailedTrace = contentModule.trace;
export default contentModule;
