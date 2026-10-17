/** Phase 37 concept view (`growth`): Big O growth curves as n doubles (generated, not recorded). */
import { growthSteps } from '../../engine/concept/growth.ts';
import { conceptModule } from '../../engine/concept/trace.ts';

const contentModule = conceptModule(
  {
    id: 'concept-big-o-growth',
    title: 'Big O: how work grows with n',
    label: 'Big O growth',
    topic: 'Big O',
    view: 'growth',
    summary: 'O(1), O(log n), O(n), O(n log n) and O(n²) as n doubles: counts, curves and ratios.',
    order: 60,
  },
  growthSteps(
    [1, 2, 4, 8, 16, 32, 64],
    [
      ['n', '1'],
      ['n', 'log'],
      ['n', 'log'],
      ['n2', 'n'],
      ['n2', 'nlog'],
      ['nlog', 'n'],
      ['n2', 'nlog'],
    ],
    512,
  ),
);
export const growthTrace = contentModule.trace;
export default contentModule;
