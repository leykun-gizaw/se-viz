import numpy as np
import pandas as pd

days = pd.DataFrame({"day": np.arange(1200), "rain_mm": np.arange(1200) % 37 * 1.5})
wide = pd.DataFrame({f"plot_{i}": [i, i * 2, i * 3] for i in range(15)})
notes = pd.Series(["dry soil, late planting, weeded twice before the long rains"] * 3)
