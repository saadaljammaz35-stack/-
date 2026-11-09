--!nonstrict
-- Your base, built anywhere on the moon. Single-player moon: buildings live on the world
-- grid of 4-stud cells (same grid as the dust cells), outside the colony core and roads, in
-- zones you have unlocked. Handles placement (single buildings and dragged conveyor lines),
-- removal, upgrades, power grid, conveyor connectivity (BFS), production chains, silo
-- storage, capsule routing along conveyors, catchers, launch-pad auto-selling, offline
-- production and live status replication. Cells under buildings stop counting as dust.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local MapLayout = require(Shared.MapLayout)
local Buildings = require(Shared.Config.Buildings)
local Resources = require(Shared.Config.Resources)
local Zones = require(Shared.Config.Zones)
local ModelFactory = require(Shared.ModelFactory)
local Net = require(Shared.Net)
local Registry = require(script.Parent.Registry)
local WorldGrid = require(script.Parent.WorldGrid)

local BaseService = {}

local N = MapLayout.N
local CELL = MapLayout.CELL
local MAX_LINE = 40 -- tiles per dragged conveyor line
local UNLIMITED = { conveyor = 400, foundation_tile = 300, foundation_2 = 300, foundation_4 = 200, ramp = 100, stairs = 100, wall = 300, light_bridge = 60 }
local LOOSE_GROUND = { foundation_tile = true, foundation_2 = true, foundation_4 = true, ramp = true, stairs = true, wall = true, light_bridge = true, conveyor = true, beacon = true, lamp_post = true, colony_flag = true, antenna_mast = true, solar_post = true }
local STORAGE = { command_center = true, dust_silo = true, deposit_hopper = true }

type Base = {
	Player: Player,
	Folder: Model,
	Models: { [number]: Model },
	Occ: { [number]: number }, -- linear world cell -> building uid
	Blocked: { number },
	Status: { [number]: string },
	PowerGen: number,
	PowerUse: number,
	LastLaunch: number,
	LastCatch: number,
}

local bases: { [Player]: Base } = {}
local basesFolder: Folder

local function notify(player: Player, text: string, kind: string?, icon: string?)
	Net.Event("Notify"):FireClient(player, { Text = text, Kind = kind or "Info", Icon = icon or "🏗" })
end

------------------------------------------------------------------ geometry

local function footprint(def, r: number): (number, number)
	if r % 2 == 1 then
		return def.D, def.W
	end
	return def.W, def.D
end

local function lin(x: number, z: number): number
	return z * N + x
end

local function findBuilding(profile, uid: number)
	for i, b in profile.Base.Buildings do
		if b.Uid == uid then
			return b, i
		end
	end
	return nil, nil
end

local function ccLevel(profile): number
	for _, b in profile.Base.Buildings do
		if b.Id == "command_center" then
			return b.Level or 1
		end
	end
	return 1
end

-- ground height sampled over a footprint (corners + centre): max height and spread
function BaseService:FootprintGround(x: number, z: number, w: number, d: number, nearY: number?): (number, number)
	local x0, z0 = x * CELL - MapLayout.HALF, z * CELL - MapLayout.HALF
	local x1, z1 = x0 + w * CELL, z0 + d * CELL
	local pts = { { x0 + 1, z0 + 1 }, { x1 - 1, z0 + 1 }, { x0 + 1, z1 - 1 }, { x1 - 1, z1 - 1 }, { (x0 + x1) / 2, (z0 + z1) / 2 } }
	-- without a hint, build on the ground surface (not on an asteroid floating above it)
	local ref = nearY or Registry.WorldService:SurfaceAt((x0 + x1) / 2, (z0 + z1) / 2)
	local hi, lo = -math.huge, math.huge
	for _, p in pts do
		local h = Registry.WorldService:GroundAt(p[1], p[2], ref)
		hi = math.max(hi, h)
		lo = math.min(lo, h)
	end
	return hi, hi - lo
end

function BaseService:WorldCFrame(def, x: number, z: number, r: number, y: number): CFrame
	local w, d = footprint(def, r)
	local cx, cz = MapLayout.FootprintCenter(x, z, w, d)
	return CFrame.new(cx, y, cz) * CFrame.Angles(0, math.rad(90 * r), 0)
end

------------------------------------------------------------------ models

local function setStatusAttr(model: Model?, status: string)
	if model and model:GetAttribute("Status") ~= status then
		model:SetAttribute("Status", status)
	end
end

