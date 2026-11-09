--!nonstrict
-- Headless client/UI test: runs the real client scripts against simulated server messages,
-- builds the HUD, main menu and all 17 panels, opens every panel, then "clicks" every button
-- in every panel and feeds every kind of server event to the UI. Any runtime error in the
-- UI code is counted as a failure.
--   lune run tests/client_smoke.luau

local process = require("@lune/process")
local task = require("@lune/task")
local roblox = require("@lune/roblox")

local H = require("./harness")
local Vector3 = roblox.Vector3
local Instance = roblox.Instance

local t0 = os.clock()
local game = H.Load("build/LunarSweep.rbxl")
H.InstallClientPolyfills()
local RS = game:GetService("ReplicatedStorage")
local WS = game:GetService("Workspace")
local Players = game:GetService("Players")
local Shared = RS:FindFirstChild("Shared")

-- remotes exist on a real client (created by the server)
H.Require(Shared.Net).InitServer()
H.Mode = "client"

-- replicated world folders
for _, n in { "Robots", "Pickups", "Bases", "Capsules", "Relics", "Decor", "FX" } do
	local f = Instance.new("Folder")
	f.Name = n
	f.Parent = WS
end
local hub = Instance.new("Folder")
hub.Name = "Hub"
hub.Parent = WS
local barriers = Instance.new("Folder")
barriers.Name = "Barriers"
barriers.Parent = hub
local wall = Instance.new("Part")
wall.Name = "Barrier"
wall:SetAttribute("ZoneA", "hub")
wall:SetAttribute("ZoneB", "dusty_flats")
wall.Parent = barriers

-- local player, camera, input
local me = Instance.new("Player")
me.Name = "Tester"
me.UserId = 777
me.DisplayName = "Tester"
local pg = Instance.new("PlayerGui")
pg.Parent = me
local bp = Instance.new("Backpack")
bp.Parent = me
me.Parent = Players
table.insert(H.PlayerObjects, me)
Players.LocalPlayer = me
me:SetAttribute("Plot", 1)
me:SetAttribute("IsAdmin", true)
local cam = Instance.new("Camera")
cam.ViewportSize = roblox.Vector2.new(1280, 720)
cam.Parent = WS
WS.CurrentCamera = cam
local UIS = game:GetService("UserInputService")
pcall(function()
	UIS.TouchEnabled = false
	UIS.KeyboardEnabled = true
	UIS.MouseEnabled = true
end)
WS:SetAttribute("WorldReady", true)

-- fake server replies
H.ClientInvoke = function(action, payload)
	if action == "GetMissionTimers" then
		return { Ok = true, Data = { Daily = 3600, Weekly = 86400 } }
	elseif action == "GetLeaderboards" then
		local rows = { { UserId = 1, Name = "A", Value = 100 }, { UserId = 777, Name = "Tester", Value = 50 } }
		return { Ok = true, Data = { Global = { Kg = rows, Earned = rows, Sectors = rows, Rebirths = rows }, Server = { Kg = rows, Earned = rows, Sectors = rows, Rebirths = rows } } }
	elseif action == "OpenCrate" then
		return { Ok = true, Data = { Type = "Tool", Id = "comet_mop", Label = "Comet Mop", Rarity = "Rare" } }
	end
	return { Ok = true, Msg = "ok: " .. tostring(action) }
end

local function remote(name)
	return RS.Remotes:FindFirstChild(name)
end
local function toClient(name, ...)
	H.SignalFor(remote(name), "OnClientEvent"):Fire(...)
end

-- run the client bootstrap (yields until data arrives)
local clientScript = game:GetService("StarterPlayer").StarterPlayerScripts:FindFirstChild("Client")
local bootError = nil
task.spawn(function()
	local ok, err = pcall(H.RunScript, clientScript)
	if not ok then
		bootError = err
	end
end)
task.wait(0.2)

