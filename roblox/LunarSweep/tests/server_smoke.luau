--!nonstrict
-- End-to-end headless server test. Boots the real server scripts from the built place,
-- generates the world and plays through the main game loops with simulated players.
--   lune run tests/server_smoke.luau

local process = require("@lune/process")
local task = require("@lune/task")
local roblox = require("@lune/roblox")

local H = require("./harness")
local Vector3 = roblox.Vector3

local t0 = os.clock()
local game = H.Load("build/LunarSweep.rbxl")
local SSS = game:GetService("ServerScriptService")
local RS = game:GetService("ReplicatedStorage")
local WS = game:GetService("Workspace")

local function waitFor(cond: () -> boolean, timeout: number): boolean
	local start = os.clock()
	while not cond() do
		if os.clock() - start > timeout then
			return false
		end
		task.wait(0.1)
	end
	return true
end

local function finish()
	print(string.format("\n==== %d passed, %d failed, %d handler errors, %d warnings (%.1fs) ====", H.Passed, H.Failed, H.Errors, H.Warnings, os.clock() - t0))
	process.exit((H.Failed == 0 and H.Errors == 0) and 0 or 1)
end

-- boot
H.Test("Server boots (Main.server runs)", function()
	H.RunScript(SSS:FindFirstChild("Main"))
	return true
end)

local Registry = H.Require(SSS.Services.Registry)
local Shared = RS:FindFirstChild("Shared")
local MapLayout = H.Require(Shared.MapLayout)
local Zones = H.Require(Shared.Config.Zones)
local Formulas = H.Require(Shared.Formulas)
local WorldGrid = H.Require(SSS.Services.WorldGrid)

H.Test("World generation completes", function()
	local ok = waitFor(function()
		return WS:GetAttribute("WorldReady") == true
	end, 240)
	return ok, string.format("%d WriteVoxels calls, %d voxels, %d fills", H.Terrain.WriteVoxels, H.Terrain.Voxels, H.Terrain.Fill)
end)

