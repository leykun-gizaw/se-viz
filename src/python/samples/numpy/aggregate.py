import numpy as np

m = np.array([[1, 2, 3], [4, 5, 6]])
total = m.sum()
col_sums = m.sum(axis=0)
row_means = m.mean(axis=1)
biggest = m.max()
best = np.max(m, axis=0)
