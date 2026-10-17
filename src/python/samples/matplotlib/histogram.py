import matplotlib.pyplot as plt

weights = [3.1, 3.4, 2.9, 3.8, 3.3, 3.6, 4.0, 3.2, 3.5, 2.7, 3.9, 3.4, 3.0, 3.7, 3.3, 3.6]

plt.hist(weights, bins=4, edgecolor="black")
plt.title("Melon weights, 4 bins")
plt.xlabel("Weight (kg)")
plt.show()

plt.hist(weights, bins=8, edgecolor="black", color="tab:purple")
plt.title("Melon weights, 8 bins")
plt.xlabel("Weight (kg)")
plt.ylabel("Melons")
plt.show()
