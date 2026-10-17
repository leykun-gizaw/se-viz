/** Phase 37 concept view (`distribution`, sampling mode): the sampling distribution of the mean. */
import { samplingSteps } from '../../engine/concept/distribution.ts';
import { conceptModule } from '../../engine/concept/trace.ts';

/** Cumulative sample counts after each step: one at a time, then in growing batches. */
export const SAMPLING_SCHEDULE = [1, 2, 3, 4, 5, 10, 25, 50, 100, 250, 500, 1000];
/** Seed, population size and sample size of the module. */
export const SAMPLING_ARGS = [3720, 2000, 30] as const;

const contentModule = conceptModule(
  {
    id: 'concept-sampling-distribution',
    title: 'Sampling distribution of the mean',
    label: 'Sampling distribution',
    topic: 'Statistics',
    view: 'distribution',
    summary: 'Means of samples from a skewed population pile up into a bell shape.',
    order: 70,
  },
  samplingSteps(...SAMPLING_ARGS, SAMPLING_SCHEDULE).steps,
);
export const samplingTrace = contentModule.trace;
export default contentModule;
