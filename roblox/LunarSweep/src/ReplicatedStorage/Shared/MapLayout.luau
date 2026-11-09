--!strict
-- World layout math shared by server (generation, validation) and client (map UI, HUD).
--
-- The surface is a 3x3 grid of 512-stud zone cells. The centre cell is the colony hub.
-- Cleaning happens on a 4-stud cell grid (the same resolution as terrain voxels), and
-- cells are grouped into hexagonal "sectors" (pointy-top hexes, circumradius HEX_R).

local MapLayout = {}

MapLayout.CELL = 4
MapLayout.HALF = 768 -- map spans [-768, 768) on X and Z
MapLayout.N = 384 -- cells per axis (1536 / 4)
MapLayout.ZONE_SIZE = 512
MapLayout.HUB_HALF = 256
MapLayout.HEX_R = 48
MapLayout.ORBIT_Y = 420 -- base height of the orbital ring asteroids (above the hub)
MapLayout.CAVE_FLOOR_Y = -60
MapLayout.PLOT_SIZE = 96 -- personal base plot, 24 x 24 build cells
MapLayout.PLOT_CELLS = 24
MapLayout.STATION_RING = 62

local SQRT3 = math.sqrt(3)

-- zone cell (gx, gz) in 0..2 -> zone id
MapLayout.ZoneGrid = {
	["0,0"] = "starfall_basin",
	["1,0"] = "dusty_flats",
	["2,0"] = "pockmark_craters",
	["0,1"] = "shadow_side",
	["1,1"] = "hub",
	["2,1"] = "junkyard_expanse",
	["0,2"] = "ember_rift",
	["1,2"] = "frostbite_basin",
	["2,2"] = "crystal_caverns",
}

-- Orbital ring asteroids (flat-topped discs floating above the hub). Top surface Y = ORBIT_Y + TopOffset.
MapLayout.Asteroids = {
	{ X = 0, Z = 0, R = 70, TopOffset = 0 },
	{ X = 150, Z = -60, R = 52, TopOffset = 6 },
	{ X = 130, Z = 120, R = 58, TopOffset = -4 },
	{ X = -20, Z = 170, R = 50, TopOffset = 10 },
	{ X = -160, Z = 90, R = 60, TopOffset = 2 },
	{ X = -150, Z = -100, R = 54, TopOffset = -6 },
	{ X = 10, Z = -170, R = 56, TopOffset = 4 },
}

-- Cave chambers inside crystal_caverns (centre X/Z, radius, floor Y). Carved out of solid rock.
MapLayout.CaveChambers = {
	{ X = 400, Z = 380, R = 64, Floor = -60 },
	{ X = 540, Z = 360, R = 52, Floor = -56 },
	{ X = 660, Z = 420, R = 58, Floor = -64 },
	{ X = 440, Z = 530, R = 70, Floor = -60 },
	{ X = 600, Z = 560, R = 64, Floor = -66 },
	{ X = 700, Z = 660, R = 44, Floor = -62 },
	{ X = 360, Z = 680, R = 56, Floor = -58 },
	{ X = 520, Z = 690, R = 50, Floor = -60 },
}
-- tunnels between chambers (indices) plus entrances from the surface passes
MapLayout.CaveTunnels = {
	{ 1, 2 },
	{ 2, 3 },
	{ 1, 4 },
	{ 4, 5 },
	{ 5, 6 },
	{ 4, 7 },
	{ 7, 8 },
	{ 8, 5 },
	{ 3, 5 },
}
-- entrance ramps: from surface point (Y is resolved at generation) down to a chamber index
MapLayout.CaveEntrances = {
	{ X = 512, Z = 266, Chamber = 1 }, -- from Junkyard Expanse pass (north edge)
	{ X = 266, Z = 512, Chamber = 4 }, -- from Frostbite Basin pass (west edge)
}

-- Base plots (axis-aligned squares) arranged around the colony core.
MapLayout.Plots = {
	{ X = 68, Z = -168 },
	{ X = 168, Z = -68 },
	{ X = 168, Z = 68 },
	{ X = 68, Z = 168 },
	{ X = -68, Z = 168 },
	{ X = -168, Z = 68 },
	{ X = -168, Z = -68 },
	{ X = -68, Z = -168 },
}

-- Hub station angles (degrees clockwise from north) on a ring around the spawn pad.
MapLayout.Stations = {
	Exchange = 0,
	SupplyWall = 36,
	RobotBay = 72,
	MissionBoard = 108,
	LaunchPad = 144,
	RebirthPortal = 180,
	Customizer = 216,
	CrateDispenser = 252,
	Leaderboards = 288,
	UpgradeTerminal = 324,
}

