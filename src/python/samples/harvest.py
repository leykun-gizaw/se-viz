harvest = ["corn", "wheat", "corn", "beans", "corn"]
counts = {}
for crop in harvest:
    if crop in counts:
        counts[crop] = counts[crop] + 1
    else:
        counts[crop] = 1
print(counts)
