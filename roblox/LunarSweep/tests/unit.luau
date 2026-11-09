--!nonstrict
-- Unit tests for pure game data & math: config integrity, cross references, map geometry,
-- formulas and formatting.  lune run tests/unit.luau

local process = require("@lune/process")
local H = require("./harness")
local roblox = require("@lune/roblox")
local Enum = roblox.Enum
local Vector3 = roblox.Vector3

local game = H.Load("build/LunarSweep.rbxl")
local Shared = game:GetService("ReplicatedStorage"):FindFirstChild("Shared")
local C = Shared.Config
local Zones = H.Require(C.Zones)
local Tools = H.Require(C.Tools)
local Containers = H.Require(C.Containers)
local Upgrades = H.Require(C.Upgrades)
local Robots = H.Require(C.Robots)
local Buildings = H.Require(C.Buildings)
local Resources = H.Require(C.Resources)
local Rarity = H.Require(C.Rarity)
local Crates = H.Require(C.Crates)
local Missions = H.Require(C.Missions)
local Achievements = H.Require(C.Achievements)
local Progression = H.Require(C.Progression)
local Sounds = H.Require(C.Sounds)
local MapLayout = H.Require(Shared.MapLayout)
local Formulas = H.Require(Shared.Formulas)
local Format = H.Require(Shared.Util.Format)

local T = H.Test