local function spawnModel(base: Base, b)
	local def = Buildings.ById[b.Id]
	if not def then
		return
	end
	local old = base.Models[b.Uid]
	if old then
		old:Destroy()
	end
	local model = ModelFactory.Building(b.Id, b.Level or 1)
	model.Name = def.Name
	model:SetAttribute("Uid", b.Uid)
	model:SetAttribute("Owner", base.Player.UserId)
	model:SetAttribute("Status", "Idle")
	model:PivotTo(BaseService:WorldCFrame(def, b.X, b.Z, b.R or 0, b.Y or 0))
	local root = model.PrimaryPart :: BasePart
	if b.Id == "command_center" then
		model.ModelStreamingMode = Enum.ModelStreamingMode.Persistent
		local p1 = Instance.new("ProximityPrompt")
		p1.ActionText = "Base Terminal"
		p1.ObjectText = "Command Center"
		p1.MaxActivationDistance = 16
		p1.RequiresLineOfSight = false
		p1:SetAttribute("Panel", "Base")
		p1:SetAttribute("Owner", base.Player.UserId)
		p1.Parent = root
		local p2 = Instance.new("ProximityPrompt")
		p2.ActionText = "Store Dust in Silo"
		p2.ObjectText = "Command Center"
		p2.KeyboardKeyCode = Enum.KeyCode.F
		p2.GamepadKeyCode = Enum.KeyCode.ButtonY
		p2.UIOffset = Vector2.new(0, 80)
		p2.MaxActivationDistance = 16
		p2.RequiresLineOfSight = false
		p2:SetAttribute("Action", "DepositSilo")
		p2:SetAttribute("Owner", base.Player.UserId)
		p2.Parent = root
	elseif b.Id == "deposit_hopper" then
		local p = Instance.new("ProximityPrompt")
		p.ActionText = "Store Dust in Silo"
		p.ObjectText = "Deposit Hopper"
		p.MaxActivationDistance = 12
		p.RequiresLineOfSight = false
		p:SetAttribute("Action", "DepositSilo")
		p:SetAttribute("Owner", base.Player.UserId)
		p.Parent = root
	elseif b.Id == "garage" then
		local p = Instance.new("ProximityPrompt")
		p.ActionText = "Open Garage"
		p.ObjectText = "Garage"
		p.MaxActivationDistance = 14
		p.RequiresLineOfSight = false
		p:SetAttribute("Panel", "Garage")
		p:SetAttribute("Owner", base.Player.UserId)
		p.Parent = root
	elseif b.Id == "beacon" then
		model.ModelStreamingMode = Enum.ModelStreamingMode.Persistent
	end
	model.Parent = base.Folder
	base.Models[b.Uid] = model
end

local function rebuildOcc(base: Base, profile)
	table.clear(base.Occ)
	for _, b in profile.Base.Buildings do
		local def = Buildings.ById[b.Id]
		if def then
			local w, d = footprint(def, b.R or 0)
			for dx = 0, w - 1 do
				for dz = 0, d - 1 do
					base.Occ[lin(b.X + dx, b.Z + dz)] = b.Uid
				end
			end
		end
	end
end

