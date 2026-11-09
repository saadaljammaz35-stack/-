--!nonstrict
-- Procedural lunar terrain written with Terrain:WriteVoxels at server start.
--
-- 1. A height function per zone (fbm noise + craters + zone features), blended to a shared
--    height near zone borders, plus mountain ridges along borders with passes in the middle.
-- 2. Each 4x4 column gets a surface material: the zone's DIRTY material where the ground is
--    cleanable, rock elsewhere. Cleaning swaps dirty -> clean material with ReplaceMaterial.
-- 3. Crystal Caverns: chambers, tunnels and entrance ramps carved below the highlands.
-- 4. Orbital Ring: flat-topped asteroids floating above the hub.
-- Results are written into WorldGrid (heights, cleanable state, zone index).

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local MapLayout = require(Shared.MapLayout)
local Zones = require(Shared.Config.Zones)
local WorldGrid = require(script.Parent.WorldGrid)

local TerrainGenerator = {}

local N = MapLayout.N
local CELL = MapLayout.CELL
local HALF = MapLayout.HALF
local SEED = 1969

local RIDGE_W = 44
local RIDGE_H = 30
local PASS_HALF = 34
local BLEND_W = 70

local terrain: Terrain = Workspace.Terrain

------------------------------------------------------------------ helpers

local function smoothstep(e0: number, e1: number, x: number): number
	local t = math.clamp((x - e0) / (e1 - e0), 0, 1)
	return t * t * (3 - 2 * t)
end

local function fbm(x: number, z: number, seed: number): number
	return math.noise(x, z, seed) + 0.5 * math.noise(x * 2.03, z * 2.03, seed + 11.7) + 0.25 * math.noise(x * 4.1, z * 4.1, seed + 23.1)
end

local function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number
	local abx, abz = bx - ax, bz - az
	local len2 = abx * abx + abz * abz
	local t = 0
	if len2 > 0 then
		t = math.clamp(((px - ax) * abx + (pz - az) * abz) / len2, 0, 1)
	end
	local cx, cz = ax + abx * t, az + abz * t
	return math.sqrt((px - cx) ^ 2 + (pz - cz) ^ 2)
end

------------------------------------------------------------------ crater sets

type Crater = { X: number, Z: number, R: number, D: number }

local craterBins: { [number]: { Crater } } = {}
local BIN = 64

local function binKey(bx: number, bz: number): number
	return (bx + 100) * 1000 + (bz + 100)
end

local function addCrater(c: Crater)
	local reach = c.R * 1.4
	for bx = math.floor((c.X - reach) / BIN), math.floor((c.X + reach) / BIN) do
		for bz = math.floor((c.Z - reach) / BIN), math.floor((c.Z + reach) / BIN) do
			local k = binKey(bx, bz)
			local list = craterBins[k]
			if not list then
				list = {}
				craterBins[k] = list
			end
			table.insert(list, c)
		end
	end
end

local function craterDelta(x: number, z: number): number
	local list = craterBins[binKey(math.floor(x / BIN), math.floor(z / BIN))]
	if not list then
		return 0
	end
	local total = 0
	for _, c in list do
		local d = math.sqrt((x - c.X) ^ 2 + (z - c.Z) ^ 2) / c.R
		if d < 1.4 then
			if d < 1 then
				total -= c.D * (1 - d * d)
			end
			total += c.D * 0.28 * math.exp(-((d - 1) / 0.17) ^ 2)
		end
	end
	return total
end

-- Ember Rift lava channels (polylines in world space)
local RIFTS = {
	{ Vector2.new(-740, 300), Vector2.new(-600, 420), Vector2.new(-520, 520), Vector2.new(-420, 640), Vector2.new(-300, 760) },
	{ Vector2.new(-280, 300), Vector2.new(-400, 420), Vector2.new(-520, 520), Vector2.new(-640, 700) },
	{ Vector2.new(-520, 520), Vector2.new(-500, 640), Vector2.new(-520, 760) },
}
TerrainGenerator.Rifts = RIFTS

local function riftDistance(x: number, z: number): number
	local best = math.huge
	for _, line in RIFTS do
		for i = 1, #line - 1 do
			local a, b = line[i], line[i + 1]
			local d = distToSegment(x, z, a.X, a.Y, b.X, b.Y)
			if d < best then
				best = d
			end
		end
	end
	return best
end

-- Frostbite ice spires (blocking pillars) - generated once
TerrainGenerator.Spires = {}

------------------------------------------------------------------ height function

