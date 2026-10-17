class Tractor:
    def __init__(self, name, fuel):
        self.name = name
        self.fuel = fuel

    def drive(self, hours):
        self.fuel = self.fuel - 10 * hours

red = Tractor("Red", 100)
blue = Tractor("Blue", 80)
red.drive(3)