-- cells under buildings no longer hold dust (keeps sectors completable)
local function syncBlocked(base: Base)
	local wanted = {}
	local profile = Registry.DataService:Get(base.Player)
	local yOf = {}
	if profile then
		for _, b in profile.Base.Buildings do
			yOf[b.Uid] = b.Y
		end
	end
	for cell, uid in base.Occ do
		-- only cells on the same layer (a hub building doesn't cover the asteroid above it)
		local y = yOf[uid]
		if y == nil or math.abs(WorldGrid.GetHeight(cell) - y) <= 12 then
			wanted[cell] = true
		end
	end
	local sectors = Registry.SectorService
	for _, cell in base.Blocked do
		if not wanted[cell] then
			sectors:UnblockCell(cell)
		end
	end
	local list = {}
	for cell in wanted do
		sectors:BlockCell(cell)
		table.insert(list, cell)
	end
	base.Blocked = list
end

------------------------------------------------------------------ silo

function BaseService:SiloCapacity(player: Player): number
	local profile = Registry.DataService:Get(player)
	if not profile then
		return 0
	end
	return Formulas.StorageCapacity(profile.Base.Buildings)
end

function BaseService:SiloKg(player: Player): number
	local profile = Registry.DataService:Get(player)
	return profile and Formulas.ContentsKg(profile.Base.Silo) or 0
end

function BaseService:SiloSpace(player: Player): number
	return math.max(0, self:SiloCapacity(player) - self:SiloKg(player))
end

-- Adds contents to the silo (respecting capacity unless force). Returns kg added.
function BaseService:AddToSilo(player: Player, contents: { [string]: number }, force: boolean?): number
	local profile = Registry.DataService:Get(player)
	if not profile then
		return 0
	end
	local total = Formulas.ContentsKg(contents)
	if total <= 0 then
		return 0
	end
	local space = force and math.huge or self:SiloSpace(player)
	local frac = math.min(1, space / total)
	if frac <= 0 then
		return 0
	end
	local silo = profile.Base.Silo
	for res, kg in contents do
		silo[res] = (silo[res] or 0) + kg * frac
		contents[res] = kg * (1 - frac)
		if contents[res] <= 1e-6 then
			contents[res] = nil
		end
	end
	return total * frac
end

function BaseService:SellSilo(player: Player, mult: number?): number
	local profile = Registry.DataService:Get(player)
	if not profile then
		return 0
	end
	local silo = profile.Base.Silo
	if Formulas.ContentsKg(silo) <= 0.0001 then
		return 0
	end
	local value = Registry.EconomyService:SellContents(player, silo, true, mult or 1)
	profile.Base.Silo = {}
	Registry.DataService:AddStat(player, "SiloSales", 1)
	return value
end

function BaseService:BuildingLevelSum(player: Player, id: string): number
	local profile = Registry.DataService:Get(player)
	if not profile then
		return 0
	end
	local sum = 0
	for _, b in profile.Base.Buildings do
		if b.Id == id then
			sum += b.Level or 1
		end
	end
	return sum
end

function BaseService:HasBase(player: Player): boolean
	return bases[player] ~= nil
end
BaseService.HasPlot = BaseService.HasBase

-- position in front of the command center (teleport target)
function BaseService:HomePosition(player: Player): Vector3?
	local base = bases[player]
	local profile = Registry.DataService:Get(player)
	if not base or not profile then
		return nil
	end
	for _, b in profile.Base.Buildings do
		if b.Id == "command_center" then
			local m = base.Models[b.Uid]
			if m then
				return (m:GetPivot() * CFrame.new(0, 3, -14)).Position
			end
		end
	end
	return nil
end

local function modelsOf(player: Player, ids: { [string]: boolean }): { Model }
	local base = bases[player]
	local profile = Registry.DataService:Get(player)
	local out = {}
	if not base or not profile then
		return out
	end
	for _, b in profile.Base.Buildings do
		if ids[b.Id] then
			local m = base.Models[b.Uid]
			if m then
				table.insert(out, m)
			end
		end
	end
	return out
end

local function nearestOf(player: Player, ids: { [string]: boolean }, pos: Vector3, dist: number): Model?
	local best, bd = nil, dist
	for _, m in modelsOf(player, ids) do
		local d = (m:GetPivot().Position - pos).Magnitude
		if d <= bd then
			best, bd = m, d
		end
	end
	return best
end

function BaseService:DockPositions(player: Player): { Vector3 }
	local out = {}
	for _, m in modelsOf(player, { robot_dock = true, command_center = true }) do
		table.insert(out, m:GetPivot().Position + Vector3.new(0, 2, 0))
	end
	return out
end

function BaseService:GaragePositions(player: Player): { CFrame }
	local out = {}
	for _, m in modelsOf(player, { garage = true }) do
		table.insert(out, m:GetPivot() * CFrame.new(0, 3, -10))
	end
	return out
end

function BaseService:Beacons(player: Player): { { Uid: number, Pos: Vector3 } }
	local out = {}
	for _, m in modelsOf(player, { beacon = true }) do
		table.insert(out, { Uid = m:GetAttribute("Uid"), Pos = m:GetPivot().Position })
	end
	return out
end

function BaseService:CatcherNear(player: Player, pos: Vector3, dist: number): Model?
	return nearestOf(player, { capsule_catcher = true }, pos, dist)
end

function BaseService:StorageNear(player: Player, pos: Vector3, dist: number): Model?
	return nearestOf(player, STORAGE, pos, dist)
end

function BaseService:ChargeMultiplier(player: Player): number
	local base = bases[player]
	if not base then
		return 0.3
	end
	local ratio = base.PowerUse > 0 and math.min(1, base.PowerGen / base.PowerUse) or 1
	local banks = self:BuildingLevelSum(player, "battery_bank")
	return (0.3 + 0.7 * ratio) * (1 + 0.5 * banks)
end

local function hrpOf(player: Player): BasePart?
	local character = player.Character
	return character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
end

function BaseService:NearOwnDeposit(player: Player, dist: number): boolean
	local hrp = hrpOf(player)
	return hrp ~= nil and nearestOf(player, { deposit_hopper = true }, hrp.Position, dist) ~= nil
end

local function nearOwnStorage(player: Player, dist: number): boolean
	local hrp = hrpOf(player)
	return hrp ~= nil and nearestOf(player, STORAGE, hrp.Position, dist) ~= nil
end

function BaseService:DepositToSilo(player: Player): (boolean, string?)
	local profile = Registry.DataService:Get(player)
	if not profile then
		return false
	end
	local carried = Registry.CapsuleService:TakeCarried(player)
	if carried then
		for res, kg in carried do
			profile.Contents[res] = (profile.Contents[res] or 0) + kg
		end
	end
	local cargo = Registry.VehicleService and Registry.VehicleService:TakeCargoNear(player, 40)
	local before = Formulas.ContentsKg(profile.Contents) + (cargo and Formulas.ContentsKg(cargo) or 0)
	if before <= 0.0001 then
		return false, "Your container is empty."
	end
	local moved = self:AddToSilo(player, profile.Contents)
	if cargo then
		moved += self:AddToSilo(player, cargo)
		if Formulas.ContentsKg(cargo) > 0.001 then
			Registry.VehicleService:ReturnCargo(player, cargo)
		end
	end
	Registry.DataService:Mark(player, "Contents")
	Registry.PlayerService:UpdateFill(player)
	if moved <= 0 then
		return false, "Your silo is full! Sell it from the Base Terminal or build more Dust Silos."
	end
	Registry.DataService:AddStat(player, "Deposits", 1)
	local left = Formulas.ContentsKg(profile.Contents)
	return true, string.format("Stored %s in your silo%s", Format.Kg(moved), left > 0.001 and " (silo full, some dust left)" or "")
end

------------------------------------------------------------------ placement

local function countOf(profile, id: string): number
	local n = 0
	for _, b in profile.Base.Buildings do
		if b.Id == id then
			n += 1
		end
	end
	return n
end

local function limitedCount(profile): number
	local n = 0
	for _, b in profile.Base.Buildings do
		if not UNLIMITED[b.Id] then
			n += 1
		end
	end
	return n
end

local function zoneAllowed(profile, x: number, z: number, y: number): boolean
	local zoneId = MapLayout.ZoneAt(Vector3.new(x, y, z))
	if zoneId == "hub" then
		return true
	end
	return profile.Zones[zoneId] == true and Zones.ById[zoneId] ~= nil
end

-- validates a footprint; returns (ok, msg, groundY)
function BaseService:CanPlace(player: Player, profile, id: string, x: number, z: number, r: number, nearY: number?, ignoreCost: boolean?, extraOcc: { [number]: boolean }?): (boolean, string?, number?)
	local base = bases[player]
	local def = Buildings.ById[id]
	if not base then
		return false, "Your base is still loading."
	end
	if not def or def.Category == "Core" then
		return false, "Unknown building."
	end
	if type(x) ~= "number" or type(z) ~= "number" or type(r) ~= "number" or x ~= math.floor(x) or z ~= math.floor(z) or r ~= math.floor(r) or r < 0 or r > 3 then
		return false, "Bad position."
	end
	if profile.Level < def.Level then
		return false, string.format("Requires level %d.", def.Level)
	end
	if ccLevel(profile) < def.CmdLevel then
		return false, string.format("Requires Command Center level %d.", def.CmdLevel)
	end
	if def.MaxCount and countOf(profile, id) >= def.MaxCount then
		return false, string.format("You can only build %d of these.", def.MaxCount)
	end
	if UNLIMITED[id] then
		if countOf(profile, id) >= UNLIMITED[id] then
			return false, "Too many of these."
		end
	elseif limitedCount(profile) >= Formulas.MaxBuildings(ccLevel(profile)) then
		return false, "Building limit reached - upgrade your Command Center."
	end
	local w, d = footprint(def, r)
	if x < 1 or z < 1 or x + w > N - 1 or z + d > N - 1 then
		return false, "Outside the map."
	end
	local y = type(nearY) == "number" and nearY == nearY and math.clamp(nearY, -200, 800) or nil
	local ground, spread = self:FootprintGround(x, z, w, d, y)
	local maxSpread = LOOSE_GROUND[id] and 26 or 10
	if spread > maxSpread then
		return false, "The ground is too steep here."
	end
	for dx = 0, w - 1 do
		for dz = 0, d - 1 do
			local cx, cz = MapLayout.CellCenter(x + dx, z + dz)
			if not MapLayout.CanBuildAt(cx, cz) then
				return false, "You can't build in the colony core or on roads."
			end
			if not zoneAllowed(profile, cx, cz, ground) then
				return false, "Unlock this zone first."
			end
			local cell = lin(x + dx, z + dz)
			if base.Occ[cell] or (extraOcc and extraOcc[cell]) then
				return false, "Something is in the way."
			end
		end
	end
	if not ignoreCost and profile.Credits < Formulas.BuildingCost(id, profile) then
		return false, "Not enough credits."
	end
	return true, nil, ground
end

local function addBuilding(player: Player, profile, id: string, x: number, z: number, r: number, y: number, cost: number)
	local base = bases[player]
	profile.Base.Seq += 1
	local b = { Uid = profile.Base.Seq, Id = id, X = x, Z = z, R = r, Y = y, Level = 1, Spent = cost }
	table.insert(profile.Base.Buildings, b)
	local def = Buildings.ById[id]
	local w, d = footprint(def, r)
	for dx = 0, w - 1 do
		for dz = 0, d - 1 do
			base.Occ[lin(x + dx, z + dz)] = b.Uid
		end
	end
	spawnModel(base, b)
	return b
end

function BaseService:Place(player: Player, profile, id: string, x: number, z: number, r: number, nearY: number?): (boolean, string?)
	local ok, msg, ground = self:CanPlace(player, profile, id, x, z, r, nearY)
	if not ok then
		return false, msg
	end
	local cost = Formulas.BuildingCost(id, profile)
	if not Registry.EconomyService:Spend(player, cost) then
		return false, "Not enough credits."
	end
	addBuilding(player, profile, id, x, z, r, ground :: number, cost)
	syncBlocked(bases[player])
	Registry.DataService:Mark(player, "Base")
	Registry.DataService:AddStat(player, "BuildingsPlaced", 1)
	return true, Buildings.ById[id].Name .. " built"
end

-- straight line of 1x1 tiles (conveyors) from (x0,z0) to (x1,z1) along the major axis
function BaseService:PlaceLine(player: Player, profile, id: string, x0: number, z0: number, x1: number, z1: number, nearY: number?): (boolean, string?)
	local def = Buildings.ById[id]
	if not def or def.W ~= 1 or def.D ~= 1 then
		return false, "Only 1x1 pieces can be dragged."
	end
	for _, v in { x0, z0, x1, z1 } do
		if type(v) ~= "number" or v ~= math.floor(v) then
			return false, "Bad position."
		end
	end
	local dx, dz = x1 - x0, z1 - z0
	local cells = {}
	if math.abs(dx) >= math.abs(dz) then
		local s = dx >= 0 and 1 or -1
		for i = 0, math.abs(dx) do
			table.insert(cells, { x0 + i * s, z0 })
		end
	else
		local s = dz >= 0 and 1 or -1
		for i = 0, math.abs(dz) do
			table.insert(cells, { x0, z0 + i * s })
		end
	end
	if #cells > MAX_LINE then
		return false, string.format("Lines can be at most %d tiles long.", MAX_LINE)
	end
	local rot = (math.abs(dx) >= math.abs(dz)) and 1 or 0
	local cost = Formulas.BuildingCost(id, profile)
	if profile.Credits < cost * #cells then
		return false, "Not enough credits for the whole line."
	end
	local planned = {}
	local placements = {}
	for _, c in cells do
		local ok, msg, ground = self:CanPlace(player, profile, id, c[1], c[2], rot, nearY, true, planned)
		if not ok then
			return false, msg
		end
		planned[lin(c[1], c[2])] = true
		table.insert(placements, { c[1], c[2], ground })
		nearY = ground
	end
	if not Registry.EconomyService:Spend(player, cost * #cells) then
		return false, "Not enough credits."
	end
	for _, p in placements do
		addBuilding(player, profile, id, p[1], p[2], rot, p[3], cost)
	end
	syncBlocked(bases[player])
	Registry.DataService:Mark(player, "Base")
	Registry.DataService:AddStat(player, "BuildingsPlaced", #placements)
	return true, string.format("Built %d %s tiles", #placements, def.Name)
end

function BaseService:Remove(player: Player, profile, uid: number): (boolean, string?)
	local base = bases[player]
	local b, index = findBuilding(profile, uid)
	if not base or not b then
		return false, "Building not found."
	end
	local def = Buildings.ById[b.Id]
	if not def or not def.Removable then
		return false, "This building can't be removed."
	end
	if def.Storage then
		local capAfter = Formulas.StorageCapacity(profile.Base.Buildings) - def.Storage * (b.Level or 1)
		if Formulas.ContentsKg(profile.Base.Silo) > capAfter then
			return false, "Sell your silo first - it would overflow."
		end
	end
	table.remove(profile.Base.Buildings, index)
	local refund = math.floor((b.Spent or def.Cost) * 0.5)
	Registry.EconomyService:AddCredits(player, refund, false)
	local m = base.Models[uid]
	if m then
		m:Destroy()
	end
	base.Models[uid] = nil
	rebuildOcc(base, profile)
	syncBlocked(base)
	Registry.DataService:Mark(player, "Base")
	if Registry.RobotService then
		Registry.RobotService:ClampToSlots(player)
	end
	return true, string.format("Removed %s (+%s refund)", def.Name, Format.Credits(refund))
end

function BaseService:Upgrade(player: Player, profile, uid: number): (boolean, string?)
	local base = bases[player]
	local b = findBuilding(profile, uid)
	if not base or not b then
		return false, "Building not found."
	end
	local def = Buildings.ById[b.Id]
	local level = b.Level or 1
	if level >= def.MaxLevel then
		return false, "Already at max level."
	end
	if b.Id == "command_center" then
		local req = Buildings.Command.LevelReq[level + 1]
		if req and profile.Level < req then
			return false, string.format("Requires player level %d.", req)
		end
	end
	local cost = Formulas.BuildingUpgradeCost(b.Id, level, profile)
	if not Registry.EconomyService:Spend(player, cost) then
		return false, "Not enough credits."
	end
	b.Level = level + 1
	b.Spent = (b.Spent or def.Cost) + cost
	spawnModel(base, b)
	Registry.DataService:Mark(player, "Base")
	return true, string.format("%s upgraded to level %d", def.Name, b.Level)
end

------------------------------------------------------------------ production

local function isDustLike(resId: string): boolean
	local r = Resources.ById[resId]
	return r ~= nil and (r.Kind == "Dust" or resId == "drilled_dust")
end

local function isDebris(resId: string): boolean
	local r = Resources.ById[resId]
	return r ~= nil and r.Kind == "Debris"
end

local function isCrystal(resId: string): boolean
	local r = Resources.ById[resId]
	return r ~= nil and r.Kind == "Debris" and r.Shape == "Crystal"
end

local FILTERS = { AnyDust = isDustLike, AnyDebris = isDebris, Crystal = isCrystal }

local function available(silo, key: string): number
	local f = FILTERS[key]
	if f then
		local total = 0
		for res, kg in silo do
			if f(res) then
				total += kg
			end
		end
		return total
	end
	return silo[key] or 0
end

local function consume(silo, key: string, amount: number)
	local f = FILTERS[key]
	if f then
		local total = available(silo, key)
		if total <= 0 then
			return
		end
		local frac = math.min(1, amount / total)
		for res, kg in silo do
			if f(res) then
				silo[res] = kg * (1 - frac)
				if silo[res] <= 1e-6 then
					silo[res] = nil
				end
			end
		end
	else
		silo[key] = math.max(0, (silo[key] or 0) - amount)
		if silo[key] <= 1e-6 then
			silo[key] = nil
		end
	end
end

local NEIGHBOURS = { { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } }

-- Which non-conveyor buildings are linked to storage (adjacent or via conveyor chains)
local function connectivity(base: Base, profile): { [number]: boolean }
	local byUid = {}
	for _, b in profile.Base.Buildings do
		byUid[b.Uid] = b
	end
	local reached: { [number]: boolean } = {}
	local queue = {}
	for cell, uid in base.Occ do
		local b = byUid[uid]
		if b and (b.Id == "command_center" or b.Id == "dust_silo") then
			table.insert(queue, cell)
		end
	end
	local visited = {}
	local head = 1
	while head <= #queue do
		local cell = queue[head]
		head += 1
		if not visited[cell] then
			visited[cell] = true
			local x, z = cell % N, cell // N
			for _, d in NEIGHBOURS do
				local nx, nz = x + d[1], z + d[2]
				if nx >= 0 and nz >= 0 and nx < N and nz < N then
					local nc = lin(nx, nz)
					local uid = base.Occ[nc]
					local nb = uid and byUid[uid]
					if nb then
						if nb.Id == "conveyor" then
							if not visited[nc] then
								table.insert(queue, nc)
							end
						else
							reached[uid] = true
						end
					end
				end
			end
		end
	end
	return reached
end

-- Path for a capsule dropped on a conveyor at world position pos: follows the conveyor
-- network to the nearest storage building or catcher. Returns (points, targetModel, kind).
function BaseService:ConveyorRoute(player: Player, pos: Vector3): ({ Vector3 }?, Model?, string?)
	local base = bases[player]
	local profile = Registry.DataService:Get(player)
	if not base or not profile then
		return nil
	end
	local ix, iz = MapLayout.CellIndex(pos.X, pos.Z)
	if not ix or not iz then
		return nil
	end
	local start = lin(ix, iz)
	local byUid = {}
	for _, b in profile.Base.Buildings do
		byUid[b.Uid] = b
	end
	local startB = byUid[base.Occ[start] or -1]
	if not startB or startB.Id ~= "conveyor" or math.abs((startB.Y or 0) - pos.Y) > 8 then
		return nil
	end
	local parent = { [start] = -1 }
	local queue = { start }
	local head = 1
	while head <= #queue do
		local cell = queue[head]
		head += 1
		local x, z = cell % N, cell // N
		for _, d in NEIGHBOURS do
			local nx, nz = x + d[1], z + d[2]
			local nc = lin(nx, nz)
			local uid = base.Occ[nc]
			local nb = uid and byUid[uid]
			if nb and parent[nc] == nil then
				if nb.Id == "conveyor" then
					parent[nc] = cell
					table.insert(queue, nc)
				elseif STORAGE[nb.Id] or nb.Id == "capsule_catcher" then
					-- reconstruct
					local pts = {}
					local c = cell
					while c ~= -1 do
						local cx, cz = MapLayout.CellCenter(c % N, c // N)
						local cb = byUid[base.Occ[c]]
						table.insert(pts, 1, Vector3.new(cx, (cb and cb.Y or pos.Y) + 1.4, cz))
						c = parent[c]
					end
					local target = base.Models[uid]
					if target then
						table.insert(pts, target:GetPivot().Position + Vector3.new(0, 2, 0))
					end
					return pts, target, nb.Id == "capsule_catcher" and "Catcher" or "Storage"
				end
			end
		end
	end
	return nil
end

function BaseService:Tick(base: Base, profile, dt: number, offline: boolean?)
	local buildings = profile.Base.Buildings
	local connected = connectivity(base, profile)
	local gen, use = 0, 0
	local grid = 1 + 0.10 * (profile.Upgrades.power_grid or 0)
	if Registry.EventService and Registry.EventService:IsActive("SolarFlare") and not offline then
		grid *= 2
	end
	for _, b in buildings do
		local def = Buildings.ById[b.Id]
		if def then
			local p = Formulas.BuildingPower(b.Id, b.Level or 1)
			if p > 0 then
				gen += p * grid
			elseif p < 0 and (connected[b.Uid] or def.Category ~= "Production") then
				use += -p
			end
		end
	end
	base.PowerGen, base.PowerUse = gen, use
	local ratio = use > 0 and math.min(1, gen / use) or 1
	local silo = profile.Base.Silo
	local cap = Formulas.StorageCapacity(buildings)
	local stored = Formulas.ContentsKg(silo)
	local gems = 0
	for _, b in buildings do
		local def = Buildings.ById[b.Id]
		local status = "Idle"
		if def and def.Category == "Production" then
			if not connected[b.Uid] then
				status = "Disconnected"
			elseif ratio <= 0.01 then
				status = "NoPower"
			else
				local scale = Formulas.ProductionScale(b.Level or 1) * ratio * dt
				local frac = 1
				if def.Input then
					for key, rate in def.Input do
						local need = rate * scale
						if need > 0 then
							frac = math.min(frac, available(silo, key) / need)
						end
					end
				end
				local outKg = 0
				for _, rate in def.Output or {} do
					outKg += rate * scale
				end
				local inKg = 0
				for _, rate in def.Input or {} do
					inKg += rate * scale
				end
				local net = (outKg - inKg) * frac
				if net > 0 and stored + net > cap then
					frac = math.max(0, math.min(frac, (cap - stored) / math.max(outKg - inKg, 1e-6)))
				end
				if frac <= 0.001 then
					local firstInput = def.Input and (next(def.Input))
					status = (firstInput and available(silo, firstInput) <= 0) and "NoInput" or "SiloFull"
				else
					for key, rate in def.Input or {} do
						consume(silo, key, rate * scale * frac)
					end
					for res, rate in def.Output or {} do
						silo[res] = (silo[res] or 0) + rate * scale * frac
						if def.Gems then
							gems += rate * scale * frac * def.Gems
						end
					end
					stored += net * frac
					status = ratio < 1 and "LowPower" or "Working"
				end
			end
		elseif def and def.Power > 0 then
			status = "Working"
		elseif def and def.Power < 0 then
			status = ratio < 1 and "LowPower" or "Working"
		end
		base.Status[b.Uid] = status
		if not offline then
			setStatusAttr(base.Models[b.Uid], status)
		end
	end
	if gems > 0 then
		profile.Base.GemFrac = (profile.Base.GemFrac or 0) + gems
		local whole = math.floor(profile.Base.GemFrac)
		if whole > 0 then
			profile.Base.GemFrac -= whole
			profile.Gems += whole
			if not offline then
				Registry.DataService:Mark(base.Player, "Gems")
			end
		end
	end
end

local function sendStatus(base: Base, profile)
	local status = {}
	for uid, s in base.Status do
		status[uid] = s
	end
	Net.Event("BaseStatus"):FireClient(base.Player, {
		PowerGen = base.PowerGen,
		PowerUse = base.PowerUse,
		Silo = profile.Base.Silo,
		SiloCap = Formulas.StorageCapacity(profile.Base.Buildings),
		Status = status,
		NextLaunch = base.LastLaunch > 0 and math.max(0, 60 - (os.clock() - base.LastLaunch)) or nil,
	})
end

------------------------------------------------------------------ lifecycle per player

function BaseService:Assign(player: Player, profile)
	if bases[player] then
		return
	end
	local folder = Instance.new("Model")
	folder.Name = "Base_" .. player.UserId
	folder.ModelStreamingMode = Enum.ModelStreamingMode.Atomic
	folder.Parent = basesFolder
	local base: Base = {
		Player = player,
		Folder = folder,
		Models = {},
		Occ = {},
		Blocked = {},
		Status = {},
		PowerGen = 0,
		PowerUse = 0,
		LastLaunch = 0,
		LastCatch = os.clock(),
	}
	bases[player] = base
	local homeX, homeZ = MapLayout.FootprintCell(MapLayout.HOME.X, MapLayout.HOME.Z, 4, 4)
	-- migrate saves from the old plot layout (plot-relative cells, no Y)
	for _, b in profile.Base.Buildings do
		if b.Y == nil then
			b.X = b.X + homeX - 10
			b.Z = b.Z + homeZ - 10
		end
	end
	local hasCC = false
	for _, b in profile.Base.Buildings do
		if b.Id == "command_center" then
			hasCC = true
		end
	end
	if not hasCC then
		profile.Base.Seq += 1
		table.insert(profile.Base.Buildings, 1, { Uid = profile.Base.Seq, Id = "command_center", X = homeX, Z = homeZ, R = 0, Level = 1, Spent = 0 })
	end
	-- validate (unknown ids, overlaps, out of map) and resolve heights
	local valid = {}
	local occ = {}
	for _, b in profile.Base.Buildings do
		local def = Buildings.ById[b.Id]
		if def then
			local w, d = footprint(def, b.R or 0)
			local ok = b.X >= 1 and b.Z >= 1 and b.X + w <= N - 1 and b.Z + d <= N - 1
			if ok then
				for dx = 0, w - 1 do
					for dz = 0, d - 1 do
						if occ[lin(b.X + dx, b.Z + dz)] then
							ok = false
						end
					end
				end
			end
			if ok then
				for dx = 0, w - 1 do
					for dz = 0, d - 1 do
						occ[lin(b.X + dx, b.Z + dz)] = true
					end
				end
				if b.Y == nil then
					b.Y = (self:FootprintGround(b.X, b.Z, w, d))
				end
				table.insert(valid, b)
			end
		end
	end
	profile.Base.Buildings = valid
	rebuildOcc(base, profile)
	for i, b in profile.Base.Buildings do
		spawnModel(base, b)
		if i % 15 == 0 then
			task.wait()
		end
	end
	syncBlocked(base)
	player:SetAttribute("HasBase", true)
	-- offline production (capped)
	local last = profile.Base.LastTick or 0
	if last > 0 then
		local elapsed = math.min(os.time() - last, GameConfig.OfflineCapHours * 3600)
		if elapsed > 60 then
			local before = Formulas.ContentsKg(profile.Base.Silo)
			for _ = 1, 40 do
				self:Tick(base, profile, elapsed / 40, true)
			end
			local gained = Formulas.ContentsKg(profile.Base.Silo) - before
			if gained > 0.01 then
				task.delay(8, function()
					if player.Parent then
						notify(player, string.format("While you were away your base produced %s.", Format.Kg(gained)), "Good", "🏭")
					end
				end)
			end
		end
	end
	profile.Base.LastTick = os.time()
	Registry.DataService:Mark(player, "Base")
end

function BaseService:Release(player: Player)
	local base = bases[player]
	if not base then
		return
	end
	bases[player] = nil
	for _, cell in base.Blocked do
		Registry.SectorService:UnblockCell(cell)
	end
	base.Folder:Destroy()
end

function BaseService:GetBase(player: Player): Base?
	return bases[player]
end

function BaseService:Init()
	basesFolder = Workspace:WaitForChild("Bases") :: Folder
end

function BaseService:Start()
	local R = Registry.Router
	R.Register("PlaceBuilding", function(player, profile, payload)
		return self:Place(player, profile, payload.Id, payload.X, payload.Z, payload.R or 0, payload.Y)
	end, 6, 10)
	R.Register("PlaceLine", function(player, profile, payload)
		return self:PlaceLine(player, profile, payload.Id, payload.X0, payload.Z0, payload.X1, payload.Z1, payload.Y)
	end, 3, 6)
	R.Register("RemoveBuilding", function(player, profile, payload)
		if type(payload.Uid) ~= "number" then
			return false, "Bad building"
		end
		return self:Remove(player, profile, payload.Uid)
	end, 6, 10)
	R.Register("UpgradeBuilding", function(player, profile, payload)
		if type(payload.Uid) ~= "number" then
			return false, "Bad building"
		end
		return self:Upgrade(player, profile, payload.Uid)
	end, 3, 6)
	R.Register("SellSilo", function(player, profile)
		if not bases[player] then
			return false, "No base."
		end
		local value = self:SellSilo(player, 1)
		if value <= 0 then
			return false, "Your silo is empty."
		end
		Registry.DataService:Mark(player, "Base")
		return true, "Silo sold for " .. Format.Credits(value)
	end, 1, 2)
	R.Register("DepositSilo", function(player, profile)
		if not nearOwnStorage(player, 20) then
			return false, "Stand next to your Command Center, Silo or Deposit Hopper."
		end
		return self:DepositToSilo(player)
	end, 2, 4)
	R.Register("TeleportBase", function(player, profile)
		local home = self:HomePosition(player)
		if not home then
			return false, "Your base is still loading."
		end
		return Registry.ZoneService:TeleportPlayer(player, home)
	end, 1, 2)
	R.Register("BeaconTravel", function(player, profile, payload)
		for _, bc in self:Beacons(player) do
			if bc.Uid == payload.Uid then
				return Registry.ZoneService:TeleportPlayer(player, bc.Pos + Vector3.new(4, 2, 4))
			end
		end
		return false, "Beacon not found."
	end, 1, 2)
	R.Register("GetBaseStatus", function(player, profile)
		local base = bases[player]
		if base then
			sendStatus(base, profile)
		end
		return true, nil, { Beacons = self:Beacons(player) }
	end, 2, 4)

	game:GetService("ProximityPromptService").PromptTriggered:Connect(function(prompt, player)
		if prompt:GetAttribute("Action") == "DepositSilo" then
			if prompt:GetAttribute("Owner") ~= player.UserId then
				notify(player, "That isn't your base.", "Warning")
				return
			end
			local ok, msg = self:DepositToSilo(player)
			if msg then
				notify(player, msg, ok and "Good" or "Warning")
			end
		end
	end)

	Registry.DataService.Loaded:Connect(function(player, profile)
		task.spawn(function()
			Registry.WorldService:WaitReady()
			if player.Parent then
				self:Assign(player, profile)
			end
		end)
	end)
	Registry.DataService.Releasing:Connect(function(player, profile)
		profile.Base.LastTick = os.time()
		self:Release(player)
	end)

	task.spawn(function()
		while true do
			task.wait(GameConfig.BaseTick)
			for player, base in bases do
				local profile = Registry.DataService:Get(player)
				if profile and player.Parent then
					local ok, err = pcall(function()
						self:Tick(base, profile, GameConfig.BaseTick, false)
						profile.Base.LastTick = os.time()
						local now = os.clock()
						local padLevel = self:BuildingLevelSum(player, "launch_pad")
						if padLevel > 0 and self:_padPowered(base, profile) then
							if base.LastLaunch == 0 then
								base.LastLaunch = now
							elseif now - base.LastLaunch >= 60 then
								base.LastLaunch = now
								local value = self:SellSilo(player, 1.15 + 0.05 * (padLevel - 1))
								if value > 0 then
									notify(player, "Launch pad shipped your silo: +" .. Format.Credits(value), "Good", "🚀")
									Net.Unreliable("WorldFX"):FireAllClients({ Kind = "Launch", Pos = self:_buildingPos(base, profile, "launch_pad") })
								end
							end
						end
						if self:BuildingLevelSum(player, "capsule_catcher") > 0 and now - base.LastCatch >= 45 then
							base.LastCatch = now
							local count = Registry.CapsuleService:Recall(player, profile, true)
							if count > 0 then
								notify(player, string.format("Capsule Catcher pulled in %d capsules", count), "Good", "🎯")
							end
						end
						sendStatus(base, profile)
					end)
					if not ok then
						warn("[BaseService] tick error: " .. tostring(err))
					end
				end
			end
		end
	end)
	local _ = Players
	local __ = WorldGrid
end

function BaseService:_padPowered(base: Base, profile): boolean
	for _, b in profile.Base.Buildings do
		if b.Id == "launch_pad" then
			local s = base.Status[b.Uid]
			return s == "Working" or s == "LowPower"
		end
	end
	return false
end

function BaseService:_buildingPos(base: Base, profile, id: string): Vector3?
	for _, b in profile.Base.Buildings do
		if b.Id == id then
			local m = base.Models[b.Uid]
			return m and m:GetPivot().Position
		end
	end
	return nil
end

return BaseService
