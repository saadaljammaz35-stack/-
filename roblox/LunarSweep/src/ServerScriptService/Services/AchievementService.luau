--!nonstrict
-- Achievements: granted automatically when a lifetime stat crosses a goal.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Achievements = require(Shared.Config.Achievements)
local Net = require(Shared.Net)
local Registry = require(script.Parent.Registry)

local AchievementService = {}

local byStat: { [string]: { any } } = {}
for _, a in Achievements.List do
	byStat[a.Stat] = byStat[a.Stat] or {}
	table.insert(byStat[a.Stat], a)
end

local function grant(player: Player, profile, a)
	profile.Achievements[a.Id] = os.time()
	Registry.DataService:Mark(player, "Achievements")
	if a.Gems > 0 then
		Registry.EconomyService:AddGems(player, a.Gems)
	end
	Net.Event("Reward"):FireClient(player, { Kind = "Achievement", Id = a.Id, Name = a.Name, Gems = a.Gems, Title = a.Title })
end

function AchievementService:Check(player: Player, stat: string, value: number)
	local profile = Registry.DataService:Get(player)
	local list = byStat[stat]
	if not profile or not list then
		return
	end
	for _, a in list do
		if not profile.Achievements[a.Id] and value >= a.Goal then
			grant(player, profile, a)
		end
	end
end

function AchievementService:CheckAll(player: Player, profile)
	-- derived stats
	local zones = 0
	for _, v in profile.Zones do
		if v then
			zones += 1
		end
	end
	profile.Stats.ZonesUnlocked = zones
	profile.Stats.Level = math.max(profile.Stats.Level or 0, profile.Level)
	profile.Stats.Rebirths = profile.Rebirths
	local secrets = 0
	for _ in profile.Secrets do
		secrets += 1
	end
	profile.Stats.SecretsFound = secrets
	for stat, value in profile.Stats do
		if type(value) == "number" then
			self:Check(player, stat, value)
		end
	end
end

function AchievementService:Init() end

function AchievementService:Start()
	Registry.DataService.StatChanged:Connect(function(player, stat, value)
		self:Check(player, stat, value)
	end)
	Registry.DataService.Loaded:Connect(function(player, profile)
		task.delay(3, function()
			if player.Parent then
				self:CheckAll(player, profile)
			end
		end)
	end)
end

return AchievementService
