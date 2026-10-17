import matplotlib.pyplot as plt

months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
rain_mm = [42, 55, 80, 120, 95, 60]

plt.plot(months, rain_mm, marker="o")
plt.title("Rainfall by month")
plt.xlabel("Month")
plt.ylabel("Rainfall (mm)")
plt.show()
print("Wettest month:", months[rain_mm.index(max(rain_mm))])
