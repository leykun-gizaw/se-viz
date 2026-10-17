import pandas as pd

rain = pd.Series([820, 910, 540, 1010], index=["Highland", "Lakeside", "Valley", "Coast"], name="rainfall_mm")
doubled = rain * 2
wet = rain[rain > 800]
coast = rain["Coast"]
rain["Valley"] = 600
