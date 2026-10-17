import matplotlib.pyplot as plt

days = [1, 2, 3, 4, 5, 6, 7]
milk_l = [21, 23, 22, 25, 24, 26, 27]
goats = {"Ada": 4.2, "Bo": 3.1, "Cy": 3.8}

fig, (left, right) = plt.subplots(1, 2, figsize=(9, 3.5))
left.plot(days, milk_l, marker="o")
left.set_title("Milk per day")
left.set_xlabel("Day")
left.set_ylabel("Litres")
right.bar(list(goats), list(goats.values()))
right.set_title("Milk per goat")
fig.suptitle("Dairy week")
plt.show()
