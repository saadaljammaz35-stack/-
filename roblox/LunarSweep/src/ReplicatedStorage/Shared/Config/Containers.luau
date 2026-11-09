--!strict
-- Dust containers worn on the back. Capacity is in kg.

export type ContainerDef = {
	Id: string,
	Name: string,
	Rarity: string,
	Kind: string, -- "pouch" | "bag" | "canister" | "tank" | "pod" | "orb"
	Source: string, -- "starter" | "shop" | "crate" | "event"
	Price: number,
	Level: number,
	Capacity: number,
	SpeedBonus: number?,
	Tradeable: boolean,
	Colors: { Color3 },
	Description: string,
	Event: string?,
}

local function rgb(r: number, g: number, b: number): Color3
	return Color3.fromRGB(r, g, b)
end

local list: { ContainerDef } = {
	{ Id = "pocket_pouch", Name = "Pocket Pouch", Rarity = "Common", Kind = "pouch", Source = "starter", Price = 0, Level = 1, Capacity = 0.5, Tradeable = false, Colors = { rgb(230, 230, 235), rgb(255, 130, 40) }, Description = "Holds half a kilo. Barely." },
	{ Id = "dust_bag", Name = "Dust Bag", Rarity = "Common", Kind = "bag", Source = "shop", Price = 25, Level = 1, Capacity = 2, Tradeable = false, Colors = { rgb(200, 180, 140), rgb(255, 130, 40) }, Description = "A sturdy canvas bag with a drawstring." },
	{ Id = "canvas_sack", Name = "Canvas Sack", Rarity = "Common", Kind = "bag", Source = "shop", Price = 120, Level = 3, Capacity = 5, Tradeable = false, Colors = { rgb(150, 130, 100), rgb(80, 160, 255) }, Description = "Double-stitched for heavier regolith." },
	{ Id = "steel_canister", Name = "Steel Canister", Rarity = "Uncommon", Kind = "canister", Source = "shop", Price = 400, Level = 6, Capacity = 10, Tradeable = false, Colors = { rgb(190, 195, 205), rgb(255, 130, 40) }, Description = "A sealed canister with a pressure valve." },
	{ Id = "twin_canister", Name = "Twin Canister", Rarity = "Uncommon", Kind = "canister", Source = "shop", Price = 1500, Level = 10, Capacity = 18, Tradeable = false, Colors = { rgb(240, 240, 245), rgb(60, 140, 255) }, Description = "Two canisters, twice the dust." },
	{ Id = "pressure_tank", Name = "Pressure Tank", Rarity = "Rare", Kind = "tank", Source = "shop", Price = 5000, Level = 14, Capacity = 30, Tradeable = false, Colors = { rgb(220, 70, 60), rgb(240, 240, 245) }, Description = "Compresses dust as it fills." },
	{ Id = "cargo_pack", Name = "Cargo Pack", Rarity = "Rare", Kind = "tank", Source = "shop", Price = 16000, Level = 19, Capacity = 50, Tradeable = false, Colors = { rgb(70, 80, 60), rgb(255, 190, 50) }, Description = "Military-grade hauling pack." },
	{ Id = "hover_hopper", Name = "Hover Hopper", Rarity = "Rare", Kind = "pod", Source = "shop", Price = 50000, Level = 25, Capacity = 80, SpeedBonus = 0.04, Tradeable = false, Colors = { rgb(240, 240, 245), rgb(80, 220, 255) }, Description = "Anti-grav coils make it lighter than it looks. +4% speed." },
	{ Id = "industrial_tank", Name = "Industrial Tank", Rarity = "Epic", Kind = "tank", Source = "shop", Price = 150000, Level = 31, Capacity = 130, Tradeable = false, Colors = { rgb(255, 200, 40), rgb(40, 40, 50) }, Description = "Rated for 130 kg of abrasive dust." },
	{ Id = "compression_pod", Name = "Compression Pod", Rarity = "Epic", Kind = "pod", Source = "shop", Price = 450000, Level = 38, Capacity = 200, Tradeable = false, Colors = { rgb(60, 60, 80), rgb(180, 110, 255) }, Description = "Crushes dust into a dense paste." },
	{ Id = "quantum_satchel", Name = "Quantum Satchel", Rarity = "Epic", Kind = "orb", Source = "shop", Price = 1400000, Level = 46, Capacity = 320, Tradeable = false, Colors = { rgb(30, 40, 70), rgb(80, 255, 255) }, Description = "Bigger on the inside." },
	{ Id = "singularity_jar", Name = "Singularity Jar", Rarity = "Legendary", Kind = "orb", Source = "shop", Price = 4500000, Level = 55, Capacity = 500, Tradeable = false, Colors = { rgb(20, 10, 30), rgb(255, 120, 220) }, Description = "A contained micro-singularity. Do not shake." },
	{ Id = "nebula_vault", Name = "Nebula Vault", Rarity = "Legendary", Kind = "pod", Source = "shop", Price = 15000000, Level = 65, Capacity = 800, Tradeable = false, Colors = { rgb(40, 20, 70), rgb(255, 160, 255) }, Description = "Stores dust in a pocket nebula." },
	{ Id = "pocket_dimension", Name = "Pocket Dimension", Rarity = "Mythic", Kind = "orb", Source = "crate", Price = 0, Level = 30, Capacity = 1300, SpeedBonus = 0.05, Tradeable = true, Colors = { rgb(10, 10, 20), rgb(255, 255, 255) }, Description = "Crate exclusive. An entire dimension, just for dust." },
	{ Id = "star_satchel", Name = "Star Satchel", Rarity = "Epic", Kind = "bag", Source = "crate", Price = 0, Level = 12, Capacity = 70, Tradeable = true, Colors = { rgb(255, 220, 120), rgb(80, 120, 255) }, Description = "Crate exclusive. Stitched with star thread." },
	{ Id = "harvest_basket", Name = "Harvest Basket", Rarity = "Epic", Kind = "bag", Source = "event", Event = "harvest_moon", Price = 350, Level = 8, Capacity = 60, Tradeable = false, Colors = { rgb(160, 100, 50), rgb(255, 160, 40) }, Description = "Harvest Moon exclusive basket." },
	{ Id = "frost_flask", Name = "Frost Flask", Rarity = "Epic", Kind = "canister", Source = "event", Event = "frost_festival", Price = 350, Level = 8, Capacity = 60, Tradeable = false, Colors = { rgb(200, 230, 255), rgb(120, 200, 255) }, Description = "Frost Festival exclusive flask." },
}

local byId: { [string]: ContainerDef } = {}
for i, c in list do
	byId[c.Id] = c
	;(c :: any).Order = i
end

return {
	List = list,
	ById = byId,
	Get = function(id: string): ContainerDef?
		return byId[id]
	end,
}