-- profile from the real template, enriched to exercise UI paths
local DataService = H.Require(game:GetService("ServerScriptService").Services.DataService)
local TableUtil = H.Require(Shared.Util.TableUtil)
local profile = TableUtil.DeepCopy(DataService.Template)
profile.Credits = 2.5e6
profile.Gems = 400
profile.Stars = 3
profile.Level = 42
profile.XP = 120
profile.Rebirths = 1
profile.Zones = { dusty_flats = true, pockmark_craters = true, junkyard_expanse = true }
profile.Tools.lucky_whisk = true
profile.Tools.household_broom = true
profile.Containers.dust_bag = true
profile.Upgrades = { wide_head = 2, uplink_deposit = 1 }
profile.Contents = { grey_dust = 0.3, moon_glass = 0.1 }
profile.Robots = {
	{ Uid = 1, Id = "dustbot_mk1", Level = 2, Durability = 70, Battery = 60, Zone = "dusty_flats", Active = true, Kg = 0 },
	{ Uid = 2, Id = "buddy_bot", Level = 1, Durability = 100, Battery = 100, Zone = "dusty_flats", Active = false, Kg = 0 },
}
profile.Base.Buildings = {
	{ Uid = 1, Id = "command_center", X = 10, Z = 10, R = 0, Level = 1 },
	{ Uid = 2, Id = "dust_silo", X = 14, Z = 10, R = 0, Level = 1 },
}
profile.Base.Silo = { drilled_dust = 3 }
profile.Missions.Daily = { { Id = "d_clean", Target = 600, Progress = 600, Claimed = false, Tier = 1 }, { Id = "d_kg", Target = 6, Progress = 2, Claimed = false, Tier = 1 } }
profile.Missions.Weekly = { { Id = "w_kg", Target = 120, Progress = 10, Claimed = false, Tier = 1 } }
profile.Achievements = { cellscleaned_1 = 1 }
profile.Stats = { CellsCleaned = 600, KgCollected = 12, Level = 42 }
profile.Login = { LastDay = 1, Streak = 3, Pending = true, DayIndex = 3 }
profile.EventTokens = { harvest_moon = 500 }
profile.Crates = { Pity = { cosmic_crate = 4 }, Free = { supply_crate = 1 } }
profile.Boosts = { xp2x = os.time() + 300 }

H.Test("Client boots and receives the profile", function()
	toClient("DataSync", profile, { UsingMemory = true })
	toClient("ServerEvent", { Season = "harvest_moon", Active = { Kind = "MeteorShower", Zone = "dusty_flats", EndsAt = os.time() + 60, Name = "Meteor Shower" }, Goal = { Progress = 100, Target = 3000, BoostEndsAt = 0, Completed = 0 }, ServerTime = os.time() })
	toClient("SectorSnapshot", { { 1, 0, -6, 101, 300, 250, 4 }, { 1, 1, -6, 102, 280, 1000, 5 } })
	local start = os.clock()
	while not me:GetAttribute("ClientReady") and os.clock() - start < 10 do
		task.wait(0.1)
	end
	return me:GetAttribute("ClientReady") == true and bootError == nil, bootError
end)

local UIController = H.Require(game:GetService("StarterPlayer").StarterPlayerScripts.UI.UIController)
local PANELS = { "Shop", "Inventory", "Upgrades", "Robots", "Base", "Missions", "Achievements", "Daily", "Leaderboards", "Map", "Settings", "Trade", "Rebirth", "Event", "Crates", "Customize", "Admin" }

H.Test("All 17 panels registered", function()
	local missing = {}
	for _, name in PANELS do
		if not UIController.Panels[name] then
			table.insert(missing, name)
		end
	end
	return #missing == 0, #missing > 0 and table.concat(missing, ",") or nil
end)

H.Test("HUD and main menu built", function()
	local root = pg:FindFirstChild("LunarSweepUI")
	return root ~= nil and root:FindFirstChild("HUD") ~= nil and root:FindFirstChild("MainMenu") ~= nil
end)

local warnBefore = H.Warnings
for _, name in PANELS do
	H.Test("Open panel " .. name, function()
		local w = H.Warnings
		UIController:Open(name)
		task.wait(0.05)
		local panel = UIController.Panels[name]
		local visible = panel and panel.Window.Frame.Visible
		UIController:Close()
		return visible == true and H.Warnings == w, H.Warnings ~= w and "warnings during open" or nil
	end)
end

-- click every button in every panel (fuzz)
local function clickAll(root)
	local clicked = 0
	for _, d in root:GetDescendants() do
		if d:IsA("GuiButton") and d.Parent then
			local ok = pcall(function()
				H.SignalFor(d, "MouseEnter"):Fire()
				H.SignalFor(d, "MouseButton1Down"):Fire()
				H.SignalFor(d, "Activated"):Fire()
				H.SignalFor(d, "MouseLeave"):Fire()
			end)
			if ok then
				clicked += 1
			end
		end
	end
	return clicked
end

for _, name in PANELS do
	H.Test("Click every button in " .. name, function()
		local errs = H.Errors
		UIController:Open(name)
		task.wait(0.05)
		local panel = UIController.Panels[name]
		local n = clickAll(panel.Window.Frame)
		task.wait(0.3)
		-- second pass after tabs switched content
		n += clickAll(panel.Window.Frame)
		task.wait(0.2)
		UIController:Close()
		-- close any confirm dialogs that popped up
		for _, c in pg.LunarSweepUI:GetChildren() do
			if c:IsA("TextButton") and c.ZIndex == 50 then
				c:Destroy()
			end
		end
		return H.Errors == errs, string.format("%d clicks", n)
	end)
