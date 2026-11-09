--!nonstrict
-- Sectors + the actual terrain cleaning.
--
-- CleanSegment(p0, p1, radius, opts) marks every dirty cell whose centre lies within
-- `radius` of the segment p0->p1 (and near the given height) as clean, replaces the dirty
-- terrain material with the clean one in row-runs (few ReplaceMaterial calls), updates
-- sector counts and returns the dust collected. Players and robots both use it.
--
-- Sectors regrow dust after they have been fully clean for the zone's RegrowSeconds (or
-- when nearly clean and idle), so a server never runs out of moon to clean.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")
local Players = game:GetService("Players")

local Shared = ReplicatedStorage.Shared
local MapLayout = require(Shared.MapLayout)
local Zones = require(Shared.Config.Zones)
local Signal = require(Shared.Util.Signal)
local Net = require(Shared.Net)
local WorldGrid = require(script.Parent.WorldGrid)

local SectorService = {}

local N = MapLayout.N
local CELL = MapLayout.CELL
local DIRTY, CLEAN = WorldGrid.DIRTY, WorldGrid.CLEAN
local terrain: Terrain = Workspace.Terrain

export type Sector = {
	Id: number,
	Key: number,
	Zone: number,
	ZoneId: string,
	Q: number,
	R: number,
	Number: number,
	Cells: { number },
	Total: number,
	Dirty: number,
	Center: Vector3,
	LastActivity: number,
	ClearedAt: number,
	Contrib: { [number]: number },
}

SectorService.Sectors = {} :: { Sector }
SectorService.ByZone = {} :: { [string]: { Sector } }
SectorService.SectorCleared = Signal.new() -- (sector, contributions {userId -> cells})
SectorService.Built = false

local changed: { [number]: boolean } = {}
local zoneDefsByIndex: { [number]: any } = {}
for _, z in Zones.List do
	zoneDefsByIndex[z.Index] = z
end

------------------------------------------------------------------ build

