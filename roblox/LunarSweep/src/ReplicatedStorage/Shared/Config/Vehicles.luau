--!strict
-- Drivable cleaning vehicles (hover rovers). Speed = studs/s, Width = cleaning width (studs),
-- Hopper = kg the vehicle carries, Depth = kg multiplier per cleaned patch.
-- Bought and spawned at a garage (the colony Motor Pool or your own Garage building).

export type VehicleDef = {
	Id: string,
	Name: string,
	Rarity: string,
	Price: number,
	Level: number,
	Speed: number,
	Width: number,
	Hopper: number,
	Depth: number,
	Seats: number,
	Size: Vector3,
	Colors: { Color3 },
	Description: string,
}

local function rgb(r: number, g: number, b: number): Color3
	return Color3.fromRGB(r, g, b)
end

local list: { VehicleDef } = {
	{ Id = "push_sweeper", Name = "Push Sweeper", Rarity = "Common", Price = 2500, Level = 6, Speed = 18, Width = 8, Hopper = 40, Depth = 1.6, Seats = 1, Size = Vector3.new(6, 3, 8), Colors = { rgb(240, 240, 245), rgb(255, 130, 40), rgb(50, 50, 60) }, Description = "A compact sweeper. Slow, but it never gets tired." },
	{ Id = "crew_transport", Name = "Crew Transport", Rarity = "Uncommon", Price = 8000, Level = 10, Speed = 48, Width = 0, Hopper = 0, Depth = 0, Seats = 4, Size = Vector3.new(8, 4, 12), Colors = { rgb(70, 140, 255), rgb(240, 240, 245), rgb(40, 40, 50) }, Description = "Fast four-seat rover for getting around. Does not clean." },
	{ Id = "ride_on_sweeper", Name = "Ride-on Sweeper", Rarity = "Uncommon", Price = 15000, Level = 12, Speed = 24, Width = 12, Hopper = 150, Depth = 2.0, Seats = 1, Size = Vector3.new(8, 3.6, 10), Colors = { rgb(255, 200, 40), rgb(40, 40, 50), rgb(255, 130, 40) }, Description = "Sit down and sweep. A proper workhorse." },
	{ Id = "lunar_sweeper", Name = "Lunar Sweeper", Rarity = "Rare", Price = 90000, Level = 20, Speed = 30, Width = 16, Hopper = 600, Depth = 2.6, Seats = 1, Size = Vector3.new(10, 4, 13), Colors = { rgb(240, 240, 245), rgb(80, 220, 255), rgb(40, 40, 50) }, Description = "Wide brush rollers built for the open plains." },
	{ Id = "mega_vacuum_rover", Name = "Mega Vacuum Rover", Rarity = "Epic", Price = 600000, Level = 32, Speed = 34, Width = 22, Hopper = 2000, Depth = 3.4, Seats = 2, Size = Vector3.new(12, 5, 16), Colors = { rgb(255, 130, 40), rgb(240, 240, 245), rgb(30, 30, 40) }, Description = "Industrial suction on six hover pods." },
	{ Id = "titan_harvester", Name = "Titan Harvester", Rarity = "Legendary", Price = 6000000, Level = 48, Speed = 36, Width = 30, Hopper = 6000, Depth = 4.5, Seats = 2, Size = Vector3.new(16, 6, 20), Colors = { rgb(30, 30, 40), rgb(255, 190, 60), rgb(140, 100, 255) }, Description = "The biggest cleaning machine ever landed on the moon." },
}

local byId: { [string]: VehicleDef } = {}
for i, v in list do
	byId[v.Id] = v
	;(v :: any).Order = i
end

return {
	List = list,
	ById = byId,
	Get = function(id: string): VehicleDef?
		return byId[id]
	end,
}