-- returns height, cleanable(bool), zoneDef or nil, surfaceMaterial, rockMaterial
local function sample(x: number, z: number): (number, boolean, any, Enum.Material, Enum.Material)
	local zoneId = MapLayout.GridZoneAt(x, z)
	-- distance to the nearest internal zone border and position along it (for passes)
	local dxl = math.min(math.abs(x - 256), math.abs(x + 256))
	local dzl = math.min(math.abs(z - 256), math.abs(z + 256))
	local edgeDist = math.min(dxl, dzl)
	local along: number
	if dxl < dzl then
		along = math.abs(((z + HALF) % 512) - 256)
	else
		along = math.abs(((x + HALF) % 512) - 256)
	end
	local ridge = RIDGE_H * smoothstep(RIDGE_W, 0, edgeDist) * smoothstep(PASS_HALF * 0.6, PASS_HALF * 1.6, along)
	ridge += ridge * 0.25 * math.noise(x / 40, z / 40, SEED + 5)

	-- outer rim mountains at the map edge
	local outer = HALF - math.max(math.abs(x), math.abs(z))
	local rim = 60 * smoothstep(60, 0, outer)

	if zoneId == "hub" then
		local h = ridge + rim
		return h, false, nil, Enum.Material.Pavement, Enum.Material.Rock
	end

	local zone = Zones.ById[zoneId]
	local T = zone.Terrain
	local h = T.Base + T.Amp * fbm(x / T.Scale, z / T.Scale, SEED + zone.Index * 17)
	h += craterDelta(x, z)

	local surface = zone.DirtyMaterial
	local rock = zone.RockMaterial
	local cleanable = true

	if zoneId == "starfall_basin" then
		local d = math.sqrt((x + 512) ^ 2 + (z + 512) ^ 2) / 205
		if d < 1 then
			h -= 34 * (1 - d * d)
		end
		h += 9 * math.exp(-((d - 1) / 0.12) ^ 2)
		h += 26 * math.exp(-((d * 205) / 26) ^ 2) -- central peak
	elseif zoneId == "ember_rift" then
		local rd = riftDistance(x, z)
		if rd < 13 then
			h -= 16 * (1 - (rd / 13) ^ 2)
			if rd < 7 then
				surface = Enum.Material.CrackedLava
				cleanable = false
			end
		end
		-- the idol island where the rifts meet
		local id = math.sqrt((x + 520) ^ 2 + (z - 520) ^ 2)
		if id < 16 then
			h = math.max(h, T.Base + 6)
			surface = Enum.Material.Basalt
			cleanable = false
		end
	elseif zoneId == "crystal_caverns" then
		surface = Enum.Material.Basalt
		cleanable = false
	end

	-- blend to the shared border height (0) so zones meet without cliffs
	local blend = smoothstep(0, BLEND_W, edgeDist) * smoothstep(0, BLEND_W, outer)
	h = h * blend
	h += ridge + rim
	if edgeDist < RIDGE_W * 0.8 or outer < 50 then
		cleanable = false
	end
	return h, cleanable, zone, surface, rock
end

TerrainGenerator.Sample = sample

------------------------------------------------------------------ generation

local function buildCraters()
	local rng = Random.new(SEED)
	for _, zone in Zones.List do
		if zone.Grid then
			local x0, z0, x1, z1 = MapLayout.ZoneBounds(zone.Grid[1], zone.Grid[2])
			local T = zone.Terrain
			for _ = 1, T.Craters do
				local r = rng:NextNumber(T.CraterR[1], T.CraterR[2])
				addCrater({
					X = rng:NextNumber(x0 + 70 + r * 0.5, x1 - 70 - r * 0.5),
					Z = rng:NextNumber(z0 + 70 + r * 0.5, z1 - 70 - r * 0.5),
					R = r,
					D = rng:NextNumber(T.CraterD[1], T.CraterD[2]) * math.clamp(r / 30, 0.6, 1.4),
				})
			end
		end
	end
	-- feature craters
	addCrater({ X = 520, Z = -520, R = 110, D = 36 }) -- Pockmark giant crater (time capsule secret)
	addCrater({ X = -150, Z = -640, R = 26, D = 9 }) -- Dusty Flats hidden crater (forgotten flag)
	-- frost spires
	for i = 0, 7 do
		local a = math.rad(i * 45)
		table.insert(TerrainGenerator.Spires, { X = -60 + 34 * math.cos(a), Z = 640 + 34 * math.sin(a), R = 5, H = 34 + (i % 3) * 8 })
	end
	for _ = 1, 22 do
		table.insert(TerrainGenerator.Spires, { X = rng:NextNumber(-180, 180), Z = rng:NextNumber(340, 700), R = rng:NextNumber(3, 7), H = rng:NextNumber(18, 46) })
	end
