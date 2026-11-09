--!nonstrict
-- Lunar Sweep client bootstrap: builds the shared context, initialises controllers and the
-- UI, waits for the world + profile, then shows the main menu.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local StarterGui = game:GetService("StarterGui")
local Workspace = game:GetService("Workspace")

local player = Players.LocalPlayer
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Net = require(Shared.Net)
local Progression = require(Shared.Config.Progression)

local Controllers = script.Parent:WaitForChild("Controllers")
local UIFolder = script.Parent:WaitForChild("UI")

-- hide the default backpack hotbar: we have our own tool slot
task.spawn(function()
	for _ = 1, 20 do
		local ok = pcall(function()
			StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false)
		end)
		if ok then
			break
		end
		task.wait(0.5)
	end
end)

local ClientData = require(Controllers.ClientData)
local SoundController = require(Controllers.SoundController)
local SkyController = require(Controllers.SkyController)
local FXController = require(Controllers.FXController)
local SweepController = require(Controllers.SweepController)
local ZoneController = require(Controllers.ZoneController)
local CameraController = require(Controllers.CameraController)
local MovementController = require(Controllers.MovementController)
local PromptController = require(Controllers.PromptController)
local SectorController = require(Controllers.SectorController)
local BuildController = require(Controllers.BuildController)
local RobotVisualController = require(Controllers.RobotVisualController)

local UIController = require(UIFolder.UIController)
local HUD = require(UIFolder.HUD)
local MainMenu = require(UIFolder.MainMenu)
local Lib = require(UIFolder.Lib)
local Theme = require(UIFolder.Theme)

local ctx = {
	Data = ClientData,
	Sound = SoundController,
	FX = FXController,
	Sweep = SweepController,
	Zone = ZoneController,
	Camera = CameraController,
	Build = BuildController,
	UI = UIController,
	Lib = Lib,
	Theme = Theme,
	Net = Net,
	Root = nil,
	HUD = nil,
	Menu = nil,
}

function ctx.Season()
	local ev = ClientData.ServerEvent
	return ev and ev.Season and Progression.EventsById[ev.Season] or nil
end

local function safe(name: string, fn: () -> ())
	local ok, err = xpcall(fn, debug.traceback)
	if not ok then
		warn(string.format("[Client] %s failed: %s", name, tostring(err)))
	end
end

-- init order: data first so everything can subscribe
safe("ClientData.Init", function()
	ClientData:Init()
end)
safe("UIController.Init", function()
	UIController:Init(ctx)
end)
for name, c in {
	SoundController = SoundController,
	SkyController = SkyController,
	FXController = FXController,
	SweepController = SweepController,
	ZoneController = ZoneController,
	CameraController = CameraController,
	MovementController = MovementController,
	PromptController = PromptController,
	SectorController = SectorController,
	BuildController = BuildController,
	RobotVisualController = RobotVisualController,
} do
	safe(name .. ".Init", function()
		c:Init(ctx)
	end)
end

-- wait for the server profile before building data-driven UI
if not ClientData.Loaded then
	ClientData.LoadedSignal:Wait()
end

safe("HUD", function()
	ctx.HUD = HUD.new(ctx)
end)

local PANELS = {
	"Shop",
	"Inventory",
	"Upgrades",
	"Robots",
	"Base",
	"Missions",
	"Achievements",
	"Daily",
	"Leaderboards",
	"Map",
	"Settings",
	"Trade",
	"Rebirth",
	"Event",
	"Crates",
	"Customize",
	"Admin",
}
for _, name in PANELS do
	local module = UIFolder.Panels:FindFirstChild(name)
	if module then
		UIController:Register(name, require(module))
	end
end

for name, c in {
	ClientData = ClientData,
	FXController = FXController,
	SweepController = SweepController,
	ZoneController = ZoneController,
	MovementController = MovementController,
	PromptController = PromptController,
	SectorController = SectorController,
	BuildController = BuildController,
	RobotVisualController = RobotVisualController,
} do
	if c.Start then
		safe(name .. ".Start", function()
			c:Start()
		end)
	end
end

-- world must be generated before playing
while not Workspace:GetAttribute("WorldReady") do
	task.wait(0.25)
end
player:SetAttribute("ClientReady", true)

ctx.Menu = MainMenu.new(ctx, function()
	ctx.HUD:Show(true)
	ctx.HUD:SetZone(ZoneController.Current)
	SoundController:SetMusic("music_hub")
	-- greet with the daily reward if available
	local p = ClientData.Profile
	if p and p.Login.Pending then
		task.delay(1.5, function()
			UIController:Open("Daily")
		end)
	end
end)
ctx.Menu:Show()
