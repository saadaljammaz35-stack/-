--!nonstrict
-- Admin / tester commands (Admin panel in the UI). Allowed for: Studio sessions, the place
-- owner, and user ids listed in ServerScriptService attribute "AdminUserIds" (comma list).

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ServerScriptService = game:GetService("ServerScriptService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Zones = require(Shared.Config.Zones)
local Upgrades = require(Shared.Config.Upgrades)
local Tools = require(Shared.Config.Tools)
local Containers = require(Shared.Config.Containers)
local Registry = require(script.Parent.Registry)

local AdminService = {}

function AdminService:IsAdmin(player: Player): boolean
	if RunService:IsStudio() then
		return true
	end
	if game.CreatorType == Enum.CreatorType.User and player.UserId == game.CreatorId then
		return true
	end
	local list = ServerScriptService:GetAttribute("AdminUserIds")
	if type(list) == "string" then
		for id in string.gmatch(list, "%d+") do
			if tonumber(id) == player.UserId then
				return true
			end
		end
	end
	return false
end

local COMMANDS = {}

COMMANDS.credits = function(player, profile, arg)
	Registry.EconomyService:AddCredits(player, tonumber(arg) or 1e6, false)
	return "Credits added"
end
COMMANDS.gems = function(player, profile, arg)
	Registry.EconomyService:AddGems(player, tonumber(arg) or 500)
	return "Gems added"
end
COMMANDS.stars = function(player, profile, arg)
	profile.Stars += tonumber(arg) or 10
	Registry.DataService:Mark(player, "Stars")
	return "Stars added"
end
COMMANDS.level = function(player, profile, arg)
	profile.Level = math.clamp(tonumber(arg) or 50, 1, 100)
	profile.XP = 0
	Registry.DataService:Mark(player, "Level")
	Registry.DataService:Mark(player, "XP")
	Registry.DataService:MaxStat(player, "Level", profile.Level)
	return "Level set"
end
COMMANDS.zones = function(player, profile)
	for _, z in Zones.List do
		profile.Zones[z.Id] = true
	end
	Registry.DataService:Mark(player, "Zones")
	return "All zones unlocked"
end
COMMANDS.upgrades = function(player, profile)
	for _, u in Upgrades.List do
		profile.Upgrades[u.Id] = u.MaxLevel
	end
	Registry.DataService:Mark(player, "Upgrades")
	Registry.PlayerService:ApplyMovement(player)
	return "All upgrades maxed"
end
COMMANDS.gear = function(player, profile)
	for _, t in Tools.List do
		profile.Tools[t.Id] = true
	end
	for _, c in Containers.List do
		profile.Containers[c.Id] = true
	end
	Registry.DataService:Mark(player, "Tools")
	Registry.DataService:Mark(player, "Containers")
	return "All gear unlocked"
end
COMMANDS.event = function(player, profile, arg)
	local kind = arg ~= "" and arg or "MeteorShower"
	local ok = Registry.EventService:Trigger(kind, Registry.ZoneService:ZoneOf(player))
	return ok and ("Triggered " .. kind) or "Unknown event (MeteorShower, DustStorm, SolarFlare, DebrisFrenzy)"
end
COMMANDS.season = function(player, profile, arg)
	Registry.EventService:ForceSeason(arg ~= "" and arg or nil)
	return "Season forced: " .. (arg ~= "" and arg or "auto")
end
COMMANDS.tokens = function(player, profile, arg)
	local season = Registry.EventService:Season()
	if not season then
		return "No season active (use 'season harvest_moon')"
	end
	profile.EventTokens[season.Id] = (profile.EventTokens[season.Id] or 0) + (tonumber(arg) or 500)
	Registry.DataService:Mark(player, "EventTokens")
	return "Tokens added"
end
COMMANDS.regrow = function(player, profile)
	for _, s in Registry.SectorService.Sectors do
		if s.Dirty < s.Total then
			Registry.SectorService:Regrow(s)
		end
	end
	return "All sectors regrown"
end
COMMANDS.reset = function(player)
	Registry.DataService:Reset(player)
	Registry.PlayerService:RefreshAll(player)
	return "Profile reset"
end
COMMANDS.selftest = function(player)
	local report = Registry.SelfTest:Run(player)
	return report
end
COMMANDS.robot = function(player, profile, arg)
	local ok = Registry.RobotService:GiveRobot(player, arg ~= "" and arg or "dustbot_mk1")
	return ok and "Robot given" or "Failed (unknown id or hangar full)"
end
COMMANDS.fill = function(player, profile)
	local zone = Registry.ZoneService:ZoneOf(player)
	local z = Zones.ById[zone or ""] or Zones.ById.dusty_flats
	profile.Contents[z.DustResource] = (profile.Contents[z.DustResource] or 0) + 25
	Registry.DataService:Mark(player, "Contents")
	Registry.PlayerService:UpdateFill(player)
	return "Container filled with 25 kg"
end

function AdminService:Init() end

function AdminService:Start()
	Registry.Router.Register("Admin", function(player, profile, payload)
		if not self:IsAdmin(player) then
			return false, "Not an admin."
		end
		local cmd = type(payload.Cmd) == "string" and string.lower(payload.Cmd) or ""
		local arg = type(payload.Arg) == "string" and payload.Arg or ""
		local fn = COMMANDS[cmd]
		if not fn then
			local names = {}
			for k in COMMANDS do
				table.insert(names, k)
			end
			table.sort(names)
			return false, "Commands: " .. table.concat(names, ", ")
		end
		return true, fn(player, profile, arg)
	end, 3, 6)
	Players.PlayerAdded:Connect(function(player)
		player:SetAttribute("IsAdmin", self:IsAdmin(player))
	end)
	for _, p in Players:GetPlayers() do
		p:SetAttribute("IsAdmin", self:IsAdmin(p))
	end
end

return AdminService
