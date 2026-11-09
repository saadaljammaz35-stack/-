--!strict
-- Everything that can sit inside a dust container or a base silo.
-- Kind = "Dust" (swept from terrain, measured in kg), "Debris" (pickups with a fixed weight each),
-- or "Processed" (made by base production buildings).

export type ResourceDef = {
	Id: string,
	Name: string,
	Kind: string,
	Value: number, -- credits per kg (before multipliers)
	Kg: number, -- weight of one pickup (Debris only)
	Rarity: string,
	Color: Color3,
	Shape: string, -- visual for pickups: "Pebble" | "Bolt" | "Shard" | "Plate" | "Board" | "Crystal" | "Orb" | "Core" | "Badge" | "Canister" | "Brick"
	Zone: string?,
	Glow: boolean?,
}

local function rgb(r: number, g: number, b: number): Color3
	return Color3.fromRGB(r, g, b)
end

local list: { ResourceDef } = {
	-- zone dusts
	{ Id = "grey_dust", Name = "Grey Moon Dust", Kind = "Dust", Value = 1, Kg = 0, Rarity = "Common", Color = rgb(150, 145, 138), Shape = "Pebble", Zone = "dusty_flats" },
	{ Id = "crater_regolith", Name = "Crater Regolith", Kind = "Dust", Value = 2.6, Kg = 0, Rarity = "Common", Color = rgb(120, 116, 112), Shape = "Pebble", Zone = "pockmark_craters" },
	{ Id = "rust_dust", Name = "Rust Dust", Kind = "Dust", Value = 6.5, Kg = 0, Rarity = "Common", Color = rgb(150, 100, 70), Shape = "Pebble", Zone = "junkyard_expanse" },
	{ Id = "crystal_silt", Name = "Crystal Silt", Kind = "Dust", Value = 16, Kg = 0, Rarity = "Uncommon", Color = rgb(170, 140, 210), Shape = "Pebble", Zone = "crystal_caverns" },
	{ Id = "frost_powder", Name = "Frost Powder", Kind = "Dust", Value = 38, Kg = 0, Rarity = "Uncommon", Color = rgb(200, 220, 240), Shape = "Pebble", Zone = "frostbite_basin" },
	{ Id = "ash_soot", Name = "Ash Soot", Kind = "Dust", Value = 85, Kg = 0, Rarity = "Rare", Color = rgb(60, 52, 52), Shape = "Pebble", Zone = "ember_rift" },
	{ Id = "void_dust", Name = "Void Dust", Kind = "Dust", Value = 190, Kg = 0, Rarity = "Rare", Color = rgb(70, 60, 120), Shape = "Pebble", Zone = "shadow_side" },
	{ Id = "star_powder", Name = "Star Powder", Kind = "Dust", Value = 420, Kg = 0, Rarity = "Epic", Color = rgb(240, 200, 110), Shape = "Pebble", Zone = "starfall_basin" },
	{ Id = "nebula_dust", Name = "Nebula Dust", Kind = "Dust", Value = 950, Kg = 0, Rarity = "Epic", Color = rgb(120, 220, 230), Shape = "Pebble", Zone = "orbital_ring" },

	-- debris pickups
	{ Id = "pebble", Name = "Lunar Pebble", Kind = "Debris", Value = 3, Kg = 0.08, Rarity = "Common", Color = rgb(140, 138, 134), Shape = "Pebble", Zone = "dusty_flats" },
	{ Id = "rusty_bolt", Name = "Rusty Bolt", Kind = "Debris", Value = 6, Kg = 0.15, Rarity = "Common", Color = rgb(160, 110, 80), Shape = "Bolt", Zone = "dusty_flats" },
	{ Id = "moon_glass", Name = "Moon Glass", Kind = "Debris", Value = 25, Kg = 0.1, Rarity = "Rare", Color = rgb(150, 220, 255), Shape = "Shard", Zone = "dusty_flats", Glow = true },
	{ Id = "regolith_chunk", Name = "Regolith Chunk", Kind = "Debris", Value = 5, Kg = 0.3, Rarity = "Common", Color = rgb(110, 106, 100), Shape = "Pebble", Zone = "pockmark_craters" },
	{ Id = "meteor_shard", Name = "Meteor Shard", Kind = "Debris", Value = 18, Kg = 0.2, Rarity = "Uncommon", Color = rgb(90, 70, 60), Shape = "Shard", Zone = "pockmark_craters" },
	{ Id = "impact_glass", Name = "Impact Glass", Kind = "Debris", Value = 60, Kg = 0.15, Rarity = "Rare", Color = rgb(120, 255, 170), Shape = "Shard", Zone = "pockmark_craters", Glow = true },
	{ Id = "scrap_plate", Name = "Scrap Plate", Kind = "Debris", Value = 12, Kg = 0.5, Rarity = "Common", Color = rgb(170, 170, 176), Shape = "Plate", Zone = "junkyard_expanse" },
	{ Id = "circuit_board", Name = "Circuit Board", Kind = "Debris", Value = 40, Kg = 0.25, Rarity = "Uncommon", Color = rgb(40, 140, 80), Shape = "Board", Zone = "junkyard_expanse" },
	{ Id = "solar_cell", Name = "Solar Cell", Kind = "Debris", Value = 90, Kg = 0.3, Rarity = "Rare", Color = rgb(40, 70, 160), Shape = "Plate", Zone = "junkyard_expanse", Glow = true },
	{ Id = "astronaut_badge", Name = "Vintage Mission Badge", Kind = "Debris", Value = 2000, Kg = 0.05, Rarity = "Epic", Color = rgb(255, 210, 90), Shape = "Badge", Zone = "junkyard_expanse", Glow = true },
	{ Id = "moon_quartz", Name = "Moon Quartz", Kind = "Debris", Value = 30, Kg = 0.4, Rarity = "Common", Color = rgb(230, 220, 255), Shape = "Crystal", Zone = "crystal_caverns" },
	{ Id = "amethyst_shard", Name = "Amethyst Shard", Kind = "Debris", Value = 90, Kg = 0.3, Rarity = "Uncommon", Color = rgb(170, 90, 230), Shape = "Crystal", Zone = "crystal_caverns", Glow = true },
	{ Id = "glow_crystal", Name = "Glow Crystal", Kind = "Debris", Value = 240, Kg = 0.5, Rarity = "Rare", Color = rgb(120, 255, 240), Shape = "Crystal", Zone = "crystal_caverns", Glow = true },
	{ Id = "ice_core", Name = "Ice Core", Kind = "Debris", Value = 50, Kg = 0.8, Rarity = "Common", Color = rgb(180, 230, 255), Shape = "Core", Zone = "frostbite_basin" },
	{ Id = "frozen_helium", Name = "Frozen Helium-3", Kind = "Debris", Value = 180, Kg = 0.4, Rarity = "Uncommon", Color = rgb(150, 250, 255), Shape = "Canister", Zone = "frostbite_basin", Glow = true },
	{ Id = "aurora_ice", Name = "Aurora Ice", Kind = "Debris", Value = 500, Kg = 0.6, Rarity = "Rare", Color = rgb(150, 255, 190), Shape = "Crystal", Zone = "frostbite_basin", Glow = true },
	{ Id = "obsidian", Name = "Obsidian", Kind = "Debris", Value = 120, Kg = 0.7, Rarity = "Common", Color = rgb(30, 26, 34), Shape = "Shard", Zone = "ember_rift" },
	{ Id = "magma_core", Name = "Magma Core", Kind = "Debris", Value = 300, Kg = 0.9, Rarity = "Uncommon", Color = rgb(255, 110, 40), Shape = "Core", Zone = "ember_rift", Glow = true },
	{ Id = "fire_opal", Name = "Fire Opal", Kind = "Debris", Value = 1500, Kg = 0.3, Rarity = "Rare", Color = rgb(255, 80, 60), Shape = "Crystal", Zone = "ember_rift", Glow = true },
	{ Id = "void_shard", Name = "Void Shard", Kind = "Debris", Value = 300, Kg = 0.5, Rarity = "Common", Color = rgb(70, 50, 140), Shape = "Shard", Zone = "shadow_side", Glow = true },
	{ Id = "shadow_pearl", Name = "Shadow Pearl", Kind = "Debris", Value = 900, Kg = 0.3, Rarity = "Uncommon", Color = rgb(40, 36, 60), Shape = "Orb", Zone = "shadow_side", Glow = true },
	{ Id = "eclipse_relic", Name = "Eclipse Relic", Kind = "Debris", Value = 3500, Kg = 0.4, Rarity = "Epic", Color = rgb(255, 150, 60), Shape = "Badge", Zone = "shadow_side", Glow = true },
	{ Id = "star_fragment", Name = "Star Fragment", Kind = "Debris", Value = 700, Kg = 0.6, Rarity = "Common", Color = rgb(255, 230, 140), Shape = "Shard", Zone = "starfall_basin", Glow = true },
	{ Id = "meteor_core", Name = "Meteor Core", Kind = "Debris", Value = 1600, Kg = 1.2, Rarity = "Uncommon", Color = rgb(120, 80, 60), Shape = "Core", Zone = "starfall_basin", Glow = true },
	{ Id = "comet_heart", Name = "Comet Heart", Kind = "Debris", Value = 8000, Kg = 0.5, Rarity = "Epic", Color = rgb(140, 220, 255), Shape = "Orb", Zone = "starfall_basin", Glow = true },
	{ Id = "cosmic_pebble", Name = "Cosmic Pebble", Kind = "Debris", Value = 1500, Kg = 0.4, Rarity = "Common", Color = rgb(110, 130, 200), Shape = "Pebble", Zone = "orbital_ring", Glow = true },
	{ Id = "nebula_gem", Name = "Nebula Gem", Kind = "Debris", Value = 4500, Kg = 0.5, Rarity = "Rare", Color = rgb(255, 120, 230), Shape = "Crystal", Zone = "orbital_ring", Glow = true },
	{ Id = "singularity_seed", Name = "Singularity Seed", Kind = "Debris", Value = 25000, Kg = 0.3, Rarity = "Legendary", Color = rgb(20, 10, 30), Shape = "Orb", Zone = "orbital_ring", Glow = true },

	-- server-event specials
	{ Id = "meteorite", Name = "Fresh Meteorite", Kind = "Debris", Value = 0, Kg = 0.6, Rarity = "Rare", Color = rgb(255, 140, 60), Shape = "Core", Glow = true },

	-- processed goods (base production)
	{ Id = "dust_brick", Name = "Compressed Dust Brick", Kind = "Processed", Value = 0, Kg = 0, Rarity = "Uncommon", Color = rgb(200, 196, 188), Shape = "Brick" },
	{ Id = "moon_stone", Name = "Moon Stone Block", Kind = "Processed", Value = 0, Kg = 0, Rarity = "Rare", Color = rgb(225, 225, 230), Shape = "Brick" },
	{ Id = "refined_crystal", Name = "Refined Crystal", Kind = "Processed", Value = 0, Kg = 0, Rarity = "Epic", Color = rgb(200, 150, 255), Shape = "Crystal", Glow = true },
	{ Id = "helium3_cell", Name = "Helium-3 Fuel Cell", Kind = "Processed", Value = 0, Kg = 0, Rarity = "Epic", Color = rgb(120, 250, 255), Shape = "Canister", Glow = true },
	{ Id = "drilled_dust", Name = "Drilled Regolith", Kind = "Processed", Value = 0, Kg = 0, Rarity = "Common", Color = rgb(160, 150, 140), Shape = "Pebble" },
}

local byId: { [string]: ResourceDef } = {}
for _, r in list do
	byId[r.Id] = r
end

-- Processed values are defined relative to the best dust the player has unlocked, so base
-- production stays relevant all game long. They are resolved at runtime by Formulas.ResourceValue.
local PROCESSED_MULT = {
	drilled_dust = 0.9,
	dust_brick = 2.6,
	moon_stone = 5.5,
	refined_crystal = 9,
	helium3_cell = 14,
}

-- Fresh meteorites are worth 40x the local dust per kg (set by Formulas)
local EVENT_MULT = {
	meteorite = 40,
}

return {
	List = list,
	ById = byId,
	ProcessedMult = PROCESSED_MULT,
	EventMult = EVENT_MULT,
	Get = function(id: string): ResourceDef?
		return byId[id]
	end,
}
