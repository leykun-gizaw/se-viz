import matplotlib.pyplot as plt

rainfall = [480, 520, 610, 700, 760, 820, 900, 950]
yield_kg = [1150, 1240, 1310, 1500, 1580, 1620, 1790, 1850]

fig, ax = plt.subplots()
ax.scatter(rainfall, yield_kg, color="tab:green")
ax.set_title("Yield against rainfall")
ax.set_xlabel("Rainfall (mm)")
ax.set_ylabel("Yield (kg)")
plt.show()
