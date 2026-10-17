import numpy as np

scores = np.array([55, 92, 78, 40, 88])
passed = scores >= 60
good = scores[passed]
count = passed.sum()
scores[scores < 50] = 50
