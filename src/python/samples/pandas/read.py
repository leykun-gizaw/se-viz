import pandas as pd

farm = pd.read_csv("farm.csv")
first = farm.head()
rows, cols = farm.shape
farm.info()