H.Test("Every zone has sectors and dirty cells", function()
	local parts = {}
	for _, z in Zones.List do
		local list = Registry.SectorService.ByZone[z.Id]
		if not list or #list == 0 then
			return false, z.Id .. " has no sectors"
		end
		local dirty = 0
		for _, s in list do
			dirty += s.Dirty
		end
		table.insert(parts, string.format("%s:%d/%d", z.Index, #list, dirty))
	end
	return true, table.concat(parts, " ")
end)

H.Test("Hub stations, plots, barriers and relics exist", function()
	local hub = WS:FindFirstChild("Hub")
	local stations = 0
	for name in MapLayout.Stations do
		if hub:FindFirstChild(name) then
			stations += 1
		end
	end
	local barriers = 0
	for _, c in hub.Barriers:GetChildren() do
		if c.Name == "Barrier" then
			barriers += 1
		end
	end
	local ok = waitFor(function()
		return #WS.Relics:GetChildren() == 10
	end, 10)
	return stations == 10 and barriers == 12 and ok and #Registry.HubBuilder.PlotModels == 8, string.format("%d stations, %d barriers, %d relics", stations, barriers, #WS.Relics:GetChildren())
end)

H.Test("Pickups spawned in every zone", function()
	waitFor(function()
		return #WS.Pickups:GetChildren() > 250
	end, 20)
	return #WS.Pickups:GetChildren() > 250, #WS.Pickups:GetChildren() .. " pickups"
end)

-- player joins
local alice = H.AddPlayer(1001, "Alice")
local hubSpawn = Vector3.new(0, 4, 0)
local char = H.SpawnCharacter(alice, hubSpawn)
local profile

H.Test("Profile loads (memory store) and replicates", function()
	local ok = waitFor(function()
		profile = Registry.DataService:Get(alice)
		return profile ~= nil
	end, 20)
	local synced = H.Sent.DataSync and #H.Sent.DataSync > 0
	return ok and synced and profile.Tools.toothbrush == true, ok and ("level " .. profile.Level) or "no profile"
end)

H.Test("Leaderstats, tool, container and plot assigned", function()
	waitFor(function()
		return alice:GetAttribute("Plot") ~= nil and char:FindFirstChild("DustContainer") ~= nil
	end, 15)
	local ls = alice:FindFirstChild("leaderstats")
	local tool = alice.Backpack:FindFirstChildOfClass("Tool")
	return ls ~= nil and tool ~= nil and char:FindFirstChild("DustContainer") ~= nil and alice:GetAttribute("Plot") ~= nil, tool and tool.Name or "no tool"
end)

-- sweep in Dusty Flats
local flatsSpawn = Registry.WorldService:GetSpawn("dusty_flats")
local function sweepAlong(player, start: Vector3, steps: number)
	local hum = player.Character:FindFirstChildOfClass("Humanoid")
	local tool = player.Backpack:FindFirstChildOfClass("Tool")
	if tool then
		hum:EquipTool(tool)
	end
	local pos = start
	for i = 1, steps do
		pos = start + Vector3.new(0, 0, -i * 1.6)
		local ground = Registry.WorldService:GroundAt(pos.X, pos.Z)
		H.MoveCharacter(player, Vector3.new(pos.X, ground + 3, pos.Z))
		H.FireServer(player, "Stroke", Vector3.new(pos.X, ground, pos.Z - 2))
		task.wait(0.14)
	end
end

H.Test("Sweeping cleans terrain cells and fills the container", function()
	local before = H.Terrain.ReplaceMaterial
	-- find a dirty spot in dusty flats
	local list = Registry.SectorService.ByZone.dusty_flats
	local s = list[math.floor(#list / 2)]
	local start = Vector3.new(s.Center.X, 0, s.Center.Z + 20)
	Registry.ZoneService:TeleportPlayer(alice, Vector3.new(start.X, s.Center.Y + 3, start.Z))
	sweepAlong(alice, start, 25)
	local kg = Formulas.ContentsKg(profile.Contents)
	return kg > 0 and (profile.Stats.CellsCleaned or 0) > 0 and H.Terrain.ReplaceMaterial > before,
		string.format("%.3f kg, %d cells, %d ReplaceMaterial calls", kg, profile.Stats.CellsCleaned or 0, H.Terrain.ReplaceMaterial - before)
end)

H.Test("Container capacity is enforced", function()
	local cap = Formulas.Capacity(profile)
	return Formulas.ContentsKg(profile.Contents) <= cap + 1e-6, string.format("cap %.2f", cap)
end)

H.Test("Stroke rejected when too far from the character", function()
	local before = profile.Stats.CellsCleaned or 0
	task.wait(0.2)
	H.FireServer(alice, "Stroke", flatsSpawn + Vector3.new(200, 0, 200))
	task.wait(0.1)
	return (profile.Stats.CellsCleaned or 0) == before
end)

H.Test("Deposit at the Exchange sells dust for credits", function()
	local pos = MapLayout.StationPosition("Exchange")
	Registry.ZoneService:TeleportPlayer(alice, pos + Vector3.new(0, 1, 6))
	local r = H.Invoke(alice, "Deposit", {})
	return r.Ok == true and profile.Credits > 0, tostring(r.Msg)
end)

H.Test("Admin tools work in Studio", function()
	local r = H.Invoke(alice, "Admin", { Cmd = "credits", Arg = "50000000" })
	local r2 = H.Invoke(alice, "Admin", { Cmd = "level", Arg = "40" })
	return r.Ok and r2.Ok and profile.Credits >= 5e7 and profile.Level == 40
end)

H.Test("Shop: buy & equip tools/containers, upgrades", function()
	local a = H.Invoke(alice, "BuyTool", { Id = "household_broom" })
	local b = H.Invoke(alice, "BuyContainer", { Id = "steel_canister" })
	local c = H.Invoke(alice, "BuyUpgrade", { Id = "wide_head" })
	local d = H.Invoke(alice, "BuyUpgrade", { Id = "dust_compactor" })
	local e = H.Invoke(alice, "EquipTool", { Id = "toothbrush" })
	local f = H.Invoke(alice, "BuyTool", { Id = "lucky_whisk" }) -- crate-only, must fail
	return a.Ok and b.Ok and c.Ok and d.Ok and e.Ok and not f.Ok and profile.Upgrades.wide_head == 1,
		string.format("%s | %s | %s", tostring(a.Msg), tostring(b.Msg), tostring(f.Msg))
end)

H.Test("Zone unlocking respects order and level", function()
	local skip = H.Invoke(alice, "UnlockZone", { Id = "junkyard_expanse" })
	local ok = H.Invoke(alice, "UnlockZone", { Id = "pockmark_craters" })
	local ok2 = H.Invoke(alice, "UnlockZone", { Id = "junkyard_expanse" })
	return not skip.Ok and ok.Ok and ok2.Ok and profile.Zones.junkyard_expanse == true, tostring(skip.Msg)
end)

H.Test("Fast travel to an unlocked zone", function()
	local r = H.Invoke(alice, "FastTravel", { Zone = "pockmark_craters" })
	return r.Ok == true
end)

-- base building
H.Test("Base: place silo, power, drill, conveyor; reject overlaps/out of bounds", function()
	local silo = H.Invoke(alice, "PlaceBuilding", { Id = "dust_silo", X = 14, Z = 10, R = 0 })
	local panel = H.Invoke(alice, "PlaceBuilding", { Id = "solar_panel", X = 2, Z = 2, R = 0 })
	local panel2 = H.Invoke(alice, "PlaceBuilding", { Id = "solar_panel", X = 4, Z = 2, R = 0 })
	local drill = H.Invoke(alice, "PlaceBuilding", { Id = "extractor_drill", X = 17, Z = 10, R = 0 })
	local conveyor = H.Invoke(alice, "PlaceBuilding", { Id = "conveyor", X = 10, Z = 14, R = 0 })
	local drill2 = H.Invoke(alice, "PlaceBuilding", { Id = "extractor_drill", X = 10, Z = 15, R = 0 })
	local overlap = H.Invoke(alice, "PlaceBuilding", { Id = "solar_post", X = 11, Z = 11, R = 0 })
	local oob = H.Invoke(alice, "PlaceBuilding", { Id = "dust_silo", X = 23, Z = 23, R = 0 })
	return silo.Ok and panel.Ok and panel2.Ok and drill.Ok and conveyor.Ok and drill2.Ok and not overlap.Ok and not oob.Ok,
		string.format("%s / %s / %s", tostring(drill.Msg), tostring(overlap.Msg), tostring(oob.Msg))
end)

H.Test("Base production fills the silo (connected via silo + conveyor)", function()
	waitFor(function()
		return (profile.Base.Silo.drilled_dust or 0) > 0.05
	end, 12)
	local base = Registry.BaseService:GetBase(alice)
	local working = 0
	for _, s in base.Status do
		if s == "Working" then
			working += 1
		end
	end
	return (profile.Base.Silo.drilled_dust or 0) > 0 and working >= 2, string.format("%.3f kg drilled, %d working, %.0f/%.0f kW", profile.Base.Silo.drilled_dust or 0, working, base.PowerGen, base.PowerUse)
end)

H.Test("Sell silo", function()
	local before = profile.Credits
	local r = H.Invoke(alice, "SellSilo", {})
	return r.Ok and profile.Credits > before, tostring(r.Msg)
end)

H.Test("Upgrade and remove buildings", function()
	local silo
	for _, b in profile.Base.Buildings do
		if b.Id == "dust_silo" then
			silo = b
		end
	end
	local up = H.Invoke(alice, "UpgradeBuilding", { Uid = silo.Uid })
	local post = H.Invoke(alice, "PlaceBuilding", { Id = "solar_post", X = 0, Z = 0, R = 0 })
	local postUid = profile.Base.Buildings[#profile.Base.Buildings].Uid
	local rm = H.Invoke(alice, "RemoveBuilding", { Uid = postUid })
	return up.Ok and silo.Level == 2 and post.Ok and rm.Ok, tostring(rm.Msg)
end)

-- robots
H.Test("Robots: buy, deploy, warp to zone and clean", function()
	local r = H.Invoke(alice, "BuyRobot", { Id = "dustbot_mk1" })
	local robot = profile.Robots[1]
	local zone = H.Invoke(alice, "RobotSetZone", { Uid = robot.Uid, Zone = "dusty_flats" })
	local reachedWork = waitFor(function()
		for _, m in WS.Robots:GetChildren() do
			if m:GetAttribute("Owner") == 1001 and m:GetAttribute("State") == "Working" then
				return true
			end
		end
		return false
	end, 25)
	task.wait(3)
	local kg = 0
	for _, m in WS.Robots:GetChildren() do
		if m:GetAttribute("Owner") == 1001 then
			kg = m:GetAttribute("Kg") or 0
		end
	end
	return r.Ok and zone.Ok and robot.Active and reachedWork and kg > 0, string.format("%s, cargo %.3f kg, battery %.0f%%", tostring(r.Msg), kg, robot.Battery)
end)

H.Test("Robot upgrade, recall and repair flows", function()
	local robot = profile.Robots[1]
	robot.Durability = 50
	local up = H.Invoke(alice, "RobotUpgrade", { Uid = robot.Uid })
	local rep = H.Invoke(alice, "RobotRepair", { Uid = robot.Uid })
	local rec = H.Invoke(alice, "RobotRecall", { Uid = robot.Uid })
	return up.Ok and rep.Ok and robot.Level == 2 and robot.Durability == 100 and rec.Ok
end)

-- capsules
H.Test("Capsules: pack, carry and deposit", function()
	H.Invoke(alice, "Admin", { Cmd = "fill" })
	Registry.ZoneService:TeleportPlayer(alice, flatsSpawn)
	task.wait(0.1)
	H.FireServer(alice, "PackCapsule")
	task.wait(0.2)
	local capsule = WS.Capsules:FindFirstChild("Capsule")
	local packed = capsule ~= nil and Formulas.ContentsKg(profile.Contents) == 0
	if not capsule then
		return false, "no capsule"
	end
	local ok, msg = Registry.CapsuleService:Carry(alice, capsule:GetAttribute("CapsuleId"))
	local carrying = char:GetAttribute("Carrying") == true
	-- walk (fast travel would drop the capsule on purpose)
	local pos = MapLayout.StationPosition("Exchange")
	H.MoveCharacter(alice, pos + Vector3.new(0, 1, 6))
	local before = profile.Credits
	local r = H.Invoke(alice, "Deposit", {})
	return packed and ok and carrying and r.Ok and profile.Credits > before, tostring(msg or r.Msg)
end)

H.Test("Capsules: recall to silo", function()
	H.Invoke(alice, "Admin", { Cmd = "fill" })
	Registry.ZoneService:TeleportPlayer(alice, flatsSpawn)
	task.wait(0.1)
	H.FireServer(alice, "PackCapsule")
	task.wait(0.2)
	local r = H.Invoke(alice, "RecallCapsules", {})
	return r.Ok and Formulas.ContentsKg(profile.Base.Silo) > 0, tostring(r.Msg)
end)

-- crates, missions, achievements, login
H.Test("Crates open with valid rewards", function()
	local r1 = H.Invoke(alice, "OpenCrate", { Id = "supply_crate" })
	H.Invoke(alice, "Admin", { Cmd = "gems", Arg = "1000" })
	local r2 = H.Invoke(alice, "OpenCrate", { Id = "cosmic_crate" })
	local r3 = H.Invoke(alice, "OpenCrate", { Id = "robot_crate" })
	return r1.Ok and r2.Ok and r3.Ok and r1.Data and r1.Data.Label ~= nil, string.format("%s | %s | %s", r1.Data and r1.Data.Label, r2.Data and r2.Data.Label, r3.Data and r3.Data.Label)
end)

H.Test("Crate pity guarantees a Legendary+ after 30 cosmic opens", function()
	H.Invoke(alice, "Admin", { Cmd = "gems", Arg = "5000" })
	task.wait(3.2) -- crates are rate limited (1/s)
	profile.Crates.Pity.cosmic_crate = 29
	local r = H.Invoke(alice, "OpenCrate", { Id = "cosmic_crate" })
	return r.Ok and (r.Data.Rarity == "Legendary" or r.Data.Rarity == "Mythic"), r.Data and r.Data.Label
end)

H.Test("Missions generated (3 daily + 3 weekly) and progress", function()
	local d, w = profile.Missions.Daily, profile.Missions.Weekly
	local progressed = false
	for _, m in d do
		if m.Progress > 0 then
			progressed = true
		end
	end
	for _, m in w do
		if m.Progress > 0 then
			progressed = true
		end
	end
	return #d == 3 and #w == 3 and progressed, #d .. " daily, " .. #w .. " weekly"
end)

H.Test("Mission claim works when complete", function()
	local m = profile.Missions.Daily[1]
	m.Progress = m.Target
	local before = profile.Gems
	local r = H.Invoke(alice, "ClaimMission", { Id = m.Id })
	local again = H.Invoke(alice, "ClaimMission", { Id = m.Id })
	return r.Ok and not again.Ok and profile.Gems > before, tostring(r.Msg)
end)

H.Test("Achievements granted from stats", function()
	local n = 0
	for _ in profile.Achievements do
		n += 1
	end
	return n > 0 and profile.Achievements.cellscleaned_1 ~= nil, n .. " earned"
end)

H.Test("Daily login reward claim", function()
	local r = H.Invoke(alice, "ClaimLogin", {})
	local again = H.Invoke(alice, "ClaimLogin", {})
	return r.Ok and not again.Ok, tostring(r.Msg)
end)

H.Test("Relic (secret) discovery", function()
	local relic = WS.Relics:FindFirstChild("Relic_founders_plaque")
	local prompt = relic:FindFirstChildWhichIsA("ProximityPrompt", true)
	local before = profile.Gems
	H.TriggerPrompt(prompt, alice)
	return profile.Secrets.founders_plaque ~= nil and profile.Gems > before
end)

H.Test("Server events trigger (meteor shower & dust storm)", function()
	local before = #WS.Pickups:GetChildren()
	local a = Registry.EventService:Trigger("MeteorShower", "dusty_flats")
	local afterMeteors = #WS.Pickups:GetChildren()
	local b = Registry.EventService:Trigger("DustStorm", "dusty_flats")
	return a and b and afterMeteors > before and Registry.EventService:KgMult("dusty_flats") == 1.5, string.format("%d -> %d pickups", before, afterMeteors)
end)

H.Test("Seasonal event shop (forced Harvest Moon)", function()
	Registry.EventService:ForceSeason("harvest_moon")
	profile.EventTokens.harvest_moon = 1000
	local r = H.Invoke(alice, "EventShopBuy", { Index = 1 })
	return r.Ok and profile.Tools.harvest_rake == true, tostring(r.Msg)
end)

-- trading
local bob = H.AddPlayer(1002, "Bob")
H.SpawnCharacter(bob, Vector3.new(10, 4, 10))
local bobProfile
H.Test("Second player loads and gets a different plot", function()
	waitFor(function()
		bobProfile = Registry.DataService:Get(bob)
		return bobProfile ~= nil and bob:GetAttribute("Plot") ~= nil
	end, 20)
	return bobProfile ~= nil and bob:GetAttribute("Plot") ~= alice:GetAttribute("Plot"), string.format("plots %s / %s", tostring(alice:GetAttribute("Plot")), tostring(bob:GetAttribute("Plot")))
end)

H.Test("Safe trade: tradeable tool + gems swap atomically", function()
	profile.Tools.lucky_whisk = true
	H.Invoke(bob, "Admin", { Cmd = "level", Arg = "10" })
	H.Invoke(bob, "Admin", { Cmd = "gems", Arg = "50" })
	local req = H.Invoke(alice, "TradeRequest", { UserId = 1002 })
	local resp = H.Invoke(bob, "TradeRespond", { From = 1001, Accept = true })
	local o1 = H.Invoke(alice, "TradeOffer", { Tools = { "lucky_whisk" }, Containers = {}, Gems = 0 })
	local gemsBob = bobProfile.Gems
	local o2 = H.Invoke(bob, "TradeOffer", { Tools = {}, Containers = {}, Gems = 20 })
	local bad = H.Invoke(bob, "TradeOffer", { Tools = { "toothbrush" }, Containers = {}, Gems = 0 }) -- not tradeable
	H.Invoke(bob, "TradeOffer", { Tools = {}, Containers = {}, Gems = 20 })
	H.Invoke(alice, "TradeReady", { Ready = true })
	H.Invoke(bob, "TradeReady", { Ready = true })
	local early = H.Invoke(alice, "TradeConfirm", {})
	task.wait(4.1)
	local c1 = H.Invoke(alice, "TradeConfirm", {})
	local c2 = H.Invoke(bob, "TradeConfirm", {})
	local gemsA = profile.Gems
	return req.Ok and resp.Ok and o1.Ok and o2.Ok and not bad.Ok and not early.Ok and c1.Ok and c2.Ok and bobProfile.Tools.lucky_whisk == true and profile.Tools.lucky_whisk == nil and bobProfile.Gems <= gemsBob - 17 and (bobProfile.Stats.TradesDone or 0) == 1,
		string.format("alice gems %d, bob gems %d | %s %s %s %s %s %s %s %s", gemsA, bobProfile.Gems, tostring(req.Msg), tostring(resp.Msg), tostring(o1.Msg), tostring(o2.Msg), tostring(bad.Msg), tostring(early.Msg), tostring(c1.Msg), tostring(c2.Msg))
end)

H.Test("Co-op: sweeping near another player counts team cells", function()
	Registry.ZoneService:TeleportPlayer(bob, flatsSpawn + Vector3.new(6, 0, 0))
	Registry.ZoneService:TeleportPlayer(alice, flatsSpawn)
	local list = Registry.SectorService.ByZone.dusty_flats
	local s = list[3]
	local start = Vector3.new(s.Center.X, 0, s.Center.Z + 20)
	Registry.ZoneService:TeleportPlayer(bob, Vector3.new(start.X + 8, s.Center.Y + 3, start.Z))
	H.MoveCharacter(bob, Vector3.new(start.X + 8, s.Center.Y + 3, start.Z))
	local bobTool = bob.Backpack:FindFirstChildOfClass("Tool")
	bob.Character:FindFirstChildOfClass("Humanoid"):EquipTool(bobTool)
	H.FireServer(bob, "Stroke", Vector3.new(start.X + 8, s.Center.Y, start.Z - 2))
	profile.Contents = {}
	sweepAlong(alice, start, 8)
	return (profile.Stats.TeamCells or 0) > 0, tostring(profile.Stats.TeamCells)
end)

-- leaderboards + rebirth + persistence
H.Test("Leaderboards respond", function()
	local r = H.Invoke(alice, "GetLeaderboards", {})
	return r.Ok and r.Data.Server.Kg ~= nil and #r.Data.Server.Kg == 2, r.Ok and (#r.Data.Server.Kg .. " entries") or tostring(r.Msg)
end)

H.Test("Rebirth requirements enforced, then re-launch", function()
	profile.Level = 10
	local fail = H.Invoke(alice, "Rebirth", {})
	task.wait(1.1) -- rebirth requests are rate limited
	profile.Level = 40
	profile.Credits = 2e6
	local ok = H.Invoke(alice, "Rebirth", {})
	return not fail.Ok and ok.Ok and profile.Rebirths == 1 and profile.Level == 1 and profile.Stars > 0 and profile.Tools.harvest_rake == true and profile.Tools.household_broom == nil,
		tostring(ok.Msg)
end)

H.Test("Prestige perk purchase", function()
	local r = H.Invoke(alice, "BuyPerk", { Id = "star_power" })
	return r.Ok and profile.Perks.star_power == 1
end)

H.Test("Rate limiter blocks request floods", function()
	local blocked = false
	for _ = 1, 30 do
		local r = H.Invoke(alice, "BuyUpgrade", { Id = "nonexistent" })
		if r.Msg == "Slow down!" then
			blocked = true
		end
	end
	return blocked
end)

H.Test("Bad payloads are rejected safely", function()
	local a = H.Invoke(alice, 12345, {})
	local b = H.Invoke(alice, "BuyTool", "notatable")
	local c = H.Invoke(alice, "PlaceBuilding", { Id = "dust_silo", X = 1.5, Z = 0, R = 0 })
	H.FireServer(alice, "Stroke", "garbage")
	H.FireServer(alice, "Stroke", Vector3.new(0 / 0, 0, 0))
	return not a.Ok and not b.Ok and not c.Ok
end)

H.Test("Save on leave and reload keeps progress (session lock released)", function()
	local rebirths = profile.Rebirths
	local buildings = #profile.Base.Buildings
	H.RemovePlayer(alice)
	task.wait(0.5)
	alice.Parent = nil
	local again = H.AddPlayer(1001, "Alice")
	H.SpawnCharacter(again, Vector3.new(0, 4, 0))
	local p2
	waitFor(function()
		p2 = Registry.DataService:Get(again)
		return p2 ~= nil
	end, 20)
	return p2 ~= nil and p2.Rebirths == rebirths and #p2.Base.Buildings == buildings, p2 and (#p2.Base.Buildings .. " buildings") or "no profile"
end)

H.Test("In-game SelfTest passes", function()
	local player = game:GetService("Players"):GetPlayerByUserId(1001)
	local r = H.Invoke(player, "Admin", { Cmd = "selftest" })
	return r.Ok and string.find(tostring(r.Msg), " 0 failed") ~= nil, tostring(r.Msg)
end)

H.Test("No players were kicked", function()
	return #H.Kicked == 0, #H.Kicked > 0 and H.Kicked[1].Msg or nil
end)

local _ = Zones
local __ = WorldGrid
finish()
