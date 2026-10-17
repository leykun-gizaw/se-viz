import pandas as pd

plots = pd.read_csv("farm.csv").head(8)
ranked = plots.sort_values("yield_kg", ascending=False)
plots.sort_values("rainfall_mm", inplace=True)
back = plots.sort_index()
