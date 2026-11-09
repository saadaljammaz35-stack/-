--!strict
-- All gameplay math lives here so the server (authoritative) and client (UI previews,
-- comparisons) always agree.

local Config = script.Parent.Config
local GameConfig = require(Config.GameConfig)
local Zones = require(Config.Zones)
local Tools = require(Config.Tools)
local Containers = require(Config.Containers)
local Upgrades = require(Config.Upgrades)
local Robots = require(Config.Robots)
local Buildings = require(Config.Buildings)
local Resources = require(Config.Resources)
local Progression = require(Config.Progression)
local Vehicles = require(Config.Vehicles)

local Formulas = {}

type Profile = { [string]: any }

local function up(profile: Profile, id: string): number
	local u = profile.Upgrades
	return (u and u[id]) or 0
end

local function perk(profile: Profile, id: string): number
	local p = profile.Perks
	return (p and p[id]) or 0
end

Formulas.UpgradeLevel = up
Formulas.PerkLevel = perk

------------------------------------------------------------------ levels

function Formulas.XpToNext(level: number): number
	return math.floor(30 * level ^ 1.6 + 20)
end

-- progression tier = highest unlocked zone index (1..9)
function Formulas.Tier(profile: Profile): number
	local best = 1
	local unlocked = profile.Zones or {}
	for _, z in Zones.List do
		if unlocked[z.Id] and z.Index > best then
			best = z.Index
		end
	end
	return best
end

function Formulas.TierScale(kind: string, tier: number): number
	if kind == "flat" then
		return 1 + 0.45 * (tier - 1)
	elseif kind == "kg" then
		return 1.85 ^ (tier - 1)
	elseif kind == "credits" then
		return 3.3 ^ (tier - 1)
	end
	return 1
end

------------------------------------------------------------------ multipliers

function Formulas.PriceMultiplier(profile: Profile): number
	return math.max(0.5, 1 - 0.04 * up(profile, "supplier_network"))
end

function Formulas.SellMultiplier(profile: Profile, fromSilo: boolean?, labLevel: number?): number
	local m = 1 + 0.08 * up(profile, "market_contracts")
	m *= 1 + Progression.Rebirth.CreditsMultPer * (profile.Rebirths or 0)
	m *= 1 + 0.10 * perk(profile, "star_power")
	m *= 1 + 0.02 * (labLevel or 0)
	if fromSilo then
		m *= 1 + 0.10 * up(profile, "rapid_transfer")
	end
	return m
end

function Formulas.XpMultiplier(profile: Profile, labLevel: number?): number
	local m = 1 + 0.05 * up(profile, "xp_booster")
	m *= 1 + Progression.Rebirth.XpMultPer * (profile.Rebirths or 0)
	m *= 1 + 0.10 * perk(profile, "quick_learner")
	m *= 1 + 0.03 * (labLevel or 0)
	return m
end

function Formulas.LuckBonus(profile: Profile, toolId: string?): number
	local luck = 0.10 * up(profile, "lucky_finds") + 0.05 * perk(profile, "lucky_star")
	local t = toolId and Tools.ById[toolId]
	if t and t.Luck then
		luck += t.Luck
	end
	return luck
end

------------------------------------------------------------------ equipment

export type ToolStats = {
	Width: number,
	Radius: number,
	Reach: number,
	Depth: number,
	Magnet: number,
	Surge: number,
	Luck: number,
	SpeedBonus: number,
}

function Formulas.ToolStats(profile: Profile, toolId: string?): ToolStats
	local def = Tools.ById[toolId or profile.EquippedTool or "toothbrush"] or Tools.ById.toothbrush
	local width = def.Width * (1 + 0.08 * up(profile, "wide_head"))
	return {
		Width = width,
		Radius = width / 2,
		Reach = def.Reach + 1.2 * up(profile, "long_reach"),
		Depth = def.Depth * (1 + 0.10 * up(profile, "deep_head")),
		Magnet = def.Magnet + 2 * up(profile, "magnet_coil"),
		Surge = 0.04 * up(profile, "surge_head"),
		Luck = Formulas.LuckBonus(profile, def.Id),
		SpeedBonus = def.SpeedBonus or 0,
	}
end

function Formulas.Capacity(profile: Profile, containerId: string?, extraPct: number?): number
	local def = Containers.ById[containerId or profile.EquippedContainer or "pocket_pouch"] or Containers.ById.pocket_pouch
	local mult = 1 + 0.15 * up(profile, "dust_compactor") + 0.10 * perk(profile, "deep_pockets") + (extraPct or 0)
	return def.Capacity * mult
end