T("Content volume meets the brief", function()
	return #Zones.List >= 8 and #Tools.List >= 25 and #Containers.List >= 15 and #Upgrades.List >= 20 and #Robots.List >= 15,
		string.format("%d zones, %d tools, %d containers, %d upgrades, %d robots, %d buildings, %d achievements", #Zones.List, #Tools.List, #Containers.List, #Upgrades.List, #Robots.List, #Buildings.List, #Achievements.List)
end)

T("Unique ids everywhere", function()
	for name, list in { Zones = Zones.List, Tools = Tools.List, Containers = Containers.List, Upgrades = Upgrades.List, Robots = Robots.List, Buildings = Buildings.List, Resources = Resources.List, Achievements = Achievements.List } do
		local seen = {}
		for _, d in list do
			if seen[d.Id] then
				return false, name .. " duplicate " .. d.Id
			end
			seen[d.Id] = true
		end
	end
	return true
end)

T("Rarities are valid", function()
	for _, list in { Tools.List, Containers.List, Robots.List, Resources.List } do
		for _, d in list do
			if not Rarity.ById[d.Rarity] then
				return false, d.Id .. " rarity " .. tostring(d.Rarity)
			end
		end
	end
	return true
end)

T("Zone materials: dirty materials unique, never reused as clean/rock", function()
	local dirty, other = {}, {}
	for _, z in Zones.List do
		if dirty[z.DirtyMaterial] then
			return false, "dirty reused " .. z.Id
		end
		dirty[z.DirtyMaterial] = z.Id
		other[z.CleanMaterial] = true
		other[z.RockMaterial] = true
	end
	for m, id in dirty do
		if other[m] then
			return false, "dirty material of " .. id .. " also clean/rock"
		end
	end
	return true
end)

T("Material colours are consistent for shared materials", function()
	local colors = {}
	for _, z in Zones.List do
		for _, pair in { { z.CleanMaterial, z.CleanColor }, { z.RockMaterial, z.RockColor } } do
			local m, c = pair[1], pair[2]
			if m ~= Enum.Material.CrackedLava then
				if colors[m] and colors[m] ~= c then
					return false, tostring(m) .. " has two colours"
				end
				colors[m] = c
			end
		end
	end
	return true
end)

T("Cross references resolve (debris, crates, events, prestige)", function()
	for _, z in Zones.List do
		assert(Resources.ById[z.DustResource], z.Id)
		for _, d in z.Debris do
			assert(Resources.ById[d.Id], d.Id)
		end
	end
	for _, c in Crates.List do
		for _, r in c.Pool do
			if r.Type == "Tool" then
				assert(Tools.ById[r.Id], r.Id)
			elseif r.Type == "Container" then
				assert(Containers.ById[r.Id], r.Id)
			elseif r.Type == "Robot" then
				assert(Robots.ById[r.Id], r.Id)
			elseif r.Type == "Boost" then
				assert(Crates.Boosts[r.Id], r.Id)
			end
		end
	end
	for _, e in Progression.Events do
		for _, item in e.Shop do
			if item.Type == "Tool" then
				assert(Tools.ById[item.Id] and Tools.ById[item.Id].Event == e.Id, item.Id)
			elseif item.Type == "Container" then
				assert(Containers.ById[item.Id] and Containers.ById[item.Id].Event == e.Id, item.Id)
			elseif item.Type == "Crate" then
				assert(Crates.ById[item.Id], item.Id)
			end
		end
	end
	for _, r in Progression.LoginRewards do
		if r.Type == "Crate" then
			assert(Crates.ById[r.Id], r.Id)
		end
	end
	return true
end)

T("Every crate/event-only item is obtainable somewhere", function()
	local obtainable = {}
	for _, c in Crates.List do
		for _, r in c.Pool do
			if r.Id then
				obtainable[r.Id] = true
			end
		end
	end
	for _, e in Progression.Events do
		for _, item in e.Shop do
			if item.Id then
				obtainable[item.Id] = true
			end
		end
	end
	for _, list in { Tools.List, Containers.List, Robots.List } do
		for _, d in list do
			if d.Source == "crate" or d.Source == "event" then
				if not obtainable[d.Id] then
					return false, d.Id .. " cannot be obtained"
				end
			end
		end
	end
	return true
end)

T("Missions and achievements track stats the server actually emits", function()
	local emitted = {
		CellsCleaned = 1, KgCollected = 1, CreditsEarned = 1, Deposits = 1, Pickups = 1, RarePickups = 1, SectorsCleared = 1,
		CapsulesPacked = 1, CratesOpened = 1, UpgradesBought = 1, RobotKg = 1, BuildingsPlaced = 1, PlayMinutes = 1,
		SiloSales = 1, TeamCells = 1, Level = 1, ZonesUnlocked = 1, SecretsFound = 1, Rebirths = 1, TradesDone = 1,
		MeteorPickups = 1, LoginStreak = 1,
	}
	for _, m in Missions.Daily do
		assert(emitted[m.Key], m.Id)
	end
	for _, m in Missions.Weekly do
		assert(emitted[m.Key], m.Id)
	end
	for _, a in Achievements.List do
		assert(emitted[a.Stat], a.Id)
	end
	return true
end)

T("Shop progression: tool prices rise with required level", function()
	local last = -1
	local lastLevel = 0
	for _, t in Tools.List do
		if t.Source == "shop" then
			if t.Level < lastLevel or t.Price < last then
				return false, t.Id
			end
			last, lastLevel = t.Price, t.Level
		end
	end
	local cap = 0
	for _, c in Containers.List do
		if c.Source == "shop" then
			if c.Capacity <= cap then
				return false, c.Id
			end
			cap = c.Capacity
		end
	end
	return true
end)

T("Zone unlock levels and costs increase", function()
	for i = 2, #Zones.List do
		local a, b = Zones.List[i - 1], Zones.List[i]
		if b.Level <= a.Level or b.Cost <= a.Cost or b.Index ~= i then
			return false, b.Id
		end
	end
	return true
end)

T("Hex math round-trips", function()
	for q = -10, 10 do
		for r = -10, 10 do
			local x, z = MapLayout.HexCenter(q, r)
			local q2, r2 = MapLayout.HexAt(x + 3, z - 2)
			if q2 ~= q or r2 ~= r then
				return false, string.format("%d,%d -> %d,%d", q, r, q2, r2)
			end
		end
	end
	return true
end)

T("Sector keys encode/decode", function()
	for zi = 0, 9 do
		for _, qr in { { -12, 7 }, { 0, 0 }, { 15, -15 } } do
			local k = MapLayout.SectorKey(zi, qr[1], qr[2])
			local a, b, c = MapLayout.DecodeSectorKey(k)
			if a ~= zi or b ~= qr[1] or c ~= qr[2] then
				return false
			end
		end
	end
	return true
end)

T("Base plots inside the hub, not overlapping each other, roads or stations", function()
	local half = MapLayout.PLOT_SIZE / 2
	for i, a in MapLayout.Plots do
		if math.abs(a.X) + half > MapLayout.HUB_HALF - 30 or math.abs(a.Z) + half > MapLayout.HUB_HALF - 30 then
			return false, "plot " .. i .. " too close to the hub edge"
		end
		if math.abs(a.X) - half < 14 or math.abs(a.Z) - half < 14 then
			return false, "plot " .. i .. " overlaps a road"
		end
		for name in MapLayout.Stations do
			local p = MapLayout.StationPosition(name)
			if math.abs(p.X - a.X) < half + 10 and math.abs(p.Z - a.Z) < half + 10 then
				return false, "plot " .. i .. " overlaps station " .. name
			end
		end
		for j, b in MapLayout.Plots do
			if i ~= j and math.abs(a.X - b.X) < MapLayout.PLOT_SIZE and math.abs(a.Z - b.Z) < MapLayout.PLOT_SIZE then
				return false, string.format("plots %d and %d overlap", i, j)
			end
		end
	end
	return true
end)

T("Relics sit in their declared zones", function()
	for _, s in Progression.Secrets do
		local z
		if s.Zone == "orbital_ring" then
			z = MapLayout.ZoneAt(Vector3.new(s.X, MapLayout.ORBIT_Y, s.Z))
		else
			z = MapLayout.GridZoneAt(s.X, s.Z)
		end
		if z ~= s.Zone then
			return false, s.Id .. " is in " .. z
		end
	end
	return true
end)

T("Caves inside Crystal Caverns, asteroids above the hub", function()
	for i, c in MapLayout.CaveChambers do
		for _, p in { { c.X - c.R, c.Z - c.R }, { c.X + c.R, c.Z + c.R } } do
			if MapLayout.GridZoneAt(p[1], p[2]) ~= "crystal_caverns" then
				return false, "chamber " .. i
			end
		end
	end
	for i, a in MapLayout.Asteroids do
		if not MapLayout.InHub(a.X - a.R, a.Z - a.R) or not MapLayout.InHub(a.X + a.R, a.Z + a.R) then
			return false, "asteroid " .. i
		end
	end
	return true
end)

T("Formulas: monotonic XP curve, capacity and price modifiers", function()
	for l = 1, 99 do
		assert(Formulas.XpToNext(l + 1) > Formulas.XpToNext(l))
	end
	local p = { Upgrades = {}, Perks = {}, Zones = { dusty_flats = true }, EquippedContainer = "dust_bag", EquippedTool = "toothbrush", Rebirths = 0 }
	local base = Formulas.Capacity(p)
	p.Upgrades.dust_compactor = 5
	assert(Formulas.Capacity(p) > base)
	p.Upgrades.supplier_network = 5
	assert(Formulas.PriceMultiplier(p) < 1 and Formulas.PriceMultiplier(p) >= 0.5)
	for _, r in Resources.List do
		for t = 0, 20000, 777 do
			local m = Formulas.MarketMod(r.Id, t)
			assert(m >= 0.81 and m <= 1.19, r.Id)
		end
	end
	local lv, cr = Formulas.RebirthRequirement(0)
	local lv2, cr2 = Formulas.RebirthRequirement(5)
	return lv2 >= lv and cr2 > cr
end)

T("Format helpers", function()
	return Format.Number(1234) == "1.23K" and Format.Number(15) == "15" and Format.Number(2.5e6) == "2.50M" and Format.Credits(0.5) == "$0.50" and Format.Clock(125) == "02:05" and Format.Commas(1234567) == "1,234,567",
		Format.Number(1234) .. " " .. Format.Number(2.5e6)
end)

T("Every sound key resolves (music may be empty until uploaded)", function()
	for key, def in Sounds.Defs do
		local id = Sounds.Resolve(key)
		if not def.Looped and id == "" then
			return false, key
		end
	end
	return true
end)

print(string.format("\n==== %d passed, %d failed ====", H.Passed, H.Failed))
process.exit(H.Failed == 0 and 0 or 1)
