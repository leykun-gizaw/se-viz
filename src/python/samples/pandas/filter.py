import pandas as pd

farm = pd.read_csv("farm.csv")
wet = farm["rainfall_mm"] > 900
rainy = farm[wet]
dry_maize = farm[(farm["rainfall_mm"] < 600) & (farm["crop"] == "maize")]
coast = farm[farm["region"] == "Coast"]
