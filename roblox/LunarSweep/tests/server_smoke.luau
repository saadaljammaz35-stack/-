--!nonstrict
-- End-to-end headless server test. Boots the real server scripts from the built place,
-- generates the world and plays through the main game loops with simulated players.
--   lune run tests/server_smoke.luau

local process = require("@lune/process")
local task = require("@lune/task")
local roblox = require("@lune/roblox")

local H = require("./harness")
local Vector3 = roblox.Vector3
local CFrame = roblox.CFrame

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

H.Test("Hub stations, motor pool, barriers and relics exist", function()
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
	return stations == 10 and barriers == 12 and ok and hub:FindFirstChild("Garage") ~= nil and #Registry.HubBuilder.GarageBays == 3,
		string.format("%d stations, %d barriers, %d relics, %d bays", stations, barriers, #WS.Relics:GetChildren(), #Registry.HubBuilder.GarageBays)
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

H.Test("Leaderstats, tool, container and base (Command Center at home) assigned", function()
	waitFor(function()
		return alice:GetAttribute("HasBase") ~= nil and char:FindFirstChild("DustContainer") ~= nil
	end, 15)
	local ls = alice:FindFirstChild("leaderstats")
	local tool = alice.Backpack:FindFirstChildOfClass("Tool")
	local cc
	for _, b in profile.Base.Buildings do
		if b.Id == "command_center" then
			cc = b
		end
	end
	local home = cc and Vector3.new(MapLayout.FootprintCenter(cc.X, cc.Z, 4, 4)) or nil
	return ls ~= nil and tool ~= nil and char:FindFirstChild("DustContainer") ~= nil and alice:GetAttribute("HasBase") == true and cc ~= nil,
		string.format("%s, CC at cell %s,%s", tool and tool.Name or "no tool", tostring(cc and cc.X), tostring(cc and cc.Z))
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
local function ccRecord()
	for _, b in profile.Base.Buildings do
		if b.Id == "command_center" then
			return b
		end
	end
	return nil
end

H.Test("Base: build anywhere - silo, power, drill, conveyor; reject overlaps, core and edges", function()
	local cc = ccRecord()
	if not cc then
		return false, "no command center"
	end
	local X, Z = cc.X, cc.Z
	local silo = H.Invoke(alice, "PlaceBuilding", { Id = "dust_silo", X = X + 4, Z = Z, R = 0 })
	local drill = H.Invoke(alice, "PlaceBuilding", { Id = "extractor_drill", X = X + 7, Z = Z, R = 0 })
	local panel = H.Invoke(alice, "PlaceBuilding", { Id = "solar_panel", X = X, Z = Z + 6, R = 0 })
	local panel2 = H.Invoke(alice, "PlaceBuilding", { Id = "solar_panel", X = X + 2, Z = Z + 6, R = 0 })
	local conveyor = H.Invoke(alice, "PlaceBuilding", { Id = "conveyor", X = X - 1, Z = Z, R = 0 })
	local drill2 = H.Invoke(alice, "PlaceBuilding", { Id = "extractor_drill", X = X - 3, Z = Z, R = 0 })
	local overlap = H.Invoke(alice, "PlaceBuilding", { Id = "solar_post", X = X + 1, Z = Z + 1, R = 0 })
	local gx, gz = MapLayout.FootprintCell(0, 0, 3, 3)
	local core = H.Invoke(alice, "PlaceBuilding", { Id = "dust_silo", X = gx, Z = gz, R = 0 })
	local oob = H.Invoke(alice, "PlaceBuilding", { Id = "dust_silo", X = MapLayout.N - 2, Z = 40, R = 0 })
	return silo.Ok and panel.Ok and panel2.Ok and drill.Ok and conveyor.Ok and drill2.Ok and not overlap.Ok and not core.Ok and not oob.Ok,
		string.format("%s / %s / %s / %s / %s", tostring(silo.Msg), tostring(drill.Msg), tostring(overlap.Msg), tostring(core.Msg), tostring(oob.Msg))
end)

H.Test("Base: drag a conveyor line and block terrain cells under buildings", function()
	local cc = ccRecord()
	local before = #profile.Base.Buildings
	local line = H.Invoke(alice, "PlaceLine", { Id = "conveyor", X0 = cc.X, Z0 = cc.Z - 2, X1 = cc.X + 5, Z1 = cc.Z - 2 })
	local base = Registry.BaseService:GetBase(alice)
	local blocked = base and #base.Blocked or 0
	return line.Ok and #profile.Base.Buildings == before + 6, string.format("%s, %d buildings, %d blocked cells", tostring(line.Msg), #profile.Base.Buildings, blocked)
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
	local cc = ccRecord()
	local post = H.Invoke(alice, "PlaceBuilding", { Id = "solar_post", X = cc.X - 2, Z = cc.Z + 6, R = 0 })
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

-- vehicles
H.Test("Vehicles: buy, take out at a garage, clean with the brush, pack the hopper, store", function()
	H.Invoke(alice, "Admin", { Cmd = "credits", Arg = "5000000" })
	local VS = Registry.VehicleService
	local buy = H.Invoke(alice, "BuyVehicle", { Id = "ride_on_sweeper" })
	local again = H.Invoke(alice, "BuyVehicle", { Id = "ride_on_sweeper" })
	Registry.ZoneService:TeleportPlayer(alice, flatsSpawn)
	task.wait(0.1)
	local far = H.Invoke(alice, "SpawnVehicle", { Id = "ride_on_sweeper" })
	local g = MapLayout.GARAGE
	H.MoveCharacter(alice, Vector3.new(g.X, 4, g.Z + 20))
	local spawn = H.Invoke(alice, "SpawnVehicle", { Id = "ride_on_sweeper" })
	local a = VS:Get(alice)
	if not (buy.Ok and not again.Ok and not far.Ok and spawn.Ok and a and a.Model.Parent == WS.Vehicles) then
		return false, string.format("%s / %s / %s / %s", tostring(buy.Msg), tostring(again.Msg), tostring(far.Msg), tostring(spawn.Msg))
	end
	-- simulate sitting in the driver seat (no physics in the headless harness)
	local list = Registry.SectorService.ByZone.dusty_flats
	local sector = list[6]
	local c = sector.Center
	a.Chassis.Anchored = true
	a.Model:PivotTo(CFrame.new(c.X, c.Y + 3, c.Z))
	H.MoveCharacter(alice, Vector3.new(c.X, c.Y + 4, c.Z))
	a.Driving = true
	profile.VehicleCargo = {}
	local cells0 = profile.Stats.VehicleCells or 0
	for i = 1, 8 do
		local p = Vector3.new(c.X, c.Y, c.Z - 6 - i * 1.5)
		a.Model:PivotTo(CFrame.new(p.X, c.Y + 3, p.Z + 6))
		H.FireServer(alice, "VehicleStroke", Vector3.new(p.X, Registry.WorldService:GroundAt(p.X, p.Z), p.Z))
		task.wait(0.12)
	end
	local cargo = Formulas.ContentsKg(profile.VehicleCargo)
	local cells = (profile.Stats.VehicleCells or 0) - cells0
	-- a stroke far from the vehicle is ignored
	local before = Formulas.ContentsKg(profile.VehicleCargo)
	H.FireServer(alice, "VehicleStroke", Vector3.new(c.X + 200, c.Y, c.Z))
	task.wait(0.15)
	if Formulas.ContentsKg(profile.VehicleCargo) ~= before then
		return false, "far stroke accepted"
	end
	local caps0 = #Registry.CapsuleService:OwnedBy(alice.UserId)
	H.FireServer(alice, "PackCapsule")
	task.wait(0.2)
	local packed = #Registry.CapsuleService:OwnedBy(alice.UserId) == caps0 + 1 and Formulas.ContentsKg(profile.VehicleCargo) == 0
	a.Driving = false
	local store = H.Invoke(alice, "StoreVehicle", {})
	return cargo > 0 and cells > 0 and packed and store.Ok and VS:Get(alice) == nil and alice:GetAttribute("VehicleKg") == 0,
		string.format("%.3f kg cargo, %d cells, packed %s, %s", cargo, cells, tostring(packed), tostring(store.Msg))
end)

H.Test("Capsule throwing: throw while carrying, a Capsule Catcher sells it instantly (+10%)", function()
	local CS = Registry.CapsuleService
	local cap = CS:OwnedBy(alice.UserId)[1]
	if not cap then
		return false, "no capsule"
	end
	H.MoveCharacter(alice, cap.Model:GetPivot().Position + Vector3.new(0, 3, 2))
	local ok, msg = CS:Carry(alice, cap.Id)
	if not ok then
		return false, tostring(msg)
	end
	H.FireServer(alice, "ThrowCapsule", Vector3.new(0, 0, -1))
	task.wait(0.1)
	local thrown = cap.Moving == true and char:GetAttribute("Carrying") == nil and (profile.Stats.CapsulesThrown or 0) >= 1
	-- a catcher next to the command center
	local cc = ccRecord()
	local place = H.Invoke(alice, "PlaceBuilding", { Id = "capsule_catcher", X = cc.X, Z = cc.Z + 9, R = 0 })
	local catcher
	for _, b in profile.Base.Buildings do
		if b.Id == "capsule_catcher" then
			catcher = Registry.BaseService:GetBase(alice).Models[b.Uid]
		end
	end
	if not place.Ok or not catcher then
		return false, "catcher: " .. tostring(place.Msg)
	end
	local before = profile.Credits
	CS:Land(cap, catcher:GetPivot().Position + Vector3.new(3, 0, 3))
	task.wait(0.1)
	return thrown and cap.Claimed and profile.Credits > before and (profile.Stats.CapsulesCaught or 0) == 1,
		string.format("thrown %s, +%.1f credits", tostring(thrown), profile.Credits - before)
end)

H.Test("Robots: assign sectors (same zone, max 8, whole zone reset)", function()
	local r = profile.Robots[1]
	if not r then
		return false, "no robot"
	end
	local flats = Registry.SectorService.ByZone.dusty_flats
	local craters = Registry.SectorService.ByZone.pockmark_craters
	local ok = H.Invoke(alice, "RobotSetSectors", { Uid = r.Uid, Keys = { flats[1].Key, flats[2].Key } })
	local stored = r.Sectors and #r.Sectors == 2 and r.Zone == "dusty_flats"
	local mixed = H.Invoke(alice, "RobotSetSectors", { Uid = r.Uid, Keys = { flats[1].Key, craters[1].Key } })
	local many = {}
	for i = 1, 9 do
		table.insert(many, flats[i].Key)
	end
	local tooMany = H.Invoke(alice, "RobotSetSectors", { Uid = r.Uid, Keys = many })
	local target = Registry.SectorService:FindDirtyTarget("dusty_flats", flats[1].Center, nil, { [flats[1].Key] = true })
	local inSector = target and Registry.SectorService.Sectors[Registry.WorldGrid.GetSector(MapLayout.Linear(MapLayout.CellIndex(target.X, target.Z)))] == flats[1]
	local reset = H.Invoke(alice, "RobotSetSectors", { Uid = r.Uid, Keys = {} })
	return ok.Ok and stored and not mixed.Ok and not tooMany.Ok and reset.Ok and r.Sectors == nil and (target == nil or inSector),
		string.format("%s / %s / %s", tostring(ok.Msg), tostring(mixed.Msg), tostring(tooMany.Msg))
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
H.Test("Second player loads with their own base", function()
	waitFor(function()
		bobProfile = Registry.DataService:Get(bob)
		return bobProfile ~= nil and bob:GetAttribute("HasBase") ~= nil
	end, 20)
	return bobProfile ~= nil and bob:GetAttribute("HasBase") == true and Registry.BaseService:GetBase(bob) ~= nil, "base " .. tostring(bob:GetAttribute("HasBase"))
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
