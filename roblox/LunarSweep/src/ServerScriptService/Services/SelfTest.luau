--!nonstrict
-- In-engine self test. Runs automatically in Studio (ServerScriptService attribute
-- RunSelfTests = true) once the world is generated, and on demand via the Admin panel
-- ("selftest"). Results are printed to Output and returned as a summary string.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ServerScriptService = game:GetService("ServerScriptService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local Formulas = require(Shared.Formulas)
local MapLayout = require(Shared.MapLayout)
local Zones = require(Shared.Config.Zones)
local Tools = require(Shared.Config.Tools)
local Containers = require(Shared.Config.Containers)
local Upgrades = require(Shared.Config.Upgrades)
local Robots = require(Shared.Config.Robots)
local Buildings = require(Shared.Config.Buildings)
local Resources = require(Shared.Config.Resources)
local ModelFactory = require(Shared.ModelFactory)
local Net = require(Shared.Net)
local Registry = require(script.Parent.Registry)
local WorldGrid = require(script.Parent.WorldGrid)

local SelfTest = {}

function SelfTest:Run(player: Player?): string
	local results = {}
	local pass, fail = 0, 0
	local function check(name: string, ok: boolean, detail: string?)
		if ok then
			pass += 1
		else
			fail += 1
		end
		table.insert(results, string.format("[%s] %s%s", ok and "PASS" or "FAIL", name, detail and (" - " .. detail) or ""))
	end
	local function try(name: string, fn: () -> (boolean, string?))
		local ok, a, b = pcall(fn)
		if not ok then
			check(name, false, "error: " .. tostring(a))
		else
			check(name, a == true, b)
		end
	end

	-- configuration
	try("Content counts (>=8 zones, >=25 tools, >=15 containers, >=20 upgrades, >=15 robots)", function()
		return #Zones.List >= 8 and #Tools.List >= 25 and #Containers.List >= 15 and #Upgrades.List >= 20 and #Robots.List >= 15,
			string.format("%d zones, %d tools, %d containers, %d upgrades, %d robots, %d buildings", #Zones.List, #Tools.List, #Containers.List, #Upgrades.List, #Robots.List, #Buildings.List)
	end)
	try("Every zone references valid resources", function()
		for _, z in Zones.List do
			if not Resources.ById[z.DustResource] then
				return false, z.Id
			end
			for _, d in z.Debris do
				if not Resources.ById[d.Id] then
					return false, d.Id
				end
			end
		end
		return true
	end)
	try("Remotes exist", function()
		for _, n in Net.EventNames do
			if not ReplicatedStorage.Remotes:FindFirstChild(n) then
				return false, n
			end
		end
		return ReplicatedStorage.Remotes:FindFirstChild("Request") ~= nil
	end)
	-- models
	try("Every model builds", function()
		for _, t in Tools.List do
			ModelFactory.Tool(t.Id):Destroy()
		end
		for _, c in Containers.List do
			ModelFactory.Container(c.Id):Destroy()
		end
		for _, r in Robots.List do
			ModelFactory.Robot(r.Id, true):Destroy()
		end
		for _, b in Buildings.List do
			ModelFactory.Building(b.Id, 2):Destroy()
		end
		for _, r in Resources.List do
			ModelFactory.Pickup(r.Id):Destroy()
		end
		return true
	end)
	-- world
	try("World generated", function()
		return Workspace:GetAttribute("WorldReady") == true and Registry.SectorService.Built, tostring(#Registry.SectorService.Sectors) .. " sectors"
	end)
	try("Every zone has cleanable sectors", function()
		for _, z in Zones.List do
			local list = Registry.SectorService.ByZone[z.Id]
			if not list or #list == 0 then
				return false, z.Id
			end
		end
		return true
	end)
	try("Hub stations & plots built", function()
		local hub = Workspace:FindFirstChild("Hub")
		return hub ~= nil and hub:FindFirstChild("Exchange") ~= nil and #Registry.HubBuilder.PlotModels == #MapLayout.Plots
	end)
	try("Pickups spawned", function()
		local n = #Workspace.Pickups:GetChildren()
		return n > 50, tostring(n) .. " pickups"
	end)
	-- cleaning engine
	try("CleanSegment cleans dirty cells and changes terrain", function()
		local list = Registry.SectorService.ByZone.dusty_flats
		local target
		for _, s in list do
			if s.Dirty > 20 then
				target = s
				break
			end
		end
		if not target then
			return false, "no dirty sector"
		end
		local i
		for _, c in target.Cells do
			if WorldGrid.GetState(c) == WorldGrid.DIRTY then
				i = c
				break
			end
		end
		local ix, iz = MapLayout.FromLinear(i)
		local x, z = MapLayout.CellCenter(ix, iz)
		local h = WorldGrid.GetHeight(i)
		local p = Vector3.new(x, h, z)
		local before = target.Dirty
		local res = Registry.SectorService:CleanSegment(p, p, 4, { Depth = 1, MaxKg = 100 })
		local mat = Workspace.Terrain:ReadVoxels(Region3.new(Vector3.new(x - 2, h - 4, z - 2), Vector3.new(x + 2, h, z + 2)):ExpandToGrid(4), 4)[1][1][1]
		Registry.SectorService:Regrow(target)
		return res.Cells > 0 and res.Kg > 0 and target.Dirty == target.Total and before >= res.Cells, string.format("%d cells, %.3f kg, voxel=%s", res.Cells, res.Kg, tostring(mat))
	end)
	-- formulas
	try("Formulas sane", function()
		local fake = { Upgrades = { wide_head = 5, dust_compactor = 5 }, Perks = {}, Zones = { dusty_flats = true }, EquippedTool = "household_broom", EquippedContainer = "steel_canister", Rebirths = 1 }
		local stats = Formulas.ToolStats(fake)
		local cap = Formulas.Capacity(fake)
		return stats.Width > 8 and cap > 10 and Formulas.XpToNext(10) > Formulas.XpToNext(1) and Formulas.SellMultiplier(fake) >= 1.5,
			string.format("width %.1f cap %.1f", stats.Width, cap)
	end)
	-- live player flow
	if player and Registry.DataService:Get(player) then
		local profile = Registry.DataService:Get(player)
		try("Player profile loaded", function()
			return profile.Level >= 1 and profile.Tools.toothbrush == true
		end)
		try("Player has a base plot", function()
			return Registry.BaseService:HasPlot(player)
		end)
		try("Request router: unknown action rejected", function()
			local r = Registry.Router.Invoke(player, "Nope", {})
			return r.Ok == false
		end)
		try("Placement validator rejects out-of-bounds", function()
			local ok = Registry.BaseService:CanPlace(player, profile, "solar_post", 30, 30, 0, true)
			return ok == false
		end)
	end

	local summary = string.format("SelfTest: %d passed, %d failed", pass, fail)
	print("==================== LUNAR SWEEP SELF TEST ====================")
	for _, line in results do
		print(line)
	end
	print(summary)
	print("===============================================================")
	ServerScriptService:SetAttribute("SelfTestResult", summary)
	return summary
end

function SelfTest:Init() end

function SelfTest:Start()
	if RunService:IsStudio() and ServerScriptService:GetAttribute("RunSelfTests") then
		task.spawn(function()
			Registry.WorldService:WaitReady()
			task.wait(6)
			local player = Players:GetPlayers()[1]
			self:Run(player)
		end)
	end
end

return SelfTest
