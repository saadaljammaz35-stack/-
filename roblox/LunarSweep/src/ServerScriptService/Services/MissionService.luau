--!nonstrict
-- Daily (3) and weekly (3) missions, generated deterministically per player per period,
-- scaled to the player's progression tier, progressed by DataService.Progress events.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local Missions = require(Shared.Config.Missions)
local Net = require(Shared.Net)
local Registry = require(script.Parent.Registry)

local MissionService = {}

local function dayKey(): number
	return os.time() // 86400
end

local function weekKey(): number
	-- weeks start on Monday (epoch was a Thursday)
	return (os.time() - 4 * 86400) // 604800
end

function MissionService:SecondsUntilReset(): (number, number)
	local now = os.time()
	local daily = 86400 - (now % 86400)
	local weekly = 604800 - ((now - 4 * 86400) % 604800)
	return daily, weekly
end

local function generate(pool, count: number, seed: number, tier: number)
	local rng = Random.new(seed)
	local indices = {}
	for i = 1, #pool do
		indices[i] = i
	end
	for i = #indices, 2, -1 do
		local j = rng:NextInteger(1, i)
		indices[i], indices[j] = indices[j], indices[i]
	end
	local out = {}
	for k = 1, math.min(count, #pool) do
		local def = pool[indices[k]]
		local target = def.Base * Formulas.TierScale(def.Scale, tier)
		if def.Scale == "kg" then
			target = math.ceil(target * 10) / 10
		else
			target = math.ceil(target)
		end
		table.insert(out, { Id = def.Id, Target = target, Progress = 0, Claimed = false, Tier = tier })
	end
	return out
end

function MissionService:Refresh(player: Player, profile)
	local changed = false
	local tier = Formulas.Tier(profile)
	local dk, wk = dayKey(), weekKey()
	if profile.Missions.DailyKey ~= dk then
		profile.Missions.DailyKey = dk
		profile.Missions.Daily = generate(Missions.Daily, Missions.DailyCount, player.UserId * 7 + dk, tier)
		changed = true
	end
	if profile.Missions.WeeklyKey ~= wk then
		profile.Missions.WeeklyKey = wk
		profile.Missions.Weekly = generate(Missions.Weekly, Missions.WeeklyCount, player.UserId * 13 + wk * 3, tier)
		changed = true
	end
	if changed then
		Registry.DataService:Mark(player, "Missions")
	end
end

local function onProgress(player: Player, key: string, amount: number)
	local profile = Registry.DataService:Get(player)
	if not profile then
		return
	end
	local changed = false
	for _, list in { profile.Missions.Daily, profile.Missions.Weekly } do
		for _, m in list do
			local def = Missions.ById[m.Id]
			if def and def.Key == key and not m.Claimed and m.Progress < m.Target then
				local before = m.Progress
				m.Progress = math.min(m.Target, m.Progress + amount)
				changed = true
				if before < m.Target and m.Progress >= m.Target then
					Net.Event("Notify"):FireClient(player, { Text = "Mission complete: " .. string.format(def.Text, Format.Number(m.Target)) .. " - claim your reward!", Kind = "Good", Icon = "✅" })
				end
			end
		end
	end
	if changed then
		Registry.DataService:Mark(player, "Missions")
	end
end

function MissionService:Claim(player: Player, profile, id: string): (boolean, string?)
	self:Refresh(player, profile)
	for _, list in { profile.Missions.Daily, profile.Missions.Weekly } do
		for _, m in list do
			if m.Id == id then
				if m.Claimed then
					return false, "Already claimed."
				end
				if m.Progress < m.Target then
					return false, "Mission not complete yet."
				end
				local def = Missions.ById[id]
				m.Claimed = true
				local credits = math.floor(def.RewardCredits * Formulas.TierScale("credits", m.Tier or 1))
				Registry.EconomyService:AddCredits(player, credits, true)
				Registry.EconomyService:AddGems(player, def.RewardGems)
				Registry.EconomyService:AddXP(player, def.RewardXp * profile.Level)
				Registry.DataService:Mark(player, "Missions")
				Registry.DataService:AddStat(player, "MissionsDone", 1)
				return true, string.format("Reward: %s + %d Gems", Format.Credits(credits), def.RewardGems)
			end
		end
	end
	return false, "Mission not found."
end

function MissionService:Init() end

function MissionService:Start()
	Registry.DataService.Loaded:Connect(function(player, profile)
		self:Refresh(player, profile)
	end)
	Registry.DataService.Progress:Connect(onProgress)
	Registry.Router.Register("ClaimMission", function(player, profile, payload)
		if type(payload.Id) ~= "string" then
			return false, "Bad mission"
		end
		return self:Claim(player, profile, payload.Id)
	end, 3, 6)
	Registry.Router.Register("GetMissionTimers", function()
		local d, w = self:SecondsUntilReset()
		return true, nil, { Daily = d, Weekly = w }
	end, 2, 4)
	-- play-time progress + period rollover
	task.spawn(function()
		while true do
			task.wait(60)
			for _, player in Players:GetPlayers() do
				local profile = Registry.DataService:Get(player)
				if profile then
					self:Refresh(player, profile)
					profile.PlaySeconds += 60
					Registry.DataService:AddStat(player, "PlayMinutes", 1)
				end
			end
		end
	end)
end

return MissionService
