--!strict
-- Cleaning tools. Width = footprint diameter (studs), Reach = how far in front of the
-- astronaut the footprint lands, Depth = kg multiplier per cleaned cell, Magnet = extra
-- pickup radius for debris. Source decides how a tool can be obtained.

export type ToolDef = {
	Id: string,
	Name: string,
	Rarity: string,
	Kind: string, -- "brush" | "broom" | "pushbroom" | "vacuum" | "canister" | "wand" | "rake" | "plasma"
	Source: string, -- "starter" | "shop" | "crate" | "event" | "prestige"
	Price: number, -- credits (shop) / gems (prestige: stars) / event tokens
	Level: number,
	Width: number,
	Reach: number,
	Depth: number,
	Magnet: number,
	Luck: number?, -- bonus rare-debris chance
	SpeedBonus: number?, -- walk speed bonus while equipped (fraction)
	Tradeable: boolean,
	Colors: { Color3 }, -- { shaft/body, head, accent }
	Description: string,
	Event: string?,
}

local function rgb(r: number, g: number, b: number): Color3
	return Color3.fromRGB(r, g, b)
end

local list: { ToolDef } = {
	-- Common ---------------------------------------------------------------
	{ Id = "toothbrush", Name = "Toothbrush", Rarity = "Common", Kind = "brush", Source = "starter", Price = 0, Level = 1, Width = 3, Reach = 3, Depth = 1.0, Magnet = 2, Tradeable = false, Colors = { rgb(240, 240, 245), rgb(255, 140, 40), rgb(70, 160, 255) }, Description = "Standard issue. Slow, but it is a start." },
	{ Id = "nail_brush", Name = "Nail Brush", Rarity = "Common", Kind = "brush", Source = "shop", Price = 3, Level = 1, Width = 4, Reach = 3, Depth = 1.1, Magnet = 2, Tradeable = false, Colors = { rgb(255, 210, 120), rgb(240, 230, 210), rgb(255, 120, 40) }, Description = "Stiff bristles get a little more dust out of each pass." },
	{ Id = "scrub_brush", Name = "Scrub Brush", Rarity = "Common", Kind = "brush", Source = "shop", Price = 15, Level = 2, Width = 5, Reach = 3.5, Depth = 1.2, Magnet = 2.5, Tradeable = false, Colors = { rgb(90, 160, 230), rgb(250, 250, 250), rgb(255, 150, 40) }, Description = "Wider head for lazy afternoons on the flats." },
	{ Id = "hand_brush", Name = "Hand Brush", Rarity = "Common", Kind = "brush", Source = "shop", Price = 40, Level = 3, Width = 6, Reach = 4, Depth = 1.25, Magnet = 3, Tradeable = false, Colors = { rgb(200, 140, 80), rgb(60, 50, 40), rgb(255, 160, 50) }, Description = "Wooden-handled classic with a long reach." },
	{ Id = "dustpan_duo", Name = "Dustpan Duo", Rarity = "Common", Kind = "brush", Source = "shop", Price = 90, Level = 4, Width = 7, Reach = 4, Depth = 1.35, Magnet = 3.5, Tradeable = false, Colors = { rgb(255, 120, 60), rgb(255, 230, 90), rgb(60, 60, 70) }, Description = "Sweep and scoop in one motion." },
	-- Uncommon -------------------------------------------------------------
	{ Id = "household_broom", Name = "Household Broom", Rarity = "Uncommon", Kind = "broom", Source = "shop", Price = 180, Level = 5, Width = 8, Reach = 5, Depth = 1.4, Magnet = 4, Tradeable = false, Colors = { rgb(70, 70, 80), rgb(230, 200, 140), rgb(255, 140, 40) }, Description = "Finally, a proper broom. Covers ground fast." },
	{ Id = "wide_broom", Name = "Wide Broom", Rarity = "Uncommon", Kind = "pushbroom", Source = "shop", Price = 450, Level = 7, Width = 10, Reach = 5.5, Depth = 1.5, Magnet = 4, Tradeable = false, Colors = { rgb(60, 60, 70), rgb(240, 230, 210), rgb(255, 140, 40) }, Description = "A wide push head for wide open plains." },
	{ Id = "push_broom", Name = "Push Broom", Rarity = "Uncommon", Kind = "pushbroom", Source = "shop", Price = 1100, Level = 9, Width = 12, Reach = 6, Depth = 1.6, Magnet = 5, Tradeable = false, Colors = { rgb(40, 40, 50), rgb(200, 60, 40), rgb(255, 200, 60) }, Description = "Industrial bristles that grab regolith grit." },
	{ Id = "hand_vac", Name = "Hand Vac", Rarity = "Uncommon", Kind = "vacuum", Source = "shop", Price = 2500, Level = 11, Width = 10, Reach = 8, Depth = 1.9, Magnet = 7, Tradeable = false, Colors = { rgb(240, 240, 245), rgb(255, 120, 30), rgb(60, 60, 70) }, Description = "Battery-powered suction. Reaches dust ahead of you." },
	-- Rare -----------------------------------------------------------------
	{ Id = "extra_wide_broom", Name = "Extra-Wide Broom", Rarity = "Rare", Kind = "pushbroom", Source = "shop", Price = 5500, Level = 14, Width = 16, Reach = 6.5, Depth = 1.8, Magnet = 5, Tradeable = false, Colors = { rgb(30, 30, 40), rgb(240, 240, 245), rgb(80, 170, 255) }, Description = "So wide it needs two hinges." },
	{ Id = "canister_vac", Name = "Canister Vac", Rarity = "Rare", Kind = "canister", Source = "shop", Price = 12000, Level = 17, Width = 14, Reach = 10, Depth = 2.2, Magnet = 9, Tradeable = false, Colors = { rgb(220, 60, 60), rgb(240, 240, 245), rgb(40, 40, 50) }, Description = "Hose-fed suction with a powerful motor." },
	{ Id = "twin_sweeper", Name = "Twin Sweeper", Rarity = "Rare", Kind = "pushbroom", Source = "shop", Price = 26000, Level = 20, Width = 18, Reach = 7, Depth = 2.3, Magnet = 7, Tradeable = false, Colors = { rgb(255, 200, 40), rgb(40, 40, 50), rgb(255, 120, 30) }, Description = "Two counter-rotating brush heads." },
	{ Id = "backpack_vac", Name = "Backpack Vac", Rarity = "Rare", Kind = "canister", Source = "shop", Price = 55000, Level = 24, Width = 16, Reach = 12, Depth = 2.6, Magnet = 11, Tradeable = false, Colors = { rgb(60, 120, 220), rgb(230, 230, 235), rgb(255, 160, 40) }, Description = "Pro janitor gear with a long nozzle." },
	{ Id = "shop_vac", Name = "Shop Vac", Rarity = "Rare", Kind = "canister", Source = "shop", Price = 110000, Level = 28, Width = 18, Reach = 12, Depth = 2.9, Magnet = 12, Tradeable = false, Colors = { rgb(255, 210, 30), rgb(40, 40, 45), rgb(220, 220, 225) }, Description = "Loud, yellow and unstoppable." },
	-- Epic -----------------------------------------------------------------
	{ Id = "industrial_vac", Name = "Industrial Vac", Rarity = "Epic", Kind = "vacuum", Source = "shop", Price = 240000, Level = 33, Width = 20, Reach = 14, Depth = 3.3, Magnet = 14, Tradeable = false, Colors = { rgb(90, 90, 100), rgb(255, 140, 30), rgb(255, 230, 80) }, Description = "Designed for hangar floors, perfect for crater bowls." },
	{ Id = "cyclone_vac", Name = "Cyclone Vac", Rarity = "Epic", Kind = "vacuum", Source = "shop", Price = 520000, Level = 38, Width = 22, Reach = 15, Depth = 3.7, Magnet = 15, Tradeable = false, Colors = { rgb(200, 220, 240), rgb(120, 80, 255), rgb(80, 255, 230) }, Description = "A spinning vortex chamber that never clogs." },
	{ Id = "ion_brush", Name = "Ion Brush", Rarity = "Epic", Kind = "wand", Source = "shop", Price = 1100000, Level = 43, Width = 26, Reach = 10, Depth = 3.6, Magnet = 12, Tradeable = false, Colors = { rgb(30, 30, 40), rgb(90, 200, 255), rgb(170, 240, 255) }, Description = "Charged filaments make the dust jump to you." },
	{ Id = "solar_broom", Name = "Solar Broom", Rarity = "Epic", Kind = "pushbroom", Source = "shop", Price = 2300000, Level = 48, Width = 28, Reach = 11, Depth = 4.0, Magnet = 14, Tradeable = false, Colors = { rgb(30, 50, 110), rgb(255, 220, 90), rgb(255, 160, 40) }, Description = "Solar-heated bristles bake dust into clumps." },
	{ Id = "sweeper_wand", Name = "Sweeper Wand", Rarity = "Epic", Kind = "wand", Source = "shop", Price = 4800000, Level = 53, Width = 24, Reach = 18, Depth = 4.5, Magnet = 18, Tradeable = false, Colors = { rgb(240, 240, 250), rgb(190, 110, 255), rgb(255, 255, 255) }, Description = "Point, wave, clean. Very theatrical." },
	-- Legendary ------------------------------------------------------------
	{ Id = "plasma_vac", Name = "Plasma Vac", Rarity = "Legendary", Kind = "plasma", Source = "shop", Price = 10000000, Level = 58, Width = 28, Reach = 18, Depth = 5.2, Magnet = 20, Tradeable = false, Colors = { rgb(20, 20, 30), rgb(255, 80, 200), rgb(80, 220, 255) }, Description = "Ionises dust mid-air and inhales it." },
	{ Id = "gravity_rake", Name = "Gravity Rake", Rarity = "Legendary", Kind = "rake", Source = "shop", Price = 22000000, Level = 64, Width = 34, Reach = 14, Depth = 5.5, Magnet = 22, Tradeable = false, Colors = { rgb(50, 40, 70), rgb(255, 190, 60), rgb(140, 100, 255) }, Description = "Bends local gravity so the dust rolls into the tank." },
	{ Id = "starforge_broom", Name = "Starforge Broom", Rarity = "Mythic", Kind = "pushbroom", Source = "shop", Price = 150000000, Level = 80, Width = 40, Reach = 18, Depth = 7.0, Magnet = 26, Tradeable = false, Colors = { rgb(20, 20, 30), rgb(255, 120, 40), rgb(255, 240, 160) }, Description = "Forged in a dying star. The final broom." },
	-- Crate exclusives (tradeable) ----------------------------------------
	{ Id = "lucky_whisk", Name = "Lucky Whisk", Rarity = "Rare", Kind = "brush", Source = "crate", Price = 0, Level = 3, Width = 8, Reach = 5, Depth = 1.6, Magnet = 8, Luck = 0.15, Tradeable = true, Colors = { rgb(60, 200, 100), rgb(255, 240, 120), rgb(255, 255, 255) }, Description = "Seems to find shiny things. +15% rare debris luck." },
	{ Id = "comet_mop", Name = "Comet Mop", Rarity = "Rare", Kind = "broom", Source = "crate", Price = 0, Level = 8, Width = 13, Reach = 7, Depth = 2.0, Magnet = 9, SpeedBonus = 0.06, Tradeable = true, Colors = { rgb(80, 160, 255), rgb(220, 240, 255), rgb(255, 255, 255) }, Description = "Leaves an icy trail. +6% walk speed." },
	{ Id = "aurora_broom", Name = "Aurora Broom", Rarity = "Epic", Kind = "pushbroom", Source = "crate", Price = 0, Level = 18, Width = 22, Reach = 9, Depth = 2.9, Magnet = 12, Luck = 0.1, Tradeable = true, Colors = { rgb(40, 40, 60), rgb(120, 255, 200), rgb(200, 120, 255) }, Description = "Bristles shimmer like the polar lights." },
	{ Id = "meteor_vac", Name = "Meteor Vac", Rarity = "Epic", Kind = "vacuum", Source = "crate", Price = 0, Level = 26, Width = 22, Reach = 15, Depth = 3.6, Magnet = 16, Tradeable = true, Colors = { rgb(80, 50, 40), rgb(255, 120, 40), rgb(255, 220, 120) }, Description = "Built around a captured meteorite core." },
	{ Id = "quantum_sweeper", Name = "Quantum Sweeper", Rarity = "Legendary", Kind = "plasma", Source = "crate", Price = 0, Level = 36, Width = 32, Reach = 20, Depth = 5.0, Magnet = 24, Luck = 0.2, Tradeable = true, Colors = { rgb(20, 30, 50), rgb(80, 255, 255), rgb(255, 255, 255) }, Description = "Cleans every probable position of the dust at once." },
	{ Id = "black_hole_vac", Name = "Black Hole Vac", Rarity = "Mythic", Kind = "plasma", Source = "crate", Price = 0, Level = 45, Width = 36, Reach = 24, Depth = 7.5, Magnet = 34, Luck = 0.25, Tradeable = true, Colors = { rgb(10, 5, 15), rgb(160, 60, 255), rgb(255, 140, 60) }, Description = "A tiny event horizon in a handle. Handle with care." },
	{ Id = "nebula_duster", Name = "Nebula Duster", Rarity = "Mythic", Kind = "wand", Source = "crate", Price = 0, Level = 50, Width = 38, Reach = 22, Depth = 8.5, Magnet = 28, Luck = 0.2, SpeedBonus = 0.08, Tradeable = true, Colors = { rgb(30, 20, 60), rgb(255, 100, 220), rgb(100, 220, 255) }, Description = "Spun from nebula gas. The rarest duster in the system." },
	-- Event exclusives -----------------------------------------------------
	{ Id = "harvest_rake", Name = "Harvest Rake", Rarity = "Epic", Kind = "rake", Source = "event", Event = "harvest_moon", Price = 450, Level = 10, Width = 18, Reach = 9, Depth = 2.6, Magnet = 12, Luck = 0.1, Tradeable = false, Colors = { rgb(120, 70, 40), rgb(255, 150, 40), rgb(255, 220, 80) }, Description = "Harvest Moon exclusive. Rakes in the gold." },
	{ Id = "frost_broom", Name = "Frost Broom", Rarity = "Epic", Kind = "broom", Source = "event", Event = "frost_festival", Price = 450, Level = 10, Width = 18, Reach = 9, Depth = 2.6, Magnet = 12, SpeedBonus = 0.05, Tradeable = false, Colors = { rgb(200, 230, 255), rgb(255, 255, 255), rgb(120, 200, 255) }, Description = "Frost Festival exclusive. Snowflakes not included." },
	{ Id = "lantern_brush", Name = "Lantern Brush", Rarity = "Epic", Kind = "brush", Source = "event", Event = "lantern_festival", Price = 450, Level = 10, Width = 17, Reach = 8, Depth = 2.7, Magnet = 13, Luck = 0.08, Tradeable = false, Colors = { rgb(200, 30, 30), rgb(255, 200, 60), rgb(255, 240, 200) }, Description = "Lantern Festival exclusive. Glows warmly." },
	{ Id = "solar_flare_vac", Name = "Solar Flare Vac", Rarity = "Epic", Kind = "vacuum", Source = "event", Event = "solar_summer", Price = 450, Level = 10, Width = 17, Reach = 12, Depth = 2.7, Magnet = 14, Tradeable = false, Colors = { rgb(255, 230, 120), rgb(255, 100, 30), rgb(255, 255, 255) }, Description = "Solar Summer exclusive. Hot to the touch." },
	{ Id = "eclipse_scythe", Name = "Eclipse Sweeper", Rarity = "Epic", Kind = "rake", Source = "event", Event = "eclipse_night", Price = 450, Level = 10, Width = 18, Reach = 10, Depth = 2.6, Magnet = 13, Luck = 0.1, Tradeable = false, Colors = { rgb(30, 20, 40), rgb(255, 120, 30), rgb(160, 60, 255) }, Description = "Eclipse Night exclusive. Spooky but tidy." },
}

local byId: { [string]: ToolDef } = {}
for i, t in list do
	byId[t.Id] = t
	;(t :: any).Order = i
end

return {
	List = list,
	ById = byId,
	Get = function(id: string): ToolDef?
		return byId[id]
	end,
}