function Formulas.WalkSpeed(profile: Profile, extra: number?): number
	local t = Tools.ById[profile.EquippedTool or ""]
	local c = Containers.ById[profile.EquippedContainer or ""]
	local bonus = 0.06 * up(profile, "servo_stride") + (t and t.SpeedBonus or 0) + (c and c.SpeedBonus or 0) + (extra or 0)
	return GameConfig.BaseWalkSpeed * (1 + bonus)
end

function Formulas.JumpPower(profile: Profile): number
	return GameConfig.BaseJumpPower * (1 + 0.10 * up(profile, "lunar_leap"))
end

function Formulas.AirJumps(profile: Profile): number
	return up(profile, "thrust_assist")
end

function Formulas.ContentsKg(contents: { [string]: number }?): number
	local total = 0
	if contents then
		for _, kg in contents do
			total += kg
		end
	end
	return total
end

------------------------------------------------------------------ vehicles & capsules

export type VehicleStats = { Speed: number, Width: number, Hopper: number, Depth: number, Turbo: number, Lights: boolean }

function Formulas.VehicleStats(profile: Profile, vehicleId: string): VehicleStats
	local def = Vehicles.ById[vehicleId] or Vehicles.List[1]
	return {
		Speed = def.Speed * (1 + 0.10 * up(profile, "tuned_motors")),
		Width = def.Width * (1 + 0.08 * up(profile, "suction_control")),
		Hopper = def.Hopper * (1 + 0.20 * up(profile, "big_hopper")),
		Depth = def.Depth * (1 + 0.10 * up(profile, "deep_head")),
		Turbo = 0.15 * up(profile, "turbo_kit"),
		Lights = up(profile, "floodlights") > 0,
	}
end

function Formulas.ThrowPower(profile: Profile): number
	return 1 + 0.25 * up(profile, "throw_assist")
end

------------------------------------------------------------------ economy

function Formulas.BestDustValue(profile: Profile): number
	local best = 1
	local unlocked = profile.Zones or {}
	for _, z in Zones.List do
		if unlocked[z.Id] then
			local r = Resources.ById[z.DustResource]
			if r and r.Value > best then
				best = r.Value
			end
		end
	end
	return best
end

-- base value per kg for a resource, before sell multipliers
function Formulas.ResourceValue(resId: string, profile: Profile): number
	local def = Resources.ById[resId]
	if not def then
		return 0
	end
	local pm = Resources.ProcessedMult[resId]
	if pm then
		return pm * Formulas.BestDustValue(profile)
	end
	local em = Resources.EventMult[resId]
	if em then
		return em * Formulas.BestDustValue(profile)
	end
	return def.Value
end

function Formulas.ContentsValue(contents: { [string]: number }?, profile: Profile, marketMods: { [string]: number }?): number
	local total = 0
	if contents then
		for resId, kg in contents do
			local mod = marketMods and marketMods[resId] or 1
			total += kg * Formulas.ResourceValue(resId, profile) * mod
		end
	end
	return total
end

-- Deterministic market price swing per resource (same on every server and client):
-- each resource drifts between roughly -18% and +18% over ~95 minute cycles.
function Formulas.MarketMod(resId: string, t: number): number
	local h = 0
	for i = 1, #resId do
		h = (h * 31 + string.byte(resId, i)) % 100000
	end
	local phase = (h % 628) / 100
	return 1 + 0.18 * math.sin(t / 900 + phase)
end

function Formulas.MarketMods(contents: { [string]: number }?, t: number): { [string]: number }
	local out = {}
	if contents then
		for resId in contents do
			out[resId] = Formulas.MarketMod(resId, t)
		end
	end
	return out
end

function Formulas.UpgradeCost(upgradeId: string, currentLevel: number, profile: Profile): number
	local def = Upgrades.ById[upgradeId]
	if not def then
		return math.huge
	end
	return math.floor(def.BaseCost * def.Growth ^ currentLevel * Formulas.PriceMultiplier(profile))
end

function Formulas.ShopPrice(basePrice: number, profile: Profile): number
	return math.floor(basePrice * Formulas.PriceMultiplier(profile))
end

function Formulas.CrateCreditScale(tier: number): number
	return 3.3 ^ (tier - 1)
end

------------------------------------------------------------------ rebirth

function Formulas.RebirthRequirement(rebirths: number): (number, number)
	local R = Progression.Rebirth
	local level = math.min(R.MaxLevelReq, R.BaseLevel + R.LevelStep * rebirths)
	local credits = math.floor(R.BaseCredits * R.CreditsGrowth ^ rebirths)
	return level, credits
end

