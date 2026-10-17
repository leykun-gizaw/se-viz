import pandas as pd

farm = pd.read_csv("farm.csv")
gaps = farm.isna().sum()
filled = farm.fillna({"yield_kg": 0})
complete = farm.dropna()
farm.dropna(subset=["rainfall_mm"], inplace=True)
