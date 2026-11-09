--!strict
-- Server-side cell grid (one entry per 4x4-stud terrain column), stored in Luau buffers.
--   Height : f32  surface height of the cleanable layer (cave floor / asteroid top where relevant)
--   State  : u8   0 = not cleanable, 1 = dirty, 2 = clean
--   Zone   : u8   zone index (0 = hub / none)
--   Sector : u16  sector index (0 = none)

local MapLayout = require(game:GetService("ReplicatedStorage").Shared.MapLayout)

local N = MapLayout.N

local WorldGrid = {}

WorldGrid.NONE = 0
WorldGrid.DIRTY = 1
WorldGrid.CLEAN = 2

WorldGrid.Height = buffer.create(N * N * 4)
WorldGrid.State = buffer.create(N * N)
WorldGrid.Zone = buffer.create(N * N)
WorldGrid.Sector = buffer.create(N * N * 2)

function WorldGrid.GetHeight(i: number): number
	return buffer.readf32(WorldGrid.Height, i * 4)
end

function WorldGrid.SetHeight(i: number, h: number)
	buffer.writef32(WorldGrid.Height, i * 4, h)
end

function WorldGrid.GetState(i: number): number
	return buffer.readu8(WorldGrid.State, i)
end

function WorldGrid.SetState(i: number, s: number)
	buffer.writeu8(WorldGrid.State, i, s)
end

function WorldGrid.GetZone(i: number): number
	return buffer.readu8(WorldGrid.Zone, i)
end

function WorldGrid.SetZone(i: number, z: number)
	buffer.writeu8(WorldGrid.Zone, i, z)
end

function WorldGrid.GetSector(i: number): number
	return buffer.readu16(WorldGrid.Sector, i * 2)
end

function WorldGrid.SetSector(i: number, s: number)
	buffer.writeu16(WorldGrid.Sector, i * 2, s)
end

-- Height at a world X/Z (nearest cell), or nil outside the map
function WorldGrid.HeightAt(x: number, z: number): number?
	local ix, iz = MapLayout.CellIndex(x, z)
	if not ix or not iz then
		return nil
	end
	return WorldGrid.GetHeight(MapLayout.Linear(ix, iz))
end

-- Mark a circle of cells as not cleanable (under props/buildings). Returns count changed.
function WorldGrid.BlockCircle(x: number, z: number, r: number): number
	local changed = 0
	local ix0, iz0 = MapLayout.CellIndex(x - r, z - r)
	local ix1, iz1 = MapLayout.CellIndex(x + r, z + r)
	local ax0: number = ix0 or 0
	local az0: number = iz0 or 0
	local ax1: number = ix1 or N - 1
	local az1: number = iz1 or N - 1
	for iz = az0, az1 do
		for ix = ax0, ax1 do
			local cx, cz = MapLayout.CellCenter(ix, iz)
			if (cx - x) ^ 2 + (cz - z) ^ 2 <= r * r then
				local i = MapLayout.Linear(ix, iz)
				if WorldGrid.GetState(i) ~= 0 then
					WorldGrid.SetState(i, 0)
					changed += 1
				end
			end
		end
	end
	return changed
end

return WorldGrid
