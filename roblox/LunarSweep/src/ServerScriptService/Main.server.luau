--!nonstrict
-- Lunar Sweep server bootstrap: creates remotes, initialises and starts every service in
-- dependency order. Each service exposes :Init() (no yielding, no cross-calls) and
-- :Start() (connect events, spawn loops).

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Net = require(ReplicatedStorage.Shared.Net)
Net.InitServer()

local Services = script.Parent:WaitForChild("Services")
local Registry = require(Services.Registry)

local ORDER = {
	"Router",
	"DataService",
	"WorldService",
	"SectorService",
	"PickupService",
	"PlayerService",
	"EconomyService",
	"ZoneService",
	"CleaningService",
	"ShopService",
	"CrateService",
	"CapsuleService",
	"BaseService",
	"RobotService",
	"MissionService",
	"AchievementService",
	"LoginRewardService",
	"EventService",
	"RebirthService",
	"TradeService",
	"LeaderboardService",
	"SecretService",
	"AdminService",
	"SelfTest",
}

-- modules that are not services but are useful through the registry
Registry.HubBuilder = require(Services.HubBuilder)
Registry.WorldGrid = require(Services.WorldGrid)

for _, name in ORDER do
	local module = Services:FindFirstChild(name)
	assert(module, "missing service " .. name)
	Registry[name] = require(module)
end

for _, name in ORDER do
	local ok, err = pcall(function()
		Registry[name]:Init()
	end)
	if not ok then
		warn(string.format("[Main] %s:Init failed: %s", name, tostring(err)))
	end
end

for _, name in ORDER do
	local ok, err = pcall(function()
		Registry[name]:Start()
	end)
	if not ok then
		warn(string.format("[Main] %s:Start failed: %s", name, tostring(err)))
	end
end

Registry.DataService:LoadExisting()
print("[Lunar Sweep] server started - generating the moon...")
