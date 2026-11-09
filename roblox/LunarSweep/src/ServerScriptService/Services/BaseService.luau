--!nonstrict
-- Personal bases: plot assignment, grid building placement/removal/upgrades, power grid,
-- conveyor connectivity (BFS), production chains, silo storage, launch-pad auto selling,
-- capsule catcher, offline production and live status replication.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local MapLayout = require(Shared.MapLayout)
local Buildings = require(Shared.Config.Buildings)
local Resources = require(Shared.Config.Resources)
local ModelFactory = require(Shared.ModelFactory)
local Net = require(Shared.Net)
local Registry = require(script.Parent.Registry)

local BaseService = {}

local GRID = MapLayout.PLOT_CELLS
local CELL = 4
local PAD_TOP = 1.0
local UNLIMITED = { conveyor = 250, foundation_tile = 250 }

type Base = {
	Player: Player,
	Plot: number,
	Origin: Vector3,
	Folder: Model,
	Models: { [number]: Model },
	Occ: { [number]: number }, -- cell index -> building uid
	Status: { [number]: string },
	PowerGen: number,
	PowerUse: number,
	LastLaunch: number,
	LastCatch: number,
	Income: number,
}

local bases: { [Player]: Base } = {}
local plotOwner: { [number]: Player } = {}
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

local function cellKey(x: number, z: number): number
	return z * GRID + x
end

function BaseService:WorldCFrame(base: Base, def, x: number, z: number, r: number): CFrame
	local w, d = footprint(def, r)
	local cx = base.Origin.X + (x + w / 2) * CELL
	local cz = base.Origin.Z + (z + d / 2) * CELL
	return CFrame.new(cx, PAD_TOP, cz) * CFrame.Angles(0, math.rad(90 * r), 0)
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
	model:PivotTo(BaseService:WorldCFrame(base, def, b.X, b.Z, b.R or 0))
	if b.Id == "command_center" then
		local root = model.PrimaryPart :: BasePart
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
		p.Parent = model.PrimaryPart
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
					base.Occ[cellKey(b.X + dx, b.Z + dz)] = b.Uid
				end
			end
		end
	end
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

function BaseService:HasPlot(player: Player): boolean
	return bases[player] ~= nil
end

function BaseService:PlotCenter(player: Player): Vector3?
	local base = bases[player]
	if not base then
		return nil
	end
	return base.Origin + Vector3.new(MapLayout.PLOT_SIZE / 2, PAD_TOP, MapLayout.PLOT_SIZE / 2)
end

-- docks for robots: world positions of robot docks (falls back to the command center)
function BaseService:DockPositions(player: Player): { Vector3 }
	local base = bases[player]
	local profile = Registry.DataService:Get(player)
	local out = {}
	if not base or not profile then
		return out
	end
	for _, b in profile.Base.Buildings do
		if b.Id == "robot_dock" or b.Id == "command_center" then
			local m = base.Models[b.Uid]
			if m then
				table.insert(out, m:GetPivot().Position + Vector3.new(0, 2, 0))
			end
		end
	end
	return out
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

function BaseService:NearOwnDeposit(player: Player, dist: number): boolean
	local base = bases[player]
	local character = player.Character
	local hrp = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
	local profile = Registry.DataService:Get(player)
	if not base or not hrp or not profile then
		return false
	end
	for _, b in profile.Base.Buildings do
		if b.Id == "deposit_hopper" then
			local m = base.Models[b.Uid]
			if m and (m:GetPivot().Position - hrp.Position).Magnitude <= dist then
				return true
			end
		end
	end
	return false
end

local function nearOwnStorage(player: Player, dist: number): boolean
	local base = bases[player]
	local character = player.Character
	local hrp = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
	local profile = Registry.DataService:Get(player)
	if not base or not hrp or not profile then
		return false
	end
	for _, b in profile.Base.Buildings do
		if b.Id == "deposit_hopper" or b.Id == "command_center" or b.Id == "dust_silo" then
			local m = base.Models[b.Uid]
			if m and (m:GetPivot().Position - hrp.Position).Magnitude <= dist then
				return true
			end
		end
	end
	return false
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
	local before = Formulas.ContentsKg(profile.Contents)
	if before <= 0.0001 then
		return false, "Your container is empty."
	end
	local moved = self:AddToSilo(player, profile.Contents)
	Registry.DataService:Mark(player, "Contents")
	Registry.PlayerService:UpdateFill(player)
	if moved <= 0 then
		return false, "Your silo is full! Sell it from the Base Terminal or build more Dust Silos."
	end
	Registry.DataService:AddStat(player, "Deposits", 1)
	local left = Formulas.ContentsKg(profile.Contents)
	return true, string.format("Stored %s in your silo%s", Format.Kg(moved), left > 0.001 and " (silo full, some dust left in your container)" or "")
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

