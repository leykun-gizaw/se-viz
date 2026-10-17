prices = {"corn": 3, "wheat": 2}
basket = ["corn", "wheat", "beans", "corn"]
total = 0
for item in basket:
    total = total + prices[item]
print(total)
