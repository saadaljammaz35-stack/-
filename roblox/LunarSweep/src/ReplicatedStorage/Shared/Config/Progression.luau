--!strict
-- Login rewards, seasonal events, prestige (re-launch) perks and hidden relics.

local function rgb(r: number, g: number, b: number): Color3
	return Color3.fromRGB(r, g, b)
end

------------------------------------------------------------------ login rewards (7 day loop)
export type LoginReward = { Type: string, Amount: number?, Id: string?, Minutes: number?, Label: string }

local LoginRewards: { LoginReward } = {
	{ Type = "Credits", Amount = 150, Label = "Credits" },
	{ Type = "Gems", Amount = 5, Label = "5 Gems" },
	{ Type = "Boost", Id = "xp2x", Minutes = 15, Label = "2x XP (15m)" },
	{ Type = "Credits", Amount = 800, Label = "Credits" },
	{ Type = "Gems", Amount = 15, Label = "15 Gems" },
	{ Type = "Crate", Id = "supply_crate", Label = "Supply Crate" },
	{ Type = "Crate", Id = "cosmic_crate", Amount = 40, Label = "Cosmic Crate + 40 Gems" },
}

------------------------------------------------------------------ seasonal events
export type EventShopItem = { Type: string, Id: string?, Amount: number?, Minutes: number?, Price: number, Label: string }
export type EventDef = {
	Id: string,
	Name: string,
	Months: { number },
	TokenName: string,
	TokenIcon: string,
	Color: Color3,
	DropChance: number, -- chance per productive stroke
	XpBonus: number,
	Shop: { EventShopItem },
	Description: string,
}

local Events: { EventDef } = {
	{
		Id = "lantern_festival",
		Name = "Lantern Festival",
		Months = { 2, 3 },
		TokenName = "Lanterns",
		TokenIcon = "🏮",
		Color = rgb(255, 80, 60),
		DropChance = 0.035,
		XpBonus = 0.15,
		Shop = {
			{ Type = "Tool", Id = "lantern_brush", Price = 450, Label = "Lantern Brush" },
			{ Type = "Crate", Id = "event_crate", Price = 120, Label = "Event Crate" },
			{ Type = "Boost", Id = "luck2x", Minutes = 30, Price = 80, Label = "2x Luck (30m)" },
			{ Type = "Gems", Amount = 20, Price = 100, Label = "20 Gems" },
		},
		Description = "Red lanterns float over the colony. Collect Lanterns while cleaning.",
	},
	{
		Id = "solar_summer",
		Name = "Solar Summer",
		Months = { 6, 7, 8 },
		TokenName = "Sunstones",
		TokenIcon = "🌞",
		Color = rgb(255, 200, 60),
		DropChance = 0.035,
		XpBonus = 0.15,
		Shop = {
			{ Type = "Tool", Id = "solar_flare_vac", Price = 450, Label = "Solar Flare Vac" },
			{ Type = "Crate", Id = "event_crate", Price = 120, Label = "Event Crate" },
			{ Type = "Boost", Id = "credits2x", Minutes = 30, Price = 90, Label = "2x Credits (30m)" },
			{ Type = "Gems", Amount = 20, Price = 100, Label = "20 Gems" },
		},
		Description = "Solar flares supercharge base power. Collect Sunstones.",
	},
	{
		Id = "eclipse_night",
		Name = "Eclipse Night",
		Months = { 10 },
		TokenName = "Eclipse Candy",
		TokenIcon = "🍬",
		Color = rgb(255, 120, 30),
		DropChance = 0.04,
		XpBonus = 0.2,
		Shop = {
			{ Type = "Tool", Id = "eclipse_scythe", Price = 450, Label = "Eclipse Sweeper" },
			{ Type = "Crate", Id = "event_crate", Price = 120, Label = "Event Crate" },
			{ Type = "Boost", Id = "xp2x", Minutes = 30, Price = 70, Label = "2x XP (30m)" },
			{ Type = "Gems", Amount = 20, Price = 100, Label = "20 Gems" },
		},
		Description = "The Earth blocks the sun. Spooky dust everywhere.",
	},
	{
		Id = "harvest_moon",
		Name = "Harvest Moon",
		Months = { 11 },
		TokenName = "Harvest Seeds",
		TokenIcon = "🌾",
		Color = rgb(255, 160, 50),
		DropChance = 0.04,
		XpBonus = 0.2,
		Shop = {
			{ Type = "Tool", Id = "harvest_rake", Price = 450, Label = "Harvest Rake" },
			{ Type = "Container", Id = "harvest_basket", Price = 350, Label = "Harvest Basket" },
			{ Type = "Crate", Id = "event_crate", Price = 120, Label = "Event Crate" },
			{ Type = "Boost", Id = "xp2x", Minutes = 30, Price = 70, Label = "2x XP (30m)" },
			{ Type = "Gems", Amount = 20, Price = 100, Label = "20 Gems" },
		},
		Description = "A giant orange moon rises over the colony. Collect Harvest Seeds while cleaning.",
	},
	{
		Id = "frost_festival",
		Name = "Frost Festival",
		Months = { 12, 1 },
		TokenName = "Snowflakes",
		TokenIcon = "❄",
		Color = rgb(150, 210, 255),
		DropChance = 0.04,
		XpBonus = 0.2,
		Shop = {
			{ Type = "Tool", Id = "frost_broom", Price = 450, Label = "Frost Broom" },
			{ Type = "Container", Id = "frost_flask", Price = 350, Label = "Frost Flask" },
			{ Type = "Crate", Id = "event_crate", Price = 120, Label = "Event Crate" },
			{ Type = "Boost", Id = "credits2x", Minutes = 30, Price = 90, Label = "2x Credits (30m)" },
			{ Type = "Gems", Amount = 20, Price = 100, Label = "20 Gems" },
		},
		Description = "Snow falls on the colony. Collect Snowflakes while cleaning.",
	},
}

