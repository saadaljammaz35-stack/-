--!strict
-- Crates (random rewards bought with in-game currencies only). Odds are shown in the UI.
-- Reward types: Credits (scaled by progression tier), Gems, Boost, Tool, Container, Robot.
-- Duplicate tools/containers are converted into gems (see Rarity.DupeGems).

export type CrateReward = {
	Type: string,
	Id: string?,
	Amount: number?,
	Minutes: number?,
	Weight: number,
}

export type CrateDef = {
	Id: string,
	Name: string,
	Currency: string, -- "Credits" | "Gems" | "EventTokens"
	Price: number,
	ScalePrice: boolean,
	Color: Color3,
	PityEvery: number?,
	PityRarities: { string }?,
	Pool: { CrateReward },
	Description: string,
	Event: string?,
}

local list: { CrateDef } = {
	{
		Id = "supply_crate",
		Name = "Supply Crate",
		Currency = "Credits",
		Price = 2500,
		ScalePrice = true,
		Color = Color3.fromRGB(255, 150, 50),
		Pool = {
			{ Type = "Credits", Amount = 1800, Weight = 38 },
			{ Type = "Credits", Amount = 6000, Weight = 8 },
			{ Type = "Gems", Amount = 5, Weight = 20 },
			{ Type = "Boost", Id = "xp2x", Minutes = 10, Weight = 12 },
			{ Type = "Boost", Id = "luck2x", Minutes = 10, Weight = 6 },
			{ Type = "Tool", Id = "lucky_whisk", Weight = 8 },
			{ Type = "Tool", Id = "comet_mop", Weight = 5 },
			{ Type = "Container", Id = "star_satchel", Weight = 2 },
			{ Type = "Tool", Id = "aurora_broom", Weight = 0.8 },
			{ Type = "Tool", Id = "meteor_vac", Weight = 0.2 },
		},
		Description = "Colony surplus. Mostly credits, sometimes a rare tool.",
	},
	{
		Id = "cosmic_crate",
		Name = "Cosmic Crate",
		Currency = "Gems",
		Price = 40,
		ScalePrice = false,
		Color = Color3.fromRGB(170, 100, 255),
		PityEvery = 30,
		PityRarities = { "Legendary", "Mythic" },
		Pool = {
			{ Type = "Gems", Amount = 15, Weight = 18 },
			{ Type = "Boost", Id = "credits2x", Minutes = 15, Weight = 14 },
			{ Type = "Tool", Id = "comet_mop", Weight = 16 },
			{ Type = "Tool", Id = "aurora_broom", Weight = 18 },
			{ Type = "Tool", Id = "meteor_vac", Weight = 14 },
			{ Type = "Container", Id = "star_satchel", Weight = 10 },
			{ Type = "Tool", Id = "quantum_sweeper", Weight = 5.5 },
			{ Type = "Container", Id = "pocket_dimension", Weight = 2.5 },
			{ Type = "Tool", Id = "black_hole_vac", Weight = 0.7 },
			{ Type = "Tool", Id = "nebula_duster", Weight = 0.3 },
		},
		Description = "Exotic gear. Guaranteed Legendary+ every 30 opens.",
	},
	{
		Id = "robot_crate",
		Name = "Robot Crate",
		Currency = "Gems",
		Price = 60,
		ScalePrice = false,
		Color = Color3.fromRGB(80, 200, 255),
		Pool = {
			{ Type = "Robot", Id = "repair_drone", Weight = 40 },
			{ Type = "Robot", Id = "gem_hound", Weight = 30 },
			{ Type = "Gems", Amount = 25, Weight = 22 },
			{ Type = "Robot", Id = "nova_cleaner", Weight = 8 },
		},
		Description = "Crate-exclusive robots.",
	},
	{
		Id = "event_crate",
		Name = "Event Crate",
		Currency = "EventTokens",
		Price = 120,
		ScalePrice = false,
		Color = Color3.fromRGB(255, 200, 80),
		Pool = {
			{ Type = "Gems", Amount = 10, Weight = 30 },
			{ Type = "Boost", Id = "xp2x", Minutes = 20, Weight = 20 },
			{ Type = "Boost", Id = "credits2x", Minutes = 15, Weight = 20 },
			{ Type = "EventTool", Weight = 15 },
			{ Type = "EventContainer", Weight = 15 },
		},
		Description = "Seasonal rewards. Contains the current event's exclusive gear.",
	},
}

local byId: { [string]: CrateDef } = {}
for _, c in list do
	byId[c.Id] = c
end

local BOOSTS = {
	xp2x = { Name = "2x XP", Icon = "★", Color = Color3.fromRGB(120, 200, 255) },
	credits2x = { Name = "2x Credits", Icon = "$", Color = Color3.fromRGB(255, 210, 80) },
	luck2x = { Name = "2x Luck", Icon = "🍀", Color = Color3.fromRGB(110, 230, 120) },
}

return {
	List = list,
	ById = byId,
	Boosts = BOOSTS,
	Get = function(id: string): CrateDef?
		return byId[id]
	end,
}
