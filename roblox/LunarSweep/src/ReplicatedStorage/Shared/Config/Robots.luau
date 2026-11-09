--!strict
-- Robots. Roles:
--  cleaner   : flies to an assigned zone and sweeps dirty terrain cells (real terrain cleaning)
--  collector : flies to an assigned zone and collects debris pickups
--  hauler    : fetches the owner's dropped capsules back to the base silo (cargo lifter also auto-sells)
--  helper    : follows the owner and grants a passive bonus
-- Battery = seconds of work on a full charge. Wear = % durability lost per minute of work.

export type RobotDef = {
	Id: string,
	Name: string,
	Role: string,
	Rarity: string,
	Source: string, -- "shop" | "crate" | "event"
	Price: number,
	Level: number,
	Speed: number,
	Width: number,
	Capacity: number,
	Battery: number,
	Wear: number,
	Magnet: number,
	Model: string, -- "dome" | "drone" | "rover" | "crab" | "orb" | "lifter"
	Colors: { Color3 },
	Bonus: { [string]: number }?,
	Description: string,
}

local function rgb(r: number, g: number, b: number): Color3
	return Color3.fromRGB(r, g, b)
end

local list: { RobotDef } = {
	-- cleaners
	{ Id = "dustbot_mk1", Name = "Dustbot Mk I", Role = "cleaner", Rarity = "Common", Source = "shop", Price = 250, Level = 3, Speed = 8, Width = 4, Capacity = 1.5, Battery = 90, Wear = 1.0, Magnet = 0, Model = "dome", Colors = { rgb(240, 240, 245), rgb(255, 130, 40), rgb(60, 60, 70) }, Description = "A humble disc that sweeps the sector you assign it." },
	{ Id = "dustbot_mk2", Name = "Dustbot Mk II", Role = "cleaner", Rarity = "Uncommon", Source = "shop", Price = 1500, Level = 8, Speed = 10, Width = 6, Capacity = 4, Battery = 120, Wear = 0.9, Magnet = 0, Model = "dome", Colors = { rgb(60, 140, 255), rgb(240, 240, 245), rgb(40, 40, 50) }, Description = "Bigger brushes and a better battery." },
	{ Id = "sweeper_drone", Name = "Sweeper Drone", Role = "cleaner", Rarity = "Uncommon", Source = "shop", Price = 6000, Level = 13, Speed = 12, Width = 8, Capacity = 10, Battery = 150, Wear = 0.85, Magnet = 0, Model = "drone", Colors = { rgb(240, 240, 245), rgb(255, 200, 40), rgb(50, 50, 60) }, Description = "Quad-rotor drone with a downward suction skirt." },
	{ Id = "twin_brush_rover", Name = "Twin-Brush Rover", Role = "cleaner", Rarity = "Rare", Source = "shop", Price = 25000, Level = 19, Speed = 12, Width = 10, Capacity = 25, Battery = 180, Wear = 0.8, Magnet = 0, Model = "rover", Colors = { rgb(255, 140, 40), rgb(240, 240, 245), rgb(40, 40, 45) }, Description = "Six-wheel hover rover with spinning side brushes." },
	{ Id = "cyclone_sweeper", Name = "Cyclone Sweeper", Rarity = "Rare", Role = "cleaner", Source = "shop", Price = 90000, Level = 26, Speed = 14, Width = 14, Capacity = 60, Battery = 210, Wear = 0.75, Magnet = 0, Model = "drone", Colors = { rgb(120, 80, 255), rgb(220, 220, 235), rgb(80, 255, 230) }, Description = "Cyclonic separator drone. Never loses suction." },
	{ Id = "titan_scrubber", Name = "Titan Scrubber", Role = "cleaner", Rarity = "Epic", Source = "shop", Price = 400000, Level = 35, Speed = 14, Width = 18, Capacity = 150, Battery = 240, Wear = 0.7, Magnet = 0, Model = "rover", Colors = { rgb(255, 210, 40), rgb(40, 40, 50), rgb(255, 120, 30) }, Description = "Heavy-duty scrubber that eats crater bowls." },
	{ Id = "aurora_custodian", Name = "Aurora Custodian", Role = "cleaner", Rarity = "Epic", Source = "shop", Price = 2000000, Level = 46, Speed = 16, Width = 22, Capacity = 350, Battery = 300, Wear = 0.6, Magnet = 0, Model = "orb", Colors = { rgb(30, 40, 70), rgb(120, 255, 200), rgb(200, 120, 255) }, Description = "An elegant orb that hums while it cleans." },
	{ Id = "nova_cleaner", Name = "Nova Cleaner", Role = "cleaner", Rarity = "Legendary", Source = "crate", Price = 0, Level = 20, Speed = 18, Width = 20, Capacity = 300, Battery = 360, Wear = 0.5, Magnet = 6, Model = "orb", Colors = { rgb(20, 20, 30), rgb(255, 190, 60), rgb(255, 255, 255) }, Description = "Crate exclusive. Burns like a small star." },
	-- collectors
	{ Id = "magnet_drone", Name = "Magnet Drone", Role = "collector", Rarity = "Uncommon", Source = "shop", Price = 4000, Level = 10, Speed = 12, Width = 0, Capacity = 6, Battery = 150, Wear = 0.9, Magnet = 18, Model = "drone", Colors = { rgb(220, 60, 60), rgb(220, 220, 230), rgb(40, 40, 50) }, Description = "Hunts debris pickups in its assigned zone." },
	{ Id = "scavenger_crab", Name = "Scavenger Crab", Role = "collector", Rarity = "Rare", Source = "shop", Price = 45000, Level = 22, Speed = 12, Width = 0, Capacity = 30, Battery = 200, Wear = 0.8, Magnet = 26, Model = "crab", Colors = { rgb(255, 120, 60), rgb(80, 60, 50), rgb(255, 220, 120) }, Description = "Skittering scavenger with long magnet claws." },
	{ Id = "gem_hound", Name = "Gem Hound", Role = "collector", Rarity = "Epic", Source = "crate", Price = 0, Level = 15, Speed = 16, Width = 0, Capacity = 40, Battery = 240, Wear = 0.6, Magnet = 30, Model = "crab", Colors = { rgb(60, 40, 90), rgb(120, 255, 240), rgb(255, 255, 255) }, Bonus = { Luck = 0.15 }, Description = "Crate exclusive. Sniffs out rare debris (+15% luck for you)." },
	-- haulers
	{ Id = "capsule_hauler", Name = "Capsule Hauler", Role = "hauler", Rarity = "Uncommon", Source = "shop", Price = 2000, Level = 6, Speed = 16, Width = 0, Capacity = 0, Battery = 200, Wear = 0.8, Magnet = 0, Model = "lifter", Colors = { rgb(240, 240, 245), rgb(60, 140, 255), rgb(50, 50, 60) }, Description = "Carries your dropped capsules home to the silo." },
	{ Id = "cargo_lifter", Name = "Cargo Lifter", Role = "hauler", Rarity = "Rare", Source = "shop", Price = 35000, Level = 20, Speed = 22, Width = 0, Capacity = 0, Battery = 300, Wear = 0.7, Magnet = 0, Model = "lifter", Colors = { rgb(255, 200, 40), rgb(40, 40, 50), rgb(255, 130, 40) }, Bonus = { AutoSell = 0.1 }, Description = "Hauls capsules and flies your silo to market every 90s (+10%)." },
	-- helpers
	{ Id = "buddy_bot", Name = "Buddy Bot", Role = "helper", Rarity = "Common", Source = "shop", Price = 1200, Level = 4, Speed = 20, Width = 0, Capacity = 0, Battery = 600, Wear = 0.3, Magnet = 0, Model = "orb", Colors = { rgb(255, 255, 255), rgb(255, 140, 40), rgb(60, 180, 255) }, Bonus = { Capacity = 0.10 }, Description = "Follows you around and carries a little extra (+10% capacity)." },
	{ Id = "lamp_drone", Name = "Lamp Drone", Role = "helper", Rarity = "Uncommon", Source = "shop", Price = 8000, Level = 15, Speed = 20, Width = 0, Capacity = 0, Battery = 600, Wear = 0.3, Magnet = 0, Model = "drone", Colors = { rgb(40, 40, 50), rgb(255, 240, 180), rgb(255, 200, 60) }, Bonus = { DarkSpeed = 0.08, Light = 1 }, Description = "Floodlight drone. Lights dark zones, +8% speed there." },
	{ Id = "packer_drone", Name = "Packer Drone", Role = "helper", Rarity = "Epic", Source = "shop", Price = 120000, Level = 28, Speed = 22, Width = 0, Capacity = 0, Battery = 600, Wear = 0.3, Magnet = 0, Model = "lifter", Colors = { rgb(80, 80, 90), rgb(190, 110, 255), rgb(255, 255, 255) }, Bonus = { AutoShip = 25 }, Description = "When your container is full it ships it to your silo (25s cooldown)." },
	{ Id = "repair_drone", Name = "Repair Drone", Role = "helper", Rarity = "Rare", Source = "crate", Price = 0, Level = 8, Speed = 20, Width = 0, Capacity = 0, Battery = 600, Wear = 0.2, Magnet = 0, Model = "drone", Colors = { rgb(60, 200, 100), rgb(240, 240, 245), rgb(40, 40, 50) }, Bonus = { Repair = 1.5, Xp = 0.05 }, Description = "Crate exclusive. Repairs your other robots while you play (+5% XP)." },
}

local byId: { [string]: RobotDef } = {}
for i, r in list do
	byId[r.Id] = r
	;(r :: any).Order = i
end

return {
	List = list,
	ById = byId,
	MaxLevel = 10,
	Roles = { "cleaner", "collector", "hauler", "helper" },
	Get = function(id: string): RobotDef?
		return byId[id]
	end,
}
