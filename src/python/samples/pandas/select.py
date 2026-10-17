import pandas as pd

farm = pd.read_csv("farm.csv")
crops = farm["crop"]
pair = farm[["region", "yield_kg"]]
third = farm.loc[2]
block = farm.loc[0:3, ["crop", "rainfall_mm"]]
corner = farm.iloc[:2, :3]
value = farm.loc[4, "yield_kg"]
