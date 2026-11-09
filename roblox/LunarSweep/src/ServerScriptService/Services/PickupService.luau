--!nonstrict
-- Debris pickups scattered over every zone (rarer items are worth much more).
-- Pickups live in a spatial hash so a stroke can query nearby pickups cheaply.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local MapLayout = require(Shared.MapLayout)
local Zones = require(Shared.Config.Zones)
local Resources = require(Shared.Config.Resources)
local Rarity = require(Shared.Config.Rarity)
local ModelFactory = require(Shared.ModelFactory)
local WorldGrid = require(script.Parent.WorldGrid)
local Registry = require(script.Parent.Registry)

local PickupService = {}

local BIN = 32

type Pickup = { Id: number, Res: string, Zone: string, Pos: Vector3, Model: Model, Bin: number, Special: string?, Expires: number? }

local pickups: { [number]: Pickup } = {}
local bins: { [number]: { [number]: Pickup } } = {}
local countByZone: { [string]: number } = {}
local nextId = 0
local folder: Folder

local function binKey(x: number, z: number): number
	return (math.floor(x / BIN) + 200) * 1000 + (math.floor(z / BIN) + 200)
end

local function cellsForZone(zone): { number }
	-- sample candidate cells lazily (all cleanable cells of the zone)
	local list = {}
	for _, s in Registry.SectorService.ByZone[zone.Id] or {} do
		for _, i in s.Cells do
			table.insert(list, i)
		end
	end
	return list
end

local zoneCells: { [string]: { number } } = {}

local function pickResource(zone, luck: number, rng: Random): string
	local total = 0
	local weights = {}
	for _, d in zone.Debris do
		local def = Resources.ById[d.Id]
		local w = d.Weight
		if def and Rarity.Get(def.Rarity).Order >= 3 then
			w *= (1 + luck)
		end
		weights[d.Id] = w
		total += w
	end
	local r = rng:NextNumber() * total
	for _, d in zone.Debris do
		r -= weights[d.Id]
		if r <= 0 then
			return d.Id
		end
	end
	return zone.Debris[1].Id
end

function PickupService:Spawn(zoneId: string, resId: string, pos: Vector3, special: string?, lifetime: number?): Pickup
	nextId += 1
	local model = ModelFactory.Pickup(resId)
	model.Name = "Pickup"
	model:PivotTo(CFrame.new(pos) * CFrame.Angles(0, math.random() * math.pi * 2, 0))
	model:SetAttribute("PickupId", nextId)
	model.Parent = folder
	local key = binKey(pos.X, pos.Z)
	local p: Pickup = { Id = nextId, Res = resId, Zone = zoneId, Pos = pos, Model = model, Bin = key, Special = special, Expires = lifetime and (os.clock() + lifetime) or nil }
	pickups[nextId] = p
	local b = bins[key]
	if not b then
		b = {}
		bins[key] = b
	end
	b[nextId] = p
	countByZone[zoneId] = (countByZone[zoneId] or 0) + 1
	return p
end

function PickupService:Remove(p: Pickup)
	if not pickups[p.Id] then
		return
	end
	pickups[p.Id] = nil
	local b = bins[p.Bin]
	if b then
		b[p.Id] = nil
	end
	countByZone[p.Zone] = math.max(0, (countByZone[p.Zone] or 1) - 1)
	p.Model:Destroy()
end

