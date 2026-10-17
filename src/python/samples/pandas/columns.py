import pandas as pd

plots = pd.read_csv("farm.csv").head(6)
plots["yield_per_mm"] = plots["yield_kg"] / plots["rainfall_mm"]
plots["yield_kg"] = plots["yield_kg"] * 2
plots.loc[1, "crop"] = "millet"
tons = plots.assign(yield_t=plots["yield_kg"] / 1000)
