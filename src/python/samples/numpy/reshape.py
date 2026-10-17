import numpy as np

flat = np.arange(6)
grid = flat.reshape(2, 3)
turned = grid.T
flat.shape = (3, 2)
back = turned.copy()
