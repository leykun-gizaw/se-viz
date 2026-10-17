import numpy as np

big = np.arange(500)
big[0] = -1
grid = big.reshape(20, 25)
first = big[:5]
hyper = np.zeros((2, 2, 2, 2))
