--!nonstrict
-- Crate openings: weighted random rewards (odds are public in the UI), pity counter,
-- duplicate protection (dupes become gems).

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local Crates = require(Shared.Config.Crates)
local Tools = require(Shared.Config.Tools)
local Containers = require(Shared.Config.Containers)
local Robots = require(Shared.Config.Robots)
local Rarity = require(Shared.Config.Rarity)
local Progression = require(Shared.Config.Progression)
local Net = require(Shared.Net)
local Registry = require(script.Parent.Registry)

local CrateService = {}

local rng = Random.new()

function CrateService:Price(crate, profile): number
	if crate.ScalePrice then
		return math.floor(crate.Price * Formulas.CrateCreditScale(Formulas.Tier(profile)))
	end
	return crate.Price
end

local function rewardRarity(reward): string
	if reward.Type == "Tool" then
		local d = Tools.ById[reward.Id]
		return d and d.Rarity or "Common"
	elseif reward.Type == "Container" then
		local d = Containers.ById[reward.Id]
		return d and d.Rarity or "Common"
	elseif reward.Type == "Robot" then
		local d = Robots.ById[reward.Id]
		return d and d.Rarity or "Common"
	elseif reward.Type == "EventTool" or reward.Type == "EventContainer" then
		return "Epic"
	end
	return "Common"
end
CrateService.RewardRarity = rewardRarity