end

local function chunkHasCaves(x0: number, z0: number): boolean
	return x0 + 64 > 256 and z0 + 64 > 256
end

function TerrainGenerator.Generate(progress: (number, string) -> ())
	local t0 = os.clock()
	terrain:Clear()
	pcall(function()
		-- no grass blades on the Grass/LeafyGrass dust materials (may be read-only at runtime)
		terrain.Decoration = false
		terrain.WaterWaveSize = 0
	end)
	-- material colours (global per material)
	terrain:SetMaterialColor(Enum.Material.Pavement, Color3.fromRGB(176, 180, 188))
	terrain:SetMaterialColor(Enum.Material.Rock, Color3.fromRGB(132, 134, 140))
	terrain:SetMaterialColor(Enum.Material.CrackedLava, Color3.fromRGB(255, 92, 30))
	for _, zone in Zones.List do
		terrain:SetMaterialColor(zone.DirtyMaterial, zone.DirtyColor)
		terrain:SetMaterialColor(zone.CleanMaterial, zone.CleanColor)
		if zone.RockMaterial ~= Enum.Material.CrackedLava then
			terrain:SetMaterialColor(zone.RockMaterial, zone.RockColor)
		end
	end

	buildCraters()

	-- pass 1: heights + flags for every column
	progress(0.02, "Mapping the surface")
	local heights = table.create(N * N, 0)
	local flags = buffer.create(N * N) -- bit0 cleanable
	local surfaceMat = table.create(N * N)
	local rockMat = table.create(N * N)
	local zoneIdx = buffer.create(N * N)
	for iz = 0, N - 1 do
		for ix = 0, N - 1 do
			local x, z = MapLayout.CellCenter(ix, iz)
			local h, cleanable, zone, surface, rock = sample(x, z)
			local i = iz * N + ix
			heights[i + 1] = h
			buffer.writeu8(flags, i, cleanable and 1 or 0)
			surfaceMat[i + 1] = surface
			rockMat[i + 1] = rock
			buffer.writeu8(zoneIdx, i, zone and zone.Index or 0)
		end
		if iz % 24 == 0 then
			task.wait()
		end
	end

	-- frost spires block cleaning under them
	for _, s in TerrainGenerator.Spires do
		local ix0, iz0 = MapLayout.CellIndex(s.X - s.R - 2, s.Z - s.R - 2)
		local ix1, iz1 = MapLayout.CellIndex(s.X + s.R + 2, s.Z + s.R + 2)
		if ix0 and iz0 and ix1 and iz1 then
			for iz = iz0, iz1 do
				for ix = ix0, ix1 do
					buffer.writeu8(flags, iz * N + ix, 0)
				end
			end
		end
	end

	-- pass 2: slope test + grid fill
	for iz = 0, N - 1 do
		for ix = 0, N - 1 do
			local i = iz * N + ix
			local h = heights[i + 1]
			local cleanable = buffer.readu8(flags, i) == 1
			if cleanable then
				local hx1 = heights[(iz * N + math.min(ix + 1, N - 1)) + 1]
				local hx0 = heights[(iz * N + math.max(ix - 1, 0)) + 1]
				local hz1 = heights[(math.min(iz + 1, N - 1) * N + ix) + 1]
				local hz0 = heights[(math.max(iz - 1, 0) * N + ix) + 1]
				local slope = math.max(math.abs(hx1 - hx0), math.abs(hz1 - hz0)) / (2 * CELL)
				if slope > 0.8 then
					cleanable = false
					buffer.writeu8(flags, i, 0)
				end
			end
			if not cleanable then
				-- never show dust the player cannot clean: use the zone's rock instead
				local zi = buffer.readu8(zoneIdx, i)
				if zi > 0 and surfaceMat[i + 1] == Zones.List[zi].DirtyMaterial then
					surfaceMat[i + 1] = rockMat[i + 1]
				end
			end
			WorldGrid.SetHeight(i, h)
			WorldGrid.SetZone(i, buffer.readu8(zoneIdx, i))
			WorldGrid.SetState(i, cleanable and WorldGrid.DIRTY or WorldGrid.NONE)
		end
	end

	-- pass 3: write voxels in 64x64 stud chunks
	local CH = 16
	local chunks = N // CH
	local done = 0
	local AIR = Enum.Material.Air
	for cz = 0, chunks - 1 do
		for cx = 0, chunks - 1 do
			local minH, maxH = math.huge, -math.huge
			for lz = 0, CH - 1 do
				for lx = 0, CH - 1 do
					local h = heights[((cz * CH + lz) * N + cx * CH + lx) + 1]
					if h < minH then
						minH = h
					end
					if h > maxH then
						maxH = h
					end
				end
			end
			local x0 = cx * CH * CELL - HALF
			local z0 = cz * CH * CELL - HALF
			local yBot = math.floor((minH - 14) / 4) * 4
			if chunkHasCaves(x0, z0) then
				yBot = math.min(yBot, -100)
			end
			local yTop = math.ceil((maxH + 4) / 4) * 4
			local sy = (yTop - yBot) // 4
			local mats, occs = table.create(CH), table.create(CH)
			for lx = 1, CH do
				local mx, ox = table.create(sy), table.create(sy)
				mats[lx], occs[lx] = mx, ox
				for ly = 1, sy do
					mx[ly] = table.create(CH)
					ox[ly] = table.create(CH)
				end
			end
			for lz = 1, CH do
				for lx = 1, CH do
					local i = (cz * CH + lz - 1) * N + (cx * CH + lx - 1)
					local h = heights[i + 1]
					local sMat = surfaceMat[i + 1]
					local rMat = rockMat[i + 1]
					for ly = 1, sy do
						local vBot = yBot + (ly - 1) * 4
						local occ = math.clamp((h - vBot) / 4, 0, 1)
						if occ <= 0.001 then
							mats[lx][ly][lz] = AIR
							occs[lx][ly][lz] = 0
						else
							local depth = h - (vBot + 2)
							mats[lx][ly][lz] = (depth < 6) and sMat or rMat
							occs[lx][ly][lz] = occ
						end
					end
				end
			end
			local region = Region3.new(Vector3.new(x0, yBot, z0), Vector3.new(x0 + CH * CELL, yTop, z0 + CH * CELL))
			terrain:WriteVoxels(region, 4, mats, occs)
			done += 1
			if done % 6 == 0 then
				progress(0.05 + 0.6 * done / (chunks * chunks), "Pouring moon dust")
				task.wait()
			end
		end
	end

	-- frost spires (decorative terrain pillars)
	progress(0.68, "Freezing ice spires")
	for _, s in TerrainGenerator.Spires do
		local base = WorldGrid.HeightAt(s.X, s.Z) or 0
		terrain:FillCylinder(CFrame.new(s.X, base + s.H / 2 - 4, s.Z), s.H, s.R, Enum.Material.Ice)
		terrain:FillBall(Vector3.new(s.X, base + s.H - 3, s.Z), s.R * 0.9, Enum.Material.Glacier)
	end

	TerrainGenerator.CarveCaves(progress)
	TerrainGenerator.BuildAsteroids(progress)
	print(string.format("[TerrainGenerator] terrain generated in %.1fs", os.clock() - t0))