function SectorService:BuildSectors()
	local byKey: { [number]: Sector } = {}
	local list: { Sector } = {}
	for iz = 0, N - 1 do
		for ix = 0, N - 1 do
			local i = iz * N + ix
			local st = WorldGrid.GetState(i)
			if st ~= 0 then
				local zi = WorldGrid.GetZone(i)
				local x, z = MapLayout.CellCenter(ix, iz)
				local q, r = MapLayout.HexAt(x, z)
				local key = MapLayout.SectorKey(zi, q, r)
				local s = byKey[key]
				if not s then
					local zone = zoneDefsByIndex[zi]
					local cx, cz = MapLayout.HexCenter(q, r)
					s = {
						Id = #list + 1,
						Key = key,
						Zone = zi,
						ZoneId = zone and zone.Id or "hub",
						Q = q,
						R = r,
						Number = 0,
						Cells = {},
						Total = 0,
						Dirty = 0,
						Center = Vector3.new(cx, WorldGrid.GetHeight(i), cz),
						LastActivity = 0,
						ClearedAt = 0,
						Contrib = {},
					}
					byKey[key] = s
					table.insert(list, s)
				end
				table.insert(s.Cells, i)
				s.Total += 1
				if st == DIRTY then
					s.Dirty += 1
				end
			end
		end
	end
	-- drop tiny slivers (merge-free: just make their cells non-cleanable)
	local final: { Sector } = {}
	for _, s in list do
		if s.Total >= 25 then
			table.insert(final, s)
		else
			for _, i in s.Cells do
				WorldGrid.SetState(i, 0)
			end
		end
	end
	local perZone: { [number]: number } = {}
	for id, s in final do
		s.Id = id
		perZone[s.Zone] = (perZone[s.Zone] or 0) + 1
		s.Number = s.Zone * 100 + perZone[s.Zone]
		-- average height of the sector for markers
		local sum = 0
		for _, i in s.Cells do
			WorldGrid.SetSector(i, id)
			sum += WorldGrid.GetHeight(i)
		end
		s.Center = Vector3.new(s.Center.X, sum / s.Total, s.Center.Z)
		local zl = self.ByZone[s.ZoneId]
		if not zl then
			zl = {}
			self.ByZone[s.ZoneId] = zl
		end
		table.insert(zl, s)
	end
	self.Sectors = final
	self.Built = true
	print(string.format("[SectorService] %d sectors built", #final))
	if Players then
		Net.Event("SectorSnapshot"):FireAllClients(self:Snapshot())
	end
end

function SectorService:Permille(s: Sector): number
	if s.Total == 0 then
		return 1000
	end
	return math.floor((1 - s.Dirty / s.Total) * 1000 + 0.5)
end

function SectorService:Snapshot(): { any }
	local out = {}
	for _, s in self.Sectors do
		out[s.Id] = { s.Zone, s.Q, s.R, s.Number, s.Total, self:Permille(s), s.Center.Y }
	end
	return out
end

function SectorService:Get(id: number): Sector?
	return self.Sectors[id]
end

------------------------------------------------------------------ cleaning

local function distToSegment2(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number
	local abx, abz = bx - ax, bz - az
	local len2 = abx * abx + abz * abz
	local t = 0
	if len2 > 1e-6 then
		t = math.clamp(((px - ax) * abx + (pz - az) * abz) / len2, 0, 1)
	end
	local dx, dz = px - (ax + abx * t), pz - (az + abz * t)
	return dx * dx + dz * dz
end

local function flushRun(zoneIndex: number, iz: number, ixStart: number, ixEnd: number, minH: number, maxH: number, toClean: boolean)
	local zone = zoneDefsByIndex[zoneIndex]
	if not zone then
		return
	end
	local x0 = ixStart * CELL - MapLayout.HALF
	local x1 = (ixEnd + 1) * CELL - MapLayout.HALF
	local z0 = iz * CELL - MapLayout.HALF
	local z1 = z0 + CELL
	local y0 = math.floor((minH - 10) / 4) * 4
	local y1 = math.ceil((maxH + 6) / 4) * 4
	local region = Region3.new(Vector3.new(x0, y0, z0), Vector3.new(x1, y1, z1))
	if toClean then
		terrain:ReplaceMaterial(region, 4, zone.DirtyMaterial, zone.CleanMaterial)
	else
		terrain:ReplaceMaterial(region, 4, zone.CleanMaterial, zone.DirtyMaterial)
	end
end

export type CleanOpts = {
	Depth: number, -- kg multiplier
	Surge: number?, -- chance for double dust per cell
	MaxKg: number, -- capacity remaining
	UserId: number?, -- contributor (player or robot owner)
	Unlocked: { [string]: boolean }?, -- zones the cleaner may clean
	KgMult: ((string) -> number)?, -- per-zone event multiplier
	MaxHeightDiff: number?,
}

export type CleanResult = { Cells: number, Kg: number, ByRes: { [string]: number }, Zone: string?, Full: boolean }

function SectorService:CleanSegment(p0: Vector3, p1: Vector3, radius: number, opts: CleanOpts): CleanResult
	local result: CleanResult = { Cells = 0, Kg = 0, ByRes = {}, Zone = nil, Full = false }
	if not self.Built or opts.MaxKg <= 0 then
		result.Full = opts.MaxKg <= 0
		return result
	end
	local r = math.max(radius, 1.2)
	local r2 = (r + CELL * 0.35) ^ 2
	local minX = math.min(p0.X, p1.X) - r
	local maxX = math.max(p0.X, p1.X) + r
	local minZ = math.min(p0.Z, p1.Z) - r
	local maxZ = math.max(p0.Z, p1.Z) + r
	local ix0, iz0 = MapLayout.CellIndex(math.max(minX, -MapLayout.HALF), math.max(minZ, -MapLayout.HALF))
	local ix1, iz1 = MapLayout.CellIndex(math.min(maxX, MapLayout.HALF - 0.01), math.min(maxZ, MapLayout.HALF - 0.01))
	if not ix0 or not iz0 or not ix1 or not iz1 then
		return result
	end
	local yRef = (p0.Y + p1.Y) / 2
	local maxDy = opts.MaxHeightDiff or 14
	local surge = opts.Surge or 0
	local now = os.clock()
	local budget = opts.MaxKg
	local rng = Random.new()
	for iz = iz0, iz1 do
		local runStart, runEnd, runZone, runMin, runMax = nil, nil, nil, 0, 0
		for ix = ix0, ix1 do
			local i = iz * N + ix
			local cleanedHere = false
			if budget > 0 and WorldGrid.GetState(i) == DIRTY then
				local cx = ix * CELL - MapLayout.HALF + CELL / 2
				local cz = iz * CELL - MapLayout.HALF + CELL / 2
				local h = WorldGrid.GetHeight(i)
				if math.abs(h - yRef) <= maxDy and distToSegment2(cx, cz, p0.X, p0.Z, p1.X, p1.Z) <= r2 then
					local zi = WorldGrid.GetZone(i)
					local zone = zoneDefsByIndex[zi]
					if zone and (not opts.Unlocked or opts.Unlocked[zone.Id]) then
						local kg = zone.DustPerCell * opts.Depth
						if surge > 0 and rng:NextNumber() < surge then
							kg *= 2
						end
						if opts.KgMult then
							kg *= opts.KgMult(zone.Id)
						end
						budget -= kg
						result.Kg += kg
						result.Cells += 1
						result.ByRes[zone.DustResource] = (result.ByRes[zone.DustResource] or 0) + kg
						result.Zone = zone.Id
						WorldGrid.SetState(i, CLEAN)
						local sid = WorldGrid.GetSector(i)
						local s = self.Sectors[sid]
						if s then
							s.Dirty -= 1
							s.LastActivity = now
							if opts.UserId then
								s.Contrib[opts.UserId] = (s.Contrib[opts.UserId] or 0) + 1
							end
							changed[sid] = true
							if s.Dirty <= 0 then
								s.Dirty = 0
								s.ClearedAt = now
								task.defer(function()
									local contrib = s.Contrib
									s.Contrib = {}
									SectorService.SectorCleared:Fire(s, contrib)
								end)
							end
						end
						cleanedHere = true
						if runStart and runZone == zi then
							runEnd = ix
							runMin = math.min(runMin, h)
							runMax = math.max(runMax, h)
						else
							if runStart then
								flushRun(runZone, iz, runStart, runEnd, runMin, runMax, true)
							end
							runStart, runEnd, runZone, runMin, runMax = ix, ix, zi, h, h
						end
					end
				end
			end
			if not cleanedHere and runStart then
				flushRun(runZone, iz, runStart, runEnd, runMin, runMax, true)
				runStart = nil
			end
		end
		if runStart then
			flushRun(runZone, iz, runStart, runEnd, runMin, runMax, true)
		end
	end
	result.Full = budget <= 0
	return result
end

-- Find a dirty cell in a zone near `from` (robot targeting). Returns world position or nil.
function SectorService:FindDirtyTarget(zoneId: string, from: Vector3, tries: number?): Vector3?
	local list = self.ByZone[zoneId]
	if not list or #list == 0 then
		return nil
	end
	local rng = Random.new()
	-- prefer the dirty sector nearest to `from` among a random sample
	local bestSector, bestDist = nil, math.huge
	for _ = 1, math.min(10, #list) do
		local s = list[rng:NextInteger(1, #list)]
		if s.Dirty > 0 then
			local d = (s.Center - from).Magnitude
			if d < bestDist then
				bestSector, bestDist = s, d
			end
		end
	end
	if not bestSector then
		for _, s in list do
			if s.Dirty > 0 then
				bestSector = s
				break
			end
		end
	end
	if not bestSector then
		return nil
	end
	local best, bd = nil, math.huge
	for _ = 1, tries or 24 do
		local i = bestSector.Cells[rng:NextInteger(1, #bestSector.Cells)]
		if WorldGrid.GetState(i) == DIRTY then
			local ix, iz = MapLayout.FromLinear(i)
			local x, z = MapLayout.CellCenter(ix, iz)
			local p = Vector3.new(x, WorldGrid.GetHeight(i), z)
			local d = (p - from).Magnitude
			if d < bd then
				best, bd = p, d
			end
		end
	end
	return best
end

------------------------------------------------------------------ regrowth

function SectorService:Regrow(s: Sector)
	local cells = s.Cells
	local runStart, runEnd, runIz, runMin, runMax = nil, nil, -1, 0, 0
	for _, i in cells do
		if WorldGrid.GetState(i) == CLEAN then
			WorldGrid.SetState(i, DIRTY)
			local ix, iz = MapLayout.FromLinear(i)
			local h = WorldGrid.GetHeight(i)
			if runStart and iz == runIz and ix == runEnd + 1 then
				runEnd = ix
				runMin = math.min(runMin, h)
				runMax = math.max(runMax, h)
			else
				if runStart then
					flushRun(s.Zone, runIz, runStart, runEnd, runMin, runMax, false)
				end
				runStart, runEnd, runIz, runMin, runMax = ix, ix, iz, h, h
			end
		end
	end
	if runStart then
		flushRun(s.Zone, runIz, runStart, runEnd, runMin, runMax, false)
	end
	s.Dirty = s.Total
	s.ClearedAt = 0
	s.Contrib = {}
	changed[s.Id] = true
end

-- Re-dirty the cleanest sectors of a zone (dust storm event). Returns sectors affected.
function SectorService:DustStorm(zoneId: string, fraction: number): number
	local list = self.ByZone[zoneId]
	if not list then
		return 0
	end
	local sorted = table.clone(list)
	table.sort(sorted, function(a, b)
		return a.Dirty / a.Total < b.Dirty / b.Total
	end)
	local n = math.max(1, math.floor(#sorted * fraction))
	local count = 0
	for i = 1, n do
		local s = sorted[i]
		if s.Dirty < s.Total then
			self:Regrow(s)
			count += 1
			if count % 4 == 0 then
				task.wait()
			end
		end
	end
	return count
end

function SectorService:ZoneCleanliness(zoneId: string): number
	local list = self.ByZone[zoneId]
	if not list then
		return 0
	end
	local total, dirty = 0, 0
	for _, s in list do
		total += s.Total
		dirty += s.Dirty
	end
	return total > 0 and (1 - dirty / total) or 0
end

function SectorService:Init() end

function SectorService:Start()
	-- replication of changed sectors (batched)
	task.spawn(function()
		local event = Net.Event("SectorUpdate")
		while true do
			task.wait(0.5)
			if next(changed) then
				local delta = {}
				for sid in changed do
					local s = self.Sectors[sid]
					if s then
						delta[sid] = self:Permille(s)
					end
				end
				table.clear(changed)
				event:FireAllClients(delta)
			end
		end
	end)
	-- regrowth loop
	task.spawn(function()
		while true do
			task.wait(20)
			if self.Built then
				local now = os.clock()
				local processed = 0
				for _, s in self.Sectors do
					local zone = zoneDefsByIndex[s.Zone]
					local regrow = zone and zone.RegrowSeconds or 480
					if s.Dirty < s.Total then
						local cleanFrac = 1 - s.Dirty / s.Total
						if (s.Dirty == 0 and now - s.ClearedAt > regrow) or (cleanFrac > 0.9 and now - s.LastActivity > regrow * 0.8) or (cleanFrac > 0.5 and now - s.LastActivity > regrow * 2) then
							self:Regrow(s)
							processed += 1
							if processed % 3 == 0 then
								task.wait()
							end
						end
					end
				end
			end
		end
	end)
	-- send the snapshot to late joiners
	Players.PlayerAdded:Connect(function(player)
		task.spawn(function()
			while not self.Built do
				task.wait(0.5)
			end
			task.wait(1)
			if player.Parent then
				Net.Event("SectorSnapshot"):FireClient(player, self:Snapshot())
			end
		end)
	end)
end

return SectorService