end

H.Test("HUD buttons work", function()
	local errs = H.Errors
	local hud = pg.LunarSweepUI.HUD
	local n = 0
	for _, d in hud:GetDescendants() do
		if d:IsA("GuiButton") then
			H.SignalFor(d, "Activated"):Fire()
			n += 1
			UIController:Close()
		end
	end
	return H.Errors == errs, n .. " HUD buttons"
end)

H.Test("Server messages render (rewards, toasts, deltas, base status, trade)", function()
	local errs = H.Errors
	for _, r in {
		{ Kind = "LevelUp", Level = 43, Gems = 5 },
		{ Kind = "Crate", Result = { Type = "Tool", Id = "aurora_broom", Label = "Aurora Broom", Rarity = "Epic" } },
		{ Kind = "Sector", Number = 101, Zone = "Dusty Flats", Credits = 120, Gems = 1, Share = 0.4 },
		{ Kind = "Achievement", Name = "Dust Bunny", Gems = 3, Title = nil },
		{ Kind = "Secret", Name = "Founder's Plaque", Gems = 5, Credits = 500, Count = 1 },
		{ Kind = "Zone", Zone = "junkyard_expanse", Name = "Junkyard Expanse" },
		{ Kind = "Rebirth", Stars = 2, Rebirths = 2 },
		{ Kind = "Login", Day = 3, Label = "2x XP" },
		{ Kind = "Deposit", Credits = 55, Kg = 3 },
		{ Kind = "Capsule", Kg = 5, Auto = true },
	} do
		toClient("Reward", r)
	end
	toClient("Notify", { Text = "Hello", Kind = "Good", Icon = "✓" })
	toClient("DataDelta", { Credits = 3e6, Contents = { grey_dust = 0.5 }, Missions = profile.Missions })
	toClient("SectorUpdate", { ["1"] = 600, [2] = 1000 })
	toClient("BaseStatus", { Plot = 1, Origin = Vector3.new(20, 0, -216), PowerGen = 10, PowerUse = 6, Silo = { drilled_dust = 2 }, SiloCap = 210, Status = { [1] = "Working", ["2"] = "Idle" } })
	toClient("TradeUpdate", { Kind = "Invite", From = 5, FromName = "Bob" })
	toClient("TradeUpdate", { Kind = "Session", Partner = 5, PartnerName = "Bob", Mine = { Tools = {}, Containers = {}, Gems = 0 }, Theirs = { Tools = { "comet_mop" }, Containers = {}, Gems = 3 }, MyReady = true, TheirReady = true, ConfirmAt = os.clock() + 2, ServerClock = os.clock() })
	task.wait(0.2)
	toClient("TradeUpdate", { Kind = "Closed", Reason = "Done" })
	local cleanFX = RS.Remotes:FindFirstChild("CleanFX")
	H.SignalFor(cleanFX, "OnClientEvent"):Fire({ Kg = 0.2, Cells = 5, Picks = { { "moon_glass", Vector3.new(0, 0, 0) } }, Coop = 1, Tokens = 2, Full = true })
	local worldFX = RS.Remotes:FindFirstChild("WorldFX")
	for _, fx in {
		{ Kind = "Sweep", UserId = 1, Pos = Vector3.new(0, 0, 0) },
		{ Kind = "Meteors", Positions = { Vector3.new(0, 0, 0) } },
		{ Kind = "Warp", Pos = Vector3.new(0, 0, 0) },
		{ Kind = "Launch", Pos = Vector3.new(0, 0, 0) },
		{ Kind = "SectorClear", Pos = Vector3.new(0, 0, 0) },
		{ Kind = "DustStorm", Zone = "dusty_flats" },
	} do
		H.SignalFor(worldFX, "OnClientEvent"):Fire(fx)
	end
	task.wait(3)
	return H.Errors == errs
end)

H.Test("Build mode enter/exit", function()
	local Build = H.Require(game:GetService("StarterPlayer").StarterPlayerScripts.Controllers.BuildController)
	Build:Enter("dust_silo")
	local active = Build.Active
	Build:Enter(nil)
	Build:Exit()
	return active and not Build.Active
end)

H.Test("No warnings from UI construction", function()
	return H.Warnings == warnBefore, (H.Warnings - warnBefore) .. " warnings"
end)

print(string.format("\n==== %d passed, %d failed, %d handler errors, %d warnings (%.1fs) ====", H.Passed, H.Failed, H.Errors, H.Warnings, os.clock() - t0))
process.exit((H.Failed == 0 and H.Errors == 0) and 0 or 1)
