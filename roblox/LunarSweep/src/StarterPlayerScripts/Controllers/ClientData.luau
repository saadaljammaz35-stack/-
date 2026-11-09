--!nonstrict
-- Client-side replica of the player's profile plus shared world state (sectors, base
-- status, server events). Everything in the UI reads from here.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Signal = require(Shared.Util.Signal)
local MapLayout = require(Shared.MapLayout)
local Net = require(Shared.Net)

local ClientData = {}

ClientData.Profile = nil :: any
ClientData.Loaded = false
ClientData.LoadedSignal = Signal.new()
ClientData.Changed = Signal.new() -- (key)
ClientData.UsingMemory = false

ClientData.Sectors = {} :: { [number]: any }
ClientData.SectorByKey = {} :: { [number]: number }
ClientData.SectorChanged = Signal.new() -- (id | nil for all)

ClientData.BaseStatus = nil :: any
ClientData.BaseChanged = Signal.new()

ClientData.ServerEvent = nil :: any
ClientData.ServerEventChanged = Signal.new()
ClientData.ServerTimeOffset = 0

ClientData.WorldInfo = nil :: any
ClientData.WorldInfoChanged = Signal.new()

function ClientData:Get(key: string): any
	return self.Profile and self.Profile[key]
end

-- Connect to a set of keys; fn runs immediately if loaded and on every change.
function ClientData:Watch(keys: { string }, fn: () -> ())
	local set = {}
	for _, k in keys do
		set[k] = true
	end
	local conn = self.Changed:Connect(function(key)
		if key == "*" or set[key] then
			fn()
		end
	end)
	if self.Loaded then
		task.spawn(fn)
	end
	return conn
end

function ClientData:ServerTime(): number
	return os.time() + self.ServerTimeOffset
end

function ClientData:SectorAt(pos: Vector3): (number?, any?)
	local zoneId = MapLayout.ZoneAt(pos)
	local zoneIndex = 0
	if zoneId ~= "hub" then
		local Zones = require(Shared.Config.Zones)
		local z = Zones.ById[zoneId]
		zoneIndex = z and z.Index or 0
	end
	local q, r = MapLayout.HexAt(pos.X, pos.Z)
	local id = self.SectorByKey[MapLayout.SectorKey(zoneIndex, q, r)]
	return id, id and self.Sectors[id]
end

function ClientData:Init()
	Net.Event("DataSync").OnClientEvent:Connect(function(profile, meta)
		self.Profile = profile
		self.UsingMemory = meta and meta.UsingMemory or false
		local first = not self.Loaded
		self.Loaded = true
		if first then
			self.LoadedSignal:Fire()
		end
		self.Changed:Fire("*")
	end)
	Net.Event("DataDelta").OnClientEvent:Connect(function(delta)
		if not self.Profile then
			return
		end
		for k, v in delta do
			self.Profile[k] = v
		end
		for k in delta do
			self.Changed:Fire(k)
		end
	end)
	Net.Event("SectorSnapshot").OnClientEvent:Connect(function(snapshot)
		self.Sectors = {}
		self.SectorByKey = {}
		for id, s in snapshot do
			local entry = { Id = id, Zone = s[1], Q = s[2], R = s[3], Number = s[4], Total = s[5], Permille = s[6], Y = s[7] }
			self.Sectors[id] = entry
			self.SectorByKey[MapLayout.SectorKey(entry.Zone, entry.Q, entry.R)] = id
		end
		self.SectorChanged:Fire(nil)
	end)
	Net.Event("SectorUpdate").OnClientEvent:Connect(function(delta)
		for key, permille in delta do
			-- sparse numeric keys may arrive as strings over the network
			local id = tonumber(key)
			local s = id and self.Sectors[id]
			if s then
				s.Permille = permille
				self.SectorChanged:Fire(id)
			end
		end
	end)
	Net.Event("BaseStatus").OnClientEvent:Connect(function(status)
		self.BaseStatus = status
		self.BaseChanged:Fire()
	end)
	Net.Event("ServerEvent").OnClientEvent:Connect(function(state)
		self.ServerEvent = state
		if state.ServerTime then
			self.ServerTimeOffset = state.ServerTime - os.time()
		end
		self.ServerEventChanged:Fire()
	end)
	Net.Event("WorldInfo").OnClientEvent:Connect(function(info)
		self.WorldInfo = info
		self.WorldInfoChanged:Fire()
	end)
end

function ClientData:Start()
	local _ = Players
end

return ClientData