function Formulas.RebirthStars(level: number, rebirths: number): number
	return 1 + math.max(0, math.floor((level - Progression.Rebirth.BaseLevel) / 5)) + math.floor(rebirths / 2)
end

function Formulas.PerkCost(perkId: string, currentLevel: number): number
	local def = Progression.PerksById[perkId]
	if not def then
		return math.huge
	end
	return def.Cost + def.CostGrowth * currentLevel
end

------------------------------------------------------------------ robots

export type RobotStats = { Speed: number, Width: number, Capacity: number, Battery: number, Wear: number, Magnet: number }

function Formulas.RobotStats(robotId: string, level: number, profile: Profile): RobotStats
	local def = Robots.ById[robotId]
	if not def then
		return { Speed = 8, Width = 4, Capacity = 1, Battery = 60, Wear = 1, Magnet = 0 }
	end
	local lv = 1 + 0.12 * (math.max(1, level) - 1)
	local fw = 1 + 0.08 * up(profile, "robot_firmware")
	return {
		Speed = def.Speed * fw * (1 + 0.04 * (level - 1)),
		Width = def.Width * lv * fw,
		Capacity = def.Capacity * lv,
		Battery = def.Battery * (1 + 0.20 * up(profile, "battery_tech")) * (1 + 0.05 * (level - 1)),
		Wear = def.Wear * math.max(0.2, 1 - 0.15 * up(profile, "field_repair")),
		Magnet = def.Magnet * lv,
	}
end

local function robotBaseValue(robotId: string): number
	local def = Robots.ById[robotId]
	if not def then
		return 1000
	end
	if def.Price > 0 then
		return def.Price
	end
	return ({ Rare = 30000, Epic = 120000, Legendary = 600000 } :: any)[def.Rarity] or 50000
end

function Formulas.RobotUpgradeCost(robotId: string, level: number): number
	return math.floor(robotBaseValue(robotId) * 0.6 * 1.65 ^ (level - 1))
end

function Formulas.RobotRepairCost(robotId: string, level: number, durability: number): number
	return math.floor(robotBaseValue(robotId) * 0.04 * (1 + 0.25 * (level - 1)) * (100 - durability) / 100) + 1
end

function Formulas.RobotSellValue(robotId: string, level: number): number
	local spent = robotBaseValue(robotId)
	for l = 1, level - 1 do
		spent += Formulas.RobotUpgradeCost(robotId, l)
	end
	local def = Robots.ById[robotId]
	if def and def.Source ~= "shop" then
		return math.floor(spent * 0.1)
	end
	return math.floor(spent * 0.4)
end

------------------------------------------------------------------ base

function Formulas.BuildingCost(buildingId: string, profile: Profile): number
	local def = Buildings.ById[buildingId]
	if not def then
		return math.huge
	end
	return math.floor(def.Cost * Formulas.PriceMultiplier(profile))
end

function Formulas.BuildingUpgradeCost(buildingId: string, level: number, profile: Profile): number
	if buildingId == "command_center" then
		local c = Buildings.Command.UpgradeCost[level]
		return c and math.floor(c * Formulas.PriceMultiplier(profile)) or math.huge
	end
	local def = Buildings.ById[buildingId]
	if not def then
		return math.huge
	end
	return math.floor(def.Cost * 2.4 ^ level * Formulas.PriceMultiplier(profile))
end

function Formulas.MaxBuildings(ccLevel: number): number
	return Buildings.Command.MaxBuildings[math.clamp(ccLevel, 1, #Buildings.Command.MaxBuildings)]
end

-- buildings: array of {Id, Level}
function Formulas.RobotSlots(buildings: { any }, profile: Profile): number
	local slots = perk(profile, "extra_bay")
	for _, b in buildings do
		if b.Id == "command_center" then
			slots += 1
		elseif b.Id == "robot_dock" then
			slots += 2 + ((b.Level or 1) - 1)
		end
	end
	return slots
end

function Formulas.StorageCapacity(buildings: { any }): number
	local cap = 0
	for _, b in buildings do
		local def = Buildings.ById[b.Id]
		if def and def.Storage then
			local lv = b.Level or 1
			if b.Id == "command_center" then
				cap += def.Storage * lv * lv
			else
				cap += def.Storage * lv
			end
		end
	end
	return cap
end

function Formulas.BuildingPower(buildingId: string, level: number): number
	local def = Buildings.ById[buildingId]
	if not def then
		return 0
	end
	if def.Power < 0 then
		return def.Power * (1 + 0.25 * (level - 1))
	end
	return def.Power * level
end

function Formulas.ProductionScale(level: number): number
	return 1 + 0.6 * (level - 1)
end

return Formulas
