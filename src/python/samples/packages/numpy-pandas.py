import numpy as np
import pandas as pd

yields = np.array([[3.0, 4.5, 2.0], [5.5, 1.0, 4.0]])
best = yields.max()
farm = pd.DataFrame({"crop": ["corn", "wheat"], "tons": [12, 7]})
tons = farm["tons"]
both = {"grid": yields, "table": farm}