function BaseService:CanPlace(player: Player, profile, id: string, x: number, z: number, r: number, ignoreCost: boolean?): (boolean, string?)
	local base = bases[player]
	local def = Buildings.ById[id]
	if not base then
		return false, "You don't have a plot yet."
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
	if x < 0 or z < 0 or x + w > GRID or z + d > GRID then
		return false, "Outside your plot."
	end
	for dx = 0, w - 1 do
		for dz = 0, d - 1 do
			if base.Occ[cellKey(x + dx, z + dz)] then
				return false, "Something is in the way."
			end
		end
	end
	if not ignoreCost and profile.Credits < Formulas.BuildingCost(id, profile) then
		return false, "Not enough credits."
	end
	return true
end

function BaseService:Place(player: Player, profile, id: string, x: number, z: number, r: number): (boolean, string?)
	local ok, msg = self:CanPlace(player, profile, id, x, z, r)
	if not ok then
		return false, msg
	end
	local cost = Formulas.BuildingCost(id, profile)
	if not Registry.EconomyService:Spend(player, cost) then
		return false, "Not enough credits."
	end
	local base = bases[player]
	profile.Base.Seq += 1
	local b = { Uid = profile.Base.Seq, Id = id, X = x, Z = z, R = r, Level = 1, Spent = cost }
	table.insert(profile.Base.Buildings, b)
	rebuildOcc(base, profile)
	spawnModel(base, b)
	Registry.DataService:Mark(player, "Base")
	Registry.DataService:AddStat(player, "BuildingsPlaced", 1)
	return true, Buildings.ById[id].Name .. " built"
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

-- Which non-conveyor buildings are linked to storage (adjacent or via conveyor chains)
local function connectivity(base: Base, profile): { [number]: boolean }
	local byUid = {}
	for _, b in profile.Base.Buildings do
		byUid[b.Uid] = b
	end
	local function isStorage(uid)
		local b = byUid[uid]
		return b and (b.Id == "command_center" or b.Id == "dust_silo")
	end
	local function isConveyor(uid)
		local b = byUid[uid]
		return b and b.Id == "conveyor"
	end
	local reached: { [number]: boolean } = {}
	local queue = {}
	for key, uid in base.Occ do
		if isStorage(uid) then
			table.insert(queue, key)
		end
	end
	local visited = {}
	local head = 1
	while head <= #queue do
		local key = queue[head]
		head += 1
		if not visited[key] then
			visited[key] = true
			local x, z = key % GRID, key // GRID
			for _, d in { { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } } do
				local nx, nz = x + d[1], z + d[2]
				if nx >= 0 and nz >= 0 and nx < GRID and nz < GRID then
					local nk = cellKey(nx, nz)
					local uid = base.Occ[nk]
					if uid then
						if isConveyor(uid) then
							if not visited[nk] then
								table.insert(queue, nk)
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
				-- space check (net growth of the silo)
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
	-- refinery gems accumulate fractionally
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
		Plot = base.Plot,
		Origin = base.Origin,
		PowerGen = base.PowerGen,
		PowerUse = base.PowerUse,
		Silo = profile.Base.Silo,
		SiloCap = Formulas.StorageCapacity(profile.Base.Buildings),
		Status = status,
		NextLaunch = base.LastLaunch > 0 and math.max(0, 60 - (os.clock() - base.LastLaunch)) or nil,
	})
end

------------------------------------------------------------------ plots

local function updatePlotSign(index: number, player: Player?)
	local model = Registry.HubBuilder.PlotModels[index]
	if not model then
		return
	end
	model:SetAttribute("Owner", player and player.UserId or 0)
	local gui = model:FindFirstChild("OwnerGui", true)
	local label = gui and gui:FindFirstChild("Text")
	if label then
		label.Text = player and (player.DisplayName .. "'s Base") or "FREE PLOT"
	end
	for _, d in model:GetChildren() do
		if d:IsA("BasePart") and d.Name == "Border" then
			d.Color = player and Color3.fromRGB(255, 122, 26) or Color3.fromRGB(120, 130, 150)
		end
	end