------------------------------------------------------------------ prestige / re-launch
export type PerkDef = { Id: string, Name: string, MaxLevel: number, Cost: number, CostGrowth: number, Effect: number, Description: string, Icon: string }

local Perks: { PerkDef } = {
	{ Id = "star_power", Name = "Star Power", MaxLevel = 10, Cost = 1, CostGrowth = 1, Effect = 0.10, Icon = "✦", Description = "+10% credits from everything per level." },
	{ Id = "quick_learner", Name = "Quick Learner", MaxLevel = 10, Cost = 1, CostGrowth = 1, Effect = 0.10, Icon = "★", Description = "+10% XP per level." },
	{ Id = "deep_pockets", Name = "Deep Pockets", MaxLevel = 5, Cost = 2, CostGrowth = 1, Effect = 0.10, Icon = "▣", Description = "+10% container capacity per level." },
	{ Id = "head_start", Name = "Head Start", MaxLevel = 1, Cost = 2, CostGrowth = 0, Effect = 1, Icon = "⏩", Description = "After a re-launch keep the Hand Brush and Canvas Sack." },
	{ Id = "zone_memory", Name = "Zone Memory", MaxLevel = 2, Cost = 3, CostGrowth = 2, Effect = 1, Icon = "🗺", Description = "Keep zones 2 and 3 (level 2: also 4 and 5) unlocked after re-launch." },
	{ Id = "extra_bay", Name = "Extra Bay", MaxLevel = 3, Cost = 3, CostGrowth = 2, Effect = 1, Icon = "🤖", Description = "+1 robot slot per level." },
	{ Id = "uplink_perk", Name = "Permanent Uplink", MaxLevel = 1, Cost = 5, CostGrowth = 0, Effect = 1, Icon = "📡", Description = "Free remote deposit from anywhere, forever." },
	{ Id = "lucky_star", Name = "Lucky Star", MaxLevel = 5, Cost = 2, CostGrowth = 1, Effect = 0.05, Icon = "🍀", Description = "+5% rare debris luck and crate luck per level." },
}

local Rebirth = {
	BaseLevel = 35, -- level requirement for the first re-launch
	LevelStep = 5, -- +5 levels per previous rebirth (capped)
	MaxLevelReq = 70,
	BaseCredits = 1000000,
	CreditsGrowth = 3,
	CreditsMultPer = 0.5, -- +50% credits per rebirth
	XpMultPer = 0.1,
}

------------------------------------------------------------------ hidden relics (secrets)
export type SecretDef = { Id: string, Name: string, Zone: string, X: number, Z: number, Cave: number?, Gems: number, Hint: string }

local Secrets: { SecretDef } = {
	{ Id = "founders_plaque", Name = "Founder's Plaque", Zone = "hub", X = -74, Z = -24, Gems = 5, Hint = "Behind the leaderboard wall, the colony remembers its founders." },
	{ Id = "forgotten_flag", Name = "Forgotten Flag", Zone = "dusty_flats", X = -150, Z = -640, Gems = 10, Hint = "An old flag stands alone in the far corner of the flats." },
	{ Id = "time_capsule", Name = "Crater Time Capsule", Zone = "pockmark_craters", X = 520, Z = -520, Gems = 15, Hint = "At the very bottom of the deepest crater." },
	{ Id = "lander_logbook", Name = "Lander Logbook", Zone = "junkyard_expanse", X = 640, Z = 120, Gems = 20, Hint = "Inside the biggest crashed lander." },
	{ Id = "cavern_heart", Name = "Heart of the Caverns", Zone = "crystal_caverns", X = 700, Z = 660, Cave = 6, Gems = 30, Hint = "The smallest, deepest chamber." },
	{ Id = "frozen_astronaut", Name = "Frozen Helmet", Zone = "frostbite_basin", X = -60, Z = 640, Gems = 30, Hint = "A ring of ice spires guards something." },
	{ Id = "ember_idol", Name = "Ember Idol", Zone = "ember_rift", X = -520, Z = 520, Gems = 40, Hint = "On an island where the rifts meet." },
	{ Id = "black_monolith", Name = "Black Monolith", Zone = "shadow_side", X = -640, Z = 0, Gems = 50, Hint = "Something tall and dark at the edge of the world." },
	{ Id = "first_meteorite", Name = "First Meteorite", Zone = "starfall_basin", X = -512, Z = -512, Gems = 60, Hint = "The peak at the centre of the basin." },
	{ Id = "orbital_beacon", Name = "Orbital Beacon", Zone = "orbital_ring", X = -20, Z = 170, Gems = 80, Hint = "A blinking beacon on a distant asteroid." },
}

local function index<T>(list: { T }): { [string]: T }
	local out = {}
	for _, item in list do
		out[(item :: any).Id] = item
	end
	return out
end

return {
	LoginRewards = LoginRewards,
	Events = Events,
	EventsById = index(Events),
	Perks = Perks,
	PerksById = index(Perks),
	Rebirth = Rebirth,
	Secrets = Secrets,
	SecretsById = index(Secrets),
}