function PickupService:RandomPosition(zoneId: string, rng: Random?): Vector3?
	local cells = zoneCells[zoneId]
	if not cells or #cells == 0 then
		local zone = Zones.ById[zoneId]
		if not zone then
			return nil
		end
		cells = cellsForZone(zone)
		zoneCells[zoneId] = cells
		if #cells == 0 then
			return nil
		end
	end
	local r = rng or Random.new()
	local i = cells[r:NextInteger(1, #cells)]
	local ix, iz = MapLayout.FromLinear(i)
	local x, z = MapLayout.CellCenter(ix, iz)
	return Vector3.new(x + r:NextNumber(-1.5, 1.5), WorldGrid.GetHeight(i) + 0.1, z + r:NextNumber(-1.5, 1.5))
end

function PickupService:SpawnRandom(zoneId: string, rng: Random?): Pickup?
	local zone = Zones.ById[zoneId]
	if not zone then
		return nil
	end
	local r = rng or Random.new()
	local pos = self:RandomPosition(zoneId, r)
	if not pos then
		return nil
	end
	return self:Spawn(zoneId, pickResource(zone, 0, r), pos)
end

-- Collect pickups within radius of pos. Returns list of { Res, Kg, Pos, Rarity, Special }.
-- `luck` re-rolls each collected common item into a rare one of its zone with that chance.
function PickupService:CollectNear(pos: Vector3, radius: number, maxKg: number, luck: number, unlocked: { [string]: boolean }?, kgMult: number?): { any }
	local out = {}
	if maxKg <= 0 then
		return out
	end
	local r2 = radius * radius
	local rng = Random.new()
	for bx = math.floor((pos.X - radius) / BIN), math.floor((pos.X + radius) / BIN) do
		for bz = math.floor((pos.Z - radius) / BIN), math.floor((pos.Z + radius) / BIN) do
			local b = bins[(bx + 200) * 1000 + (bz + 200)]
			if b then
				for _, p in b do
					local d = p.Pos - pos
					if d.X * d.X + d.Z * d.Z <= r2 and math.abs(d.Y) < 16 and (not unlocked or unlocked[p.Zone]) then
						local resId = p.Res
						-- luck upgrade: chance to upgrade a common find into the zone's rarest debris
						local def = Resources.ById[resId]
						if luck > 0 and def and Rarity.Get(def.Rarity).Order < 3 and rng:NextNumber() < luck * 0.12 then
							local zone = Zones.ById[p.Zone]
							if zone then
								resId = zone.Debris[#zone.Debris].Id
								def = Resources.ById[resId]
							end
						end
						local kg = (def and def.Kg or 0.1) * (kgMult or 1)
						if kg <= maxKg then
							maxKg -= kg
							table.insert(out, { Res = resId, Kg = kg, Pos = p.Pos, Rarity = def and def.Rarity or "Common", Special = p.Special })
							self:Remove(p)
						end
					end
				end
			end
		end
	end
	return out
end

-- Nearest pickup in a zone (robot collectors)
function PickupService:NearestInZone(zoneId: string, from: Vector3, maxDist: number?): any?
	local best, bd = nil, (maxDist or math.huge) ^ 2
	for _, p in pickups do
		if p.Zone == zoneId then
			local d = p.Pos - from
			local m = d.X * d.X + d.Z * d.Z
			if m < bd then
				best, bd = p, m
			end
		end
	end
	return best
end

function PickupService:Count(zoneId: string): number
	return countByZone[zoneId] or 0
end

-- Meteor shower: fresh meteorites rain into a zone for a limited time
function PickupService:MeteorShower(zoneId: string, count: number, lifetime: number): { Vector3 }
	local positions = {}
	local rng = Random.new()
	for _ = 1, count do
		local pos = self:RandomPosition(zoneId, rng)
		if pos then
			self:Spawn(zoneId, "meteorite", pos, "Meteor", lifetime)
			table.insert(positions, pos)
		end
	end
	return positions
end

function PickupService:Init()
	folder = Workspace:WaitForChild("Pickups") :: Folder
end

function PickupService:Start()
	task.spawn(function()
		Registry.WorldService:WaitReady()
		local rng = Random.new()
		-- initial population
		for _, zone in Zones.List do
			for _ = 1, zone.PickupCount do
				self:SpawnRandom(zone.Id, rng)
			end
			task.wait()
		end
		-- maintenance loop: respawn and expire
		while true do
			task.wait(4)
			local now = os.clock()
			for _, p in pickups do
				if p.Expires and now > p.Expires then
					self:Remove(p)
				end
			end
			local frenzy = Registry.EventService and Registry.EventService:IsActive("DebrisFrenzy")
			for _, zone in Zones.List do
				local target = zone.PickupCount * (frenzy and 2 or 1)
				local have = countByZone[zone.Id] or 0
				local add = math.min(frenzy and 6 or 2, target - have)
				for _ = 1, add do
					self:SpawnRandom(zone.Id, rng)
				end
			end
		end
	end)
end

return PickupService
