import pandas as pd

farm = pd.read_csv("farm.csv")
by_region = farm.groupby("region")
totals = by_region["yield_kg"].sum()
crop_stats = farm.groupby("crop").agg({"yield_kg": "mean", "rainfall_mm": "max"})
counts = farm.groupby("crop").size()