end

------------------------------------------------------------------ crystal caverns

function TerrainGenerator.CarveCaves(progress: (number, string) -> ())
	progress(0.72, "Carving crystal caverns")
	local zone = Zones.ById.crystal_caverns
	local chambers = MapLayout.CaveChambers
	local HEIGHT = 30
	for _, c in chambers do
		terrain:FillCylinder(CFrame.new(c.X, c.Floor + HEIGHT / 2, c.Z), HEIGHT, c.R, Enum.Material.Air)
		terrain:FillBall(Vector3.new(c.X, c.Floor + HEIGHT - 6, c.Z), math.min(c.R * 0.85, 20), Enum.Material.Air)
		terrain:FillCylinder(CFrame.new(c.X, c.Floor - 2, c.Z), 4, c.R, zone.DirtyMaterial)
		task.wait()
	end
	-- tunnels between chambers
	for _, t in MapLayout.CaveTunnels do
		local a, b = chambers[t[1]], chambers[t[2]]
		local pa = Vector3.new(a.X, a.Floor + 9, a.Z)
		local pb = Vector3.new(b.X, b.Floor + 9, b.Z)
		local len = (pb - pa).Magnitude
		local steps = math.ceil(len / 6)
		for s = 0, steps do
			local p = pa:Lerp(pb, s / steps)
			terrain:FillBall(p, 10, Enum.Material.Air)
		end
		task.wait()
	end
	-- entrance ramps from the surface passes
	TerrainGenerator.EntrancePoints = {}
	for _, e in MapLayout.CaveEntrances do
		local target = chambers[e.Chamber]
		local top = (WorldGrid.HeightAt(e.X, e.Z) or 0) + 4
		local pa = Vector3.new(e.X, top, e.Z)
		local pb = Vector3.new(target.X, target.Floor + 9, target.Z)
		local horiz = Vector2.new(pb.X - pa.X, pb.Z - pa.Z).Magnitude
		local steps = math.ceil(horiz / 5)
		for s = 0, steps do
			local t = s / steps
			local x = pa.X + (pb.X - pa.X) * t
			local z = pa.Z + (pb.Z - pa.Z) * t
			local y = pa.Y + (pb.Y - pa.Y) * smoothstep(0, 1, t)
			terrain:FillBall(Vector3.new(x, y, z), 11, Enum.Material.Air)
		end
		table.insert(TerrainGenerator.EntrancePoints, pa)
		task.wait()
	end
	-- pillars + mark cleanable cells on chamber floors
	local rng = Random.new(SEED + 4)
	local pillars = {}
	for _, c in chambers do
		if c.R > 50 then
			for _ = 1, 2 do
				local a = rng:NextNumber(0, math.pi * 2)
				local r = rng:NextNumber(10, c.R * 0.5)
				local p = { X = c.X + r * math.cos(a), Z = c.Z + r * math.sin(a), R = rng:NextNumber(3.5, 6) }
				terrain:FillCylinder(CFrame.new(p.X, c.Floor + 15, p.Z), 34, p.R, Enum.Material.Basalt)
				table.insert(pillars, p)
			end
		end
	end
	TerrainGenerator.Pillars = pillars
	for _, c in chambers do
		local ix0, iz0 = MapLayout.CellIndex(c.X - c.R, c.Z - c.R)
		local ix1, iz1 = MapLayout.CellIndex(c.X + c.R, c.Z + c.R)
		for iz = iz0, iz1 do
			for ix = ix0, ix1 do
				local x, z = MapLayout.CellCenter(ix, iz)
				local d = math.sqrt((x - c.X) ^ 2 + (z - c.Z) ^ 2)
				if d < c.R - 5 then
					local blocked = false
					for _, p in pillars do
						if (x - p.X) ^ 2 + (z - p.Z) ^ 2 < (p.R + 3) ^ 2 then
							blocked = true
							break
						end
					end
					local i = MapLayout.Linear(ix, iz)
					WorldGrid.SetHeight(i, c.Floor)
					WorldGrid.SetZone(i, zone.Index)
					WorldGrid.SetState(i, blocked and WorldGrid.NONE or WorldGrid.DIRTY)
				end
			end
		end
	end