function MapLayout.StationPosition(name: string): (Vector3, CFrame)
	local angle = math.rad(MapLayout.Stations[name] or 0)
	local r = MapLayout.STATION_RING
	local pos = Vector3.new(r * math.sin(angle), 0, -r * math.cos(angle))
	-- face the centre of the hub
	local cf = CFrame.lookAt(pos, Vector3.new(0, 0, 0))
	return pos, cf
end

function MapLayout.PlotOrigin(index: number): Vector3
	local p = MapLayout.Plots[index]
	return Vector3.new(p.X - MapLayout.PLOT_SIZE / 2, 0, p.Z - MapLayout.PLOT_SIZE / 2)
end

------------------------------------------------------------------ cells

function MapLayout.CellIndex(x: number, z: number): (number?, number?)
	local ix = math.floor((x + MapLayout.HALF) / MapLayout.CELL)
	local iz = math.floor((z + MapLayout.HALF) / MapLayout.CELL)
	if ix < 0 or iz < 0 or ix >= MapLayout.N or iz >= MapLayout.N then
		return nil, nil
	end
	return ix, iz
end

function MapLayout.CellCenter(ix: number, iz: number): (number, number)
	return ix * MapLayout.CELL - MapLayout.HALF + MapLayout.CELL / 2, iz * MapLayout.CELL - MapLayout.HALF + MapLayout.CELL / 2
end

function MapLayout.Linear(ix: number, iz: number): number
	return iz * MapLayout.N + ix
end

function MapLayout.FromLinear(i: number): (number, number)
	return i % MapLayout.N, i // MapLayout.N
end

------------------------------------------------------------------ zones

function MapLayout.GridCoord(x: number, z: number): (number, number)
	local gx = math.clamp(math.floor((x + MapLayout.HALF) / MapLayout.ZONE_SIZE), 0, 2)
	local gz = math.clamp(math.floor((z + MapLayout.HALF) / MapLayout.ZONE_SIZE), 0, 2)
	return gx, gz
end

function MapLayout.GridZoneAt(x: number, z: number): string
	local gx, gz = MapLayout.GridCoord(x, z)
	return MapLayout.ZoneGrid[gx .. "," .. gz]
end

function MapLayout.InHub(x: number, z: number): boolean
	return math.abs(x) < MapLayout.HUB_HALF and math.abs(z) < MapLayout.HUB_HALF
end

-- Zone for a world position, taking the floating orbital ring into account.
function MapLayout.ZoneAt(pos: Vector3): string
	if MapLayout.InHub(pos.X, pos.Z) and pos.Y > MapLayout.ORBIT_Y - 120 then
		return "orbital_ring"
	end
	return MapLayout.GridZoneAt(pos.X, pos.Z)
end

-- Rectangle (min/max X,Z) of a grid zone
function MapLayout.ZoneBounds(gx: number, gz: number): (number, number, number, number)
	local x0 = gx * MapLayout.ZONE_SIZE - MapLayout.HALF
	local z0 = gz * MapLayout.ZONE_SIZE - MapLayout.HALF
	return x0, z0, x0 + MapLayout.ZONE_SIZE, z0 + MapLayout.ZONE_SIZE
end

------------------------------------------------------------------ hex sectors

local function cubeRound(qf: number, rf: number): (number, number)
	local sf = -qf - rf
	local q, r, s = math.round(qf), math.round(rf), math.round(sf)
	local dq, dr, ds = math.abs(q - qf), math.abs(r - rf), math.abs(s - sf)
	if dq > dr and dq > ds then
		q = -r - s
	elseif dr > ds then
		r = -q - s
	end
	return q, r
end

function MapLayout.HexAt(x: number, z: number): (number, number)
	local R = MapLayout.HEX_R
	local qf = (SQRT3 / 3 * x - 1 / 3 * z) / R
	local rf = (2 / 3 * z) / R
	return cubeRound(qf, rf)
end

function MapLayout.HexCenter(q: number, r: number): (number, number)
	local R = MapLayout.HEX_R
	return R * SQRT3 * (q + r / 2), R * 1.5 * r
end

function MapLayout.HexCorners(q: number, r: number): { Vector2 }
	local cx, cz = MapLayout.HexCenter(q, r)
	local out = {}
	for i = 0, 5 do
		local a = math.rad(60 * i - 30)
		table.insert(out, Vector2.new(cx + MapLayout.HEX_R * math.cos(a), cz + MapLayout.HEX_R * math.sin(a)))
	end
	return out
end

function MapLayout.SectorKey(zoneIndex: number, q: number, r: number): number
	return zoneIndex * 1000000 + (q + 500) * 1000 + (r + 500)
end

function MapLayout.DecodeSectorKey(key: number): (number, number, number)
	local zoneIndex = key // 1000000
	local rest = key % 1000000
	return zoneIndex, rest // 1000 - 500, rest % 1000 - 500
end

return MapLayout