local function roll(crate, profile)
	local pool = crate.Pool
	local luck = 0.05 * (profile.Perks.lucky_star or 0)
	local pity = profile.Crates.Pity[crate.Id] or 0
	-- pity: force a top-tier item
	if crate.PityEvery and pity + 1 >= crate.PityEvery then
		local top = {}
		for _, r in pool do
			for _, rar in crate.PityRarities do
				if rewardRarity(r) == rar then
					table.insert(top, r)
				end
			end
		end
		if #top > 0 then
			local total = 0
			for _, r in top do
				total += r.Weight
			end
			local x = rng:NextNumber() * total
			for _, r in top do
				x -= r.Weight
				if x <= 0 then
					return r, true
				end
			end
			return top[#top], true
		end
	end
	local total = 0
	local weights = {}
	for i, r in pool do
		local w = r.Weight
		if Rarity.Get(rewardRarity(r)).Order >= 4 then
			w *= 1 + luck
		end
		weights[i] = w
		total += w
	end
	local x = rng:NextNumber() * total
	for i, r in pool do
		x -= weights[i]
		if x <= 0 then
			return r, false
		end
	end
	return pool[#pool], false
end

-- Grants a reward table, returns a description for the UI
function CrateService:Grant(player: Player, profile, reward): any
	local ds = Registry.DataService
	local econ = Registry.EconomyService
	local out = { Type = reward.Type, Id = reward.Id, Amount = reward.Amount, Rarity = rewardRarity(reward) }
	if reward.Type == "Credits" then
		local amount = math.floor((reward.Amount or 0) * Formulas.CrateCreditScale(Formulas.Tier(profile)))
		econ:AddCredits(player, amount, true)
		out.Amount = amount
		out.Label = Format.Credits(amount)
	elseif reward.Type == "Gems" then
		econ:AddGems(player, reward.Amount or 0)
		out.Label = tostring(reward.Amount) .. " Gems"
	elseif reward.Type == "Boost" then
		econ:AddBoost(player, reward.Id, reward.Minutes or 10)
		local b = Crates.Boosts[reward.Id]
		out.Label = string.format("%s (%dm)", b and b.Name or reward.Id, reward.Minutes or 10)
	elseif reward.Type == "Tool" or reward.Type == "EventTool" then
		local id = reward.Id
		if reward.Type == "EventTool" then
			local season = Registry.EventService:Season()
			for _, item in season and season.Shop or {} do
				if item.Type == "Tool" then
					id = item.Id
				end
			end
			id = id or "comet_mop"
			out.Id = id
		end
		local def = Tools.ById[id]
		if profile.Tools[id] then
			local gems = Rarity.Get(def.Rarity).DupeGems
			econ:AddGems(player, gems)
			out.Dupe = true
			out.Label = string.format("%s (duplicate → %d Gems)", def.Name, gems)
		else
			profile.Tools[id] = true
			ds:Mark(player, "Tools")
			out.Label = def.Name
		end
		out.Rarity = def.Rarity
	elseif reward.Type == "Container" or reward.Type == "EventContainer" then
		local id = reward.Id
		if reward.Type == "EventContainer" then
			local season = Registry.EventService:Season()
			id = nil
			for _, item in season and season.Shop or {} do
				if item.Type == "Container" then
					id = item.Id
				end
			end
			id = id or "star_satchel"
			out.Id = id
		end
		local def = Containers.ById[id]
		if profile.Containers[id] then
			local gems = Rarity.Get(def.Rarity).DupeGems
			econ:AddGems(player, gems)
			out.Dupe = true
			out.Label = string.format("%s (duplicate → %d Gems)", def.Name, gems)
		else
			profile.Containers[id] = true
			ds:Mark(player, "Containers")
			out.Label = def.Name
		end
		out.Rarity = def.Rarity
	elseif reward.Type == "Robot" then
		local ok = Registry.RobotService:GiveRobot(player, reward.Id)
		local def = Robots.ById[reward.Id]
		out.Label = def and def.Name or reward.Id
		if not ok then
			local gems = Rarity.Get(def.Rarity).DupeGems
			econ:AddGems(player, gems)
			out.Label ..= string.format(" (no free slot → %d Gems)", gems)
		end
	elseif reward.Type == "Crate" then
		out.Label = (Crates.ById[reward.Id] and Crates.ById[reward.Id].Name or "Crate")
		profile.Crates.Free = profile.Crates.Free or {}
		profile.Crates.Free[reward.Id] = (profile.Crates.Free[reward.Id] or 0) + 1
		ds:Mark(player, "Crates")
	end
	return out
end

function CrateService:Open(player: Player, profile, crateId: string, free: boolean?): (boolean, string?, any?)
	local crate = Crates.ById[crateId]
	if not crate then
		return false, "Unknown crate."
	end
	local season = Registry.EventService:Season()
	if crate.Currency == "EventTokens" and not season then
		return false, "No event is running right now."
	end
	local freeCount = profile.Crates.Free and profile.Crates.Free[crateId] or 0
	if free and freeCount > 0 then
		profile.Crates.Free[crateId] = freeCount - 1
		Registry.DataService:Mark(player, "Crates")
	else
		local price = self:Price(crate, profile)
		local paid = false
		if crate.Currency == "Credits" then
			paid = Registry.EconomyService:Spend(player, price)
		elseif crate.Currency == "Gems" then
			paid = Registry.EconomyService:SpendGems(player, price)
		elseif crate.Currency == "EventTokens" then
			paid = Registry.EventService:SpendTokens(player, profile, price)
		end
		if not paid then
			return false, "You can't afford this crate."
		end
	end
	local reward, pityHit = roll(crate, profile)
	if crate.PityEvery then
		local rar = Rarity.Get(rewardRarity(reward)).Order
		if pityHit or rar >= 5 then
			profile.Crates.Pity[crateId] = 0
		else
			profile.Crates.Pity[crateId] = (profile.Crates.Pity[crateId] or 0) + 1
		end
		Registry.DataService:Mark(player, "Crates")
	end
	local result = self:Grant(player, profile, reward)
	result.Crate = crateId
	result.Pity = pityHit
	Registry.DataService:AddStat(player, "CratesOpened", 1)
	Net.Event("Reward"):FireClient(player, { Kind = "Crate", Result = result })
	return true, nil, result
end

function CrateService:Init() end

function CrateService:Start()
	Registry.Router.Register("OpenCrate", function(player, profile, payload)
		if type(payload.Id) ~= "string" then
			return false, "Bad crate"
		end
		return self:Open(player, profile, payload.Id, payload.Free == true)
	end, 1, 3)
	local _ = Progression
end

return CrateService
