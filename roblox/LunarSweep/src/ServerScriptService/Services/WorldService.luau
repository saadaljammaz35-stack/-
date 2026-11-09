--!nonstrict
-- Orchestrates world generation at server start and exposes world metadata
-- (zone spawn points, readiness). Clients show a loading screen until
-- workspace:GetAttribute("WorldReady") is true.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")
local Players = game:GetService("Players")

local Shared = ReplicatedStorage.Shared
local MapLayout = require(Shared.MapLayout)
local Zones = require(Shared.Config.Zones)
local Signal = require(Shared.Util.Signal)
local Net = require(Shared.Net)

local Registry = require(script.Parent.Registry)
local WorldGrid = require(script.Parent.WorldGrid)
local TerrainGenerator = require(script.Parent.TerrainGenerator)
local HubBuilder = require(script.Parent.HubBuilder)
local WorldDecor = require(script.Parent.WorldDecor)

local WorldService = {}

WorldService.Ready = false
WorldService.ReadySignal = Signal.new()
WorldService.ZoneSpawns = {} :: { [string]: Vector3 }
WorldService.HubSpawn = Vector3.new(0, 4, 0)

local function setProgress(p: number, text: string)
	Workspace:SetAttribute("WorldGenProgress", p)
	Workspace:SetAttribute("WorldGenStatus", text)
end

local function computeSpawns()
	for _, zone in Zones.List do
		local pos: Vector3
		if zone.Id == "orbital_ring" then
			local a = MapLayout.Asteroids[1]
			pos = Vector3.new(a.X + 20, MapLayout.ORBIT_Y + a.TopOffset + 5, a.Z + 20)
		elseif zone.Id == "crystal_caverns" then
			local c = MapLayout.CaveChambers[1]
			pos = Vector3.new(c.X, c.Floor + 5, c.Z)
		else
			local x, z = zone.SpawnXZ[1], zone.SpawnXZ[2]
			pos = Vector3.new(x, TerrainGenerator.Sample(x, z) + 5, z)
		end
		WorldService.ZoneSpawns[zone.Id] = pos
	end
end

function WorldService:GetSpawn(zoneId: string): Vector3
	if zoneId == "hub" then
		return self.HubSpawn
	end
	return self.ZoneSpawns[zoneId] or self.HubSpawn
end

-- Ground height at a position (uses the cell grid; hub/unknown -> 0)
function WorldService:GroundAt(x: number, z: number, nearY: number?): number
	local ix, iz = MapLayout.CellIndex(x, z)
	if not ix or not iz then
		return 0
	end
	local i = MapLayout.Linear(ix, iz)
	local h = WorldGrid.GetHeight(i)
	if nearY and math.abs(h - nearY) > 60 then
		-- different layer (e.g. hub floor under an asteroid): use the surface function
		local s = TerrainGenerator.Sample(x, z)
		if math.abs(s - nearY) < math.abs(h - nearY) then
			return s
		end
	end
	return h
end

function WorldService:WorldInfo(): any
	local spawns = {}
	for id, p in self.ZoneSpawns do
		spawns[id] = p
	end
	return { Spawns = spawns }
end

function WorldService:Init()
	for _, name in { "Pickups", "Capsules", "Robots", "Bases", "Relics", "FX" } do
		local f = Instance.new("Folder")
		f.Name = name
		f.Parent = Workspace
	end
	Workspace:SetAttribute("WorldReady", false)
	setProgress(0, "Preparing launch")
end

function WorldService:Start()
	task.spawn(function()
		local ok, err = pcall(function()
			TerrainGenerator.Generate(setProgress)
			setProgress(0.84, "Building Tranquility Colony")
			HubBuilder.Build(function(x, z)
				return (TerrainGenerator.Sample(x, z))
			end)
			setProgress(0.9, "Scattering debris")
			WorldDecor.Build()
			computeSpawns()
			setProgress(0.95, "Mapping sectors")
			Registry.SectorService:BuildSectors()
		end)
		if not ok then
			warn("[WorldService] World generation failed: " .. tostring(err) .. "\n" .. debug.traceback())
		end
		setProgress(1, "Ready")
		WorldService.Ready = true
		Workspace:SetAttribute("WorldReady", true)
		WorldService.ReadySignal:Fire()
		local info = WorldService:WorldInfo()
		Net.Event("WorldInfo"):FireAllClients(info)
	end)

	Players.PlayerAdded:Connect(function(player)
		if WorldService.Ready then
			task.delay(1, function()
				if player.Parent then
					Net.Event("WorldInfo"):FireClient(player, WorldService:WorldInfo())
				end
			end)
		end
	end)
end

-- Waits (yielding) until the world finished generating
function WorldService:WaitReady()
	while not self.Ready do
		task.wait(0.25)
	end
end

return WorldService
