import numpy as np
import pandas as pd

days = pd.DataFrame({"day": np.arange(1200), "rain_mm": np.arange(1200) % 37 * 1.5})
wide = pd.DataFrame(np.arange(45).reshape(3, 15)).add_prefix("plot_")
notes = pd.Series(["dry soil, late planting, weeded twice before the long rains"] * 3)
