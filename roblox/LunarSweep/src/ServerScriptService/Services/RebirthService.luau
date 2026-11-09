--!nonstrict
-- Re-Launch (prestige): trade your level and credits for Cosmic Stars and permanent
-- multipliers. Robots, base, gems, achievements and crate/event gear are kept.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local Tools = require(Shared.Config.Tools)
local Containers = require(Shared.Config.Containers)
local Progression = require(Shared.Config.Progression)
local Net = require(Shared.Net)
local Registry = require(script.Parent.Registry)

local RebirthService = {}

function RebirthService:Rebirth(player: Player, profile): (boolean, string?)
	local levelReq, creditReq = Formulas.RebirthRequirement(profile.Rebirths)
	if profile.Level < levelReq then
		return false, string.format("Reach level %d first.", levelReq)
	end
	if profile.Credits < creditReq then
		return false, string.format("You need %s.", Format.Credits(creditReq))
	end
	local stars = Formulas.RebirthStars(profile.Level, profile.Rebirths)
	profile.Stars += stars
	profile.Rebirths += 1
	profile.Credits = 0
	profile.Level = 1
	profile.XP = 0
	profile.Upgrades = {}
	profile.Contents = {}
	-- keep non-shop gear
	local keepTools = { toothbrush = true }
	for id, owned in profile.Tools do
		local def = Tools.ById[id]
		if owned and def and def.Source ~= "shop" then
			keepTools[id] = true
		end
	end
	local keepContainers = { pocket_pouch = true }
	for id, owned in profile.Containers do
		local def = Containers.ById[id]
		if owned and def and def.Source ~= "shop" then
			keepContainers[id] = true
		end
	end
	if (profile.Perks.head_start or 0) > 0 then
		keepTools.hand_brush = true
		keepContainers.canvas_sack = true
	end
	profile.Tools = keepTools
	profile.Containers = keepContainers
	profile.EquippedTool = keepTools.hand_brush and "hand_brush" or "toothbrush"
	profile.EquippedContainer = keepContainers.canvas_sack and "canvas_sack" or "pocket_pouch"
	-- zones
	local zones = { dusty_flats = true }
	local memory = profile.Perks.zone_memory or 0
	if memory >= 1 then
		zones.pockmark_craters = true
		zones.junkyard_expanse = true
	end
	if memory >= 2 then
		zones.crystal_caverns = true
		zones.frostbite_basin = true
	end
	profile.Zones = zones
	for _, r in profile.Robots do
		if not zones[r.Zone] then
			r.Zone = "dusty_flats"
		end
	end
	for _, key in { "Stars", "Rebirths", "Credits", "Level", "XP", "Upgrades", "Contents", "Tools", "Containers", "EquippedTool", "EquippedContainer", "Zones", "Robots" } do
		Registry.DataService:Mark(player, key)
	end
	Registry.DataService:MaxStat(player, "Rebirths", profile.Rebirths)
	Registry.PlayerService:RefreshAll(player)
	Registry.PlayerService:UpdateFill(player)
	if player.Character then
		local hrp = player.Character:FindFirstChild("HumanoidRootPart")
		if hrp then
			Registry.ZoneService:TeleportPlayer(player, Registry.WorldService.HubSpawn)
		end
	end
	Net.Event("Reward"):FireClient(player, { Kind = "Rebirth", Stars = stars, Rebirths = profile.Rebirths })
	return true, string.format("Re-launched! +%d Cosmic Stars. Permanent bonus: +%d%% credits.", stars, math.floor(profile.Rebirths * Progression.Rebirth.CreditsMultPer * 100))
end

function RebirthService:BuyPerk(player: Player, profile, perkId: string): (boolean, string?)
	local def = Progression.PerksById[perkId]
	if not def then
		return false, "Unknown perk."
	end
	local lv = profile.Perks[perkId] or 0
	if lv >= def.MaxLevel then
		return false, "Maxed."
	end
	local cost = Formulas.PerkCost(perkId, lv)
	if profile.Stars < cost then
		return false, "Not enough Cosmic Stars."
	end
	profile.Stars -= cost
	profile.Perks[perkId] = lv + 1
	Registry.DataService:Mark(player, "Stars")
	Registry.DataService:Mark(player, "Perks")
	Registry.PlayerService:UpdateFill(player)
	if perkId == "extra_bay" then
		-- new slot: nothing to clamp
	end
	return true, string.format("%s level %d", def.Name, lv + 1)
end

function RebirthService:Init() end

function RebirthService:Start()
	Registry.Router.Register("Rebirth", function(player, profile)
		return self:Rebirth(player, profile)
	end, 1, 1)
	Registry.Router.Register("BuyPerk", function(player, profile, payload)
		if type(payload.Id) ~= "string" then
			return false, "Bad perk"
		end
		return self:BuyPerk(player, profile, payload.Id)
	end, 2, 4)
end

return RebirthService
