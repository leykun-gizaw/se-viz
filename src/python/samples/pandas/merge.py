import pandas as pd

farm = pd.read_csv("farm.csv")
prices = pd.DataFrame({"crop": ["maize", "beans", "sorghum"], "price_per_kg": [0.3, 0.9, 0.4]})
priced = pd.merge(farm, prices, on="crop", how="left")
matched = farm.merge(prices, on="crop")
