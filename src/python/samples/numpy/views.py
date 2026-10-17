import numpy as np

base = np.arange(6)
view = base[1:4]
view[0] = 100
copy = base.copy()
copy[1] = -1
grid = base.reshape(2, 3)
grid[1, 2] = 7
