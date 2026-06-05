/**
 * The exact C program visualized by the Phase 0 vertical slice. Kept as a single string so that
 * 1-based line numbers in {@link addTrace} line up with what the code panel renders.
 *
 * Line map (1-based):
 *   1  int add(int a, int b)
 *   2  {
 *   3      int sum = a + b;
 *   4      return sum;
 *   5  }
 *   6  (blank)
 *   7  int main(void)
 *   8  {
 *   9      int x = 3;
 *  10      int y = 4;
 *  11      int z = add(x, y);
 *  12      return 0;
 *  13  }
 */
export const ADD_SOURCE = `int add(int a, int b)
{
    int sum = a + b;
    return sum;
}

int main(void)
{
    int x = 3;
    int y = 4;
    int z = add(x, y);
    return 0;
}
`;