end

------------------------------------------------------------------ orbital ring

function TerrainGenerator.BuildAsteroids(progress: (number, string) -> ())
	progress(0.8, "Parking asteroids in orbit")
	local zone = Zones.ById.orbital_ring
	local rng = Random.new(SEED + 9)
	for _, a in MapLayout.Asteroids do
		local top = MapLayout.ORBIT_Y + a.TopOffset
		terrain:FillCylinder(CFrame.new(a.X, top - 7, a.Z), 14, a.R, zone.RockMaterial)
		terrain:FillBall(Vector3.new(a.X, top - 14, a.Z), a.R * 0.82, zone.RockMaterial)
		for _ = 1, 4 do
			local ang = rng:NextNumber(0, math.pi * 2)
			local r = rng:NextNumber(a.R * 0.3, a.R * 0.7)
			terrain:FillBall(Vector3.new(a.X + r * math.cos(ang), top - rng:NextNumber(18, 30), a.Z + r * math.sin(ang)), rng:NextNumber(a.R * 0.25, a.R * 0.45), zone.RockMaterial)
		end
		terrain:FillCylinder(CFrame.new(a.X, top - 2, a.Z), 4, a.R - 1, zone.DirtyMaterial)
		-- rocky rim
		for i = 0, 11 do
			local ang = math.rad(i * 30 + rng:NextNumber(-8, 8))
			terrain:FillBall(Vector3.new(a.X + (a.R - 2) * math.cos(ang), top, a.Z + (a.R - 2) * math.sin(ang)), rng:NextNumber(3, 6), zone.RockMaterial)
		end
		local ix0, iz0 = MapLayout.CellIndex(a.X - a.R, a.Z - a.R)
		local ix1, iz1 = MapLayout.CellIndex(a.X + a.R, a.Z + a.R)
		for iz = iz0, iz1 do
			for ix = ix0, ix1 do
				local x, z = MapLayout.CellCenter(ix, iz)
				if (x - a.X) ^ 2 + (z - a.Z) ^ 2 < (a.R - 8) ^ 2 then
					local i = MapLayout.Linear(ix, iz)
					WorldGrid.SetHeight(i, top)
					WorldGrid.SetZone(i, zone.Index)
					WorldGrid.SetState(i, WorldGrid.DIRTY)
				end
			end
		end
		task.wait()
	end
end

return TerrainGenerator
