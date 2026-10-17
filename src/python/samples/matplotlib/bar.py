import matplotlib.pyplot as plt

harvest = {}
for crop, kg in zip(["maize", "beans", "wheat", "sorghum"], [1840, 920, 1310, 760]):
    harvest[crop] = kg

plt.bar(list(harvest), list(harvest.values()), color="tab:orange")
plt.title("Harvest by crop")
plt.ylabel("Harvest (kg)")
print("Total:", sum(harvest.values()), "kg")