end

function BaseService:Assign(player: Player, profile)
	if bases[player] then
		return
	end
	local index
	for i = 1, #MapLayout.Plots do
		if not plotOwner[i] then
			index = i
			break
		end
	end
	if not index then
		warn("[BaseService] no free plot for " .. player.Name)
		return
	end
	plotOwner[index] = player
	local folder = Instance.new("Model")
	folder.Name = "Base_" .. player.UserId
	folder.ModelStreamingMode = Enum.ModelStreamingMode.Atomic
	folder.Parent = basesFolder
	local base: Base = {
		Player = player,
		Plot = index,
		Origin = MapLayout.PlotOrigin(index),
		Folder = folder,
		Models = {},
		Occ = {},
		Status = {},
		PowerGen = 0,
		PowerUse = 0,
		LastLaunch = 0,
		LastCatch = os.clock(),
		Income = 0,
	}
	bases[player] = base
	-- make sure a command center exists
	local hasCC = false
	for _, b in profile.Base.Buildings do
		if b.Id == "command_center" then
			hasCC = true
		end
	end
	if not hasCC then
		profile.Base.Seq += 1
		table.insert(profile.Base.Buildings, 1, { Uid = profile.Base.Seq, Id = "command_center", X = 10, Z = 10, R = 0, Level = 1, Spent = 0 })
	end
	-- drop any invalid saved buildings (unknown ids / overlaps)
	local valid = {}
	local occ = {}
	for _, b in profile.Base.Buildings do
		local def = Buildings.ById[b.Id]
		if def then
			local w, d = footprint(def, b.R or 0)
			local ok = b.X >= 0 and b.Z >= 0 and b.X + w <= GRID and b.Z + d <= GRID
			for dx = 0, w - 1 do
				for dz = 0, d - 1 do
					if occ[cellKey(b.X + dx, b.Z + dz)] then
						ok = false
					end
				end
			end
			if ok then
				for dx = 0, w - 1 do
					for dz = 0, d - 1 do
						occ[cellKey(b.X + dx, b.Z + dz)] = true
					end
				end
				table.insert(valid, b)
			end
		end
	end
	profile.Base.Buildings = valid
	rebuildOcc(base, profile)
	for i, b in profile.Base.Buildings do
		spawnModel(base, b)
		if i % 10 == 0 then
			task.wait()
		end
	end
	updatePlotSign(index, player)
	player:SetAttribute("Plot", index)
	-- offline production (capped)
	local last = profile.Base.LastTick or 0
	if last > 0 then
		local elapsed = math.min(os.time() - last, GameConfig.OfflineCapHours * 3600)
		if elapsed > 60 then
			local before = Formulas.ContentsKg(profile.Base.Silo)
			local steps = 40
			for _ = 1, steps do
				self:Tick(base, profile, elapsed / steps, true)
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
	plotOwner[base.Plot] = nil
	base.Folder:Destroy()
	updatePlotSign(base.Plot, nil)
end

function BaseService:GetBase(player: Player): Base?
	return bases[player]
end

------------------------------------------------------------------ lifecycle

function BaseService:Init()
	basesFolder = Workspace:WaitForChild("Bases") :: Folder
end

function BaseService:Start()
	local R = Registry.Router
	R.Register("PlaceBuilding", function(player, profile, payload)
		return self:Place(player, profile, payload.Id, payload.X, payload.Z, payload.R or 0)
	end, 6, 10)
	R.Register("RemoveBuilding", function(player, profile, payload)
		if type(payload.Uid) ~= "number" then
			return false, "Bad building"
		end
		return self:Remove(player, profile, payload.Uid)
	end, 4, 8)
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
		local center = self:PlotCenter(player)
		if not center then
			return false, "No base assigned."
		end
		return Registry.ZoneService:TeleportPlayer(player, center + Vector3.new(0, 4, -40))
	end, 1, 2)
	R.Register("GetBaseStatus", function(player, profile)
		local base = bases[player]
		if base then
			sendStatus(base, profile)
		end
		return true
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

	-- production loop
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
						-- launch pad auto-sell
						local padLevel = self:BuildingLevelSum(player, "launch_pad")
						if padLevel > 0 and (base.Status and self:_padPowered(base, profile)) then
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
						-- capsule catcher
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
