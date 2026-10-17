import numpy as np

grid = np.arange(12).reshape(3, 4)
row = grid[1]
row[2] = -5
safe = grid.copy()
safe[0, 0] = 99
means = grid.mean(axis=0)
mask = grid > 5
print(grid[mask])
total = grid + np.array([10, 20, 30, 40])
cube = np.zeros((2, 2, 3))
cube[1] = 7
