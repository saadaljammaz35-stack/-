--!nonstrict
-- Robots with real AI on the server.
--   cleaner   : warps to its assigned zone, flies to dirty cells and cleans terrain along its
--               path (same SectorService code as players), returns home when full or low on
--               battery, unloads into the silo, recharges at a dock.
--   collector : hunts debris pickups in its zone.
--   hauler    : fetches its owner's dropped capsules home (Cargo Lifter also auto-sells).
--   helper    : follows its owner and grants a passive bonus.
-- Movement uses AlignPosition/AlignOrientation on an unanchored root (smooth replication).
-- Energy (battery %) drains while working and recharges at docks depending on base power.
-- Wear (durability %) drops while working; broken robots must be repaired with credits.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local Robots = require(Shared.Config.Robots)
local Zones = require(Shared.Config.Zones)
local MapLayout = require(Shared.MapLayout)
local ModelFactory = require(Shared.ModelFactory)
local Net = require(Shared.Net)
local Registry = require(script.Parent.Registry)

local RobotService = {}

local MAX_OWNED = 30
local folder: Folder

type Runtime = {
	Data: any,
	Def: any,
	Owner: Player,
	Model: Model?,
	Root: BasePart?,
	Align: AlignPosition?,
	Orient: AlignOrientation?,
	State: string,
	Target: Vector3?,
	TargetCapsule: any?,
	Pos: Vector3,
	Timer: number,
	Cargo: { [string]: number },
	LastSell: number,
}

local runtimes: { [Player]: { [number]: Runtime } } = {}

local function notify(player: Player, text: string, kind: string?)
	Net.Event("Notify"):FireClient(player, { Text = text, Kind = kind or "Info", Icon = "🤖" })
end

------------------------------------------------------------------ data helpers

local function findRobot(profile, uid: number)
	for i, r in profile.Robots do
		if r.Uid == uid then
			return r, i
		end
	end
	return nil, nil
end

function RobotService:Slots(player: Player): number
	local profile = Registry.DataService:Get(player)
	if not profile then
		return 0
	end
	return Formulas.RobotSlots(profile.Base.Buildings, profile)
end

function RobotService:ActiveCount(profile): number
	local n = 0
	for _, r in profile.Robots do
		if r.Active then
			n += 1
		end
	end
	return n
end

function RobotService:GiveRobot(player: Player, robotId: string): boolean
	local profile = Registry.DataService:Get(player)
	local def = Robots.ById[robotId]
	if not profile or not def then
		return false
	end
	if #profile.Robots >= MAX_OWNED then
		return false
	end
	profile.RobotSeq += 1
	local r = {
		Uid = profile.RobotSeq,
		Id = robotId,
		Level = 1,
		Durability = 100,
		Battery = 100,
		Zone = "dusty_flats",
		Active = false,
		Kg = 0,
	}
	-- default to the best unlocked zone
	local best = 1
	for id, v in profile.Zones do
		local z = Zones.ById[id]
		if v and z and z.Index > best then
			best = z.Index
			r.Zone = id
		end
	end
	if self:ActiveCount(profile) < self:Slots(player) then
		r.Active = true
	end
	table.insert(profile.Robots, r)
	Registry.DataService:Mark(player, "Robots")
	Registry.DataService:MaxStat(player, "RobotsOwned", #profile.Robots)
	if r.Active then
		self:SpawnRuntime(player, r)
	end
	return true
end

-- deactivate robots beyond the slot count (after removing docks)
function RobotService:ClampToSlots(player: Player)
	local profile = Registry.DataService:Get(player)
	if not profile then
		return
	end
	local slots = self:Slots(player)
	local active = 0
	for _, r in profile.Robots do
		if r.Active then
			active += 1
			if active > slots then
				r.Active = false
				self:DespawnRuntime(player, r.Uid)
			end
		end
	end
	Registry.DataService:Mark(player, "Robots")
end

------------------------------------------------------------------ runtime / physics

local function setAttrs(rt: Runtime)
	local m = rt.Model
	if not m then
		return
	end
	local stats = Formulas.RobotStats(rt.Data.Id, rt.Data.Level, Registry.DataService:Get(rt.Owner) or {})
	m:SetAttribute("State", rt.State)
	m:SetAttribute("Battery", math.floor(rt.Data.Battery))
	m:SetAttribute("Durability", math.floor(rt.Data.Durability))
	m:SetAttribute("Kg", Formulas.ContentsKg(rt.Cargo))
	m:SetAttribute("Cap", stats.Capacity)
	m:SetAttribute("Level", rt.Data.Level)
end

local function ensureModel(rt: Runtime, pos: Vector3)
	if rt.Model and rt.Model.Parent then
		return
	end
	local model = ModelFactory.Robot(rt.Data.Id, true)
	model.Name = rt.Def.Name
	model:SetAttribute("Owner", rt.Owner.UserId)
	model:SetAttribute("OwnerName", rt.Owner.DisplayName)
	model:SetAttribute("Uid", rt.Data.Uid)
	local root = model.PrimaryPart :: BasePart
	root.CFrame = CFrame.new(pos)
	model:PivotTo(CFrame.new(pos))
	local att = Instance.new("Attachment")
	att.Name = "AlignAttachment"
	att.Parent = root
	local align = Instance.new("AlignPosition")
	align.Mode = Enum.PositionAlignmentMode.OneAttachment
	align.Attachment0 = att
	align.MaxForce = 1e6
	align.MaxVelocity = rt.Def.Speed * 1.6
	align.Responsiveness = 18
	align.Position = pos
	align.Parent = root
	local orient = Instance.new("AlignOrientation")
	orient.Mode = Enum.OrientationAlignmentMode.OneAttachment
	orient.Attachment0 = att
	orient.MaxTorque = 1e6
	orient.Responsiveness = 12
	orient.CFrame = CFrame.new()
	orient.Parent = root
	model.Parent = folder
	pcall(function()
		root:SetNetworkOwner(nil)
	end)
	rt.Model, rt.Root, rt.Align, rt.Orient = model, root, align, orient
	rt.Pos = pos
	setAttrs(rt)
end

local function hideModel(rt: Runtime)
	if rt.Model then
		rt.Model:Destroy()
	end
	rt.Model, rt.Root, rt.Align, rt.Orient = nil, nil, nil, nil
end

local function hoverHeight(pos: Vector3): number
	return Registry.WorldService:GroundAt(pos.X, pos.Z, pos.Y) + GameConfig.RobotHover
end

-- step toward `target`; returns true when arrived
local function moveToward(rt: Runtime, target: Vector3, speed: number, dt: number): boolean
	local flat = Vector3.new(target.X - rt.Pos.X, 0, target.Z - rt.Pos.Z)
	local dist = flat.Magnitude
	local step = math.min(dist, speed * dt)
	local nextPos = rt.Pos
	if dist > 0.05 then
		nextPos = rt.Pos + flat.Unit * step
	end
	local y = hoverHeight(nextPos)
	-- in caves / asteroids keep the target layer
	if math.abs(y - target.Y) > 40 then
		y = target.Y + GameConfig.RobotHover
	end
	nextPos = Vector3.new(nextPos.X, y, nextPos.Z)
	rt.Pos = nextPos
	if rt.Align then
		rt.Align.MaxVelocity = speed * 1.8
		rt.Align.Position = nextPos
	end
	if rt.Orient and dist > 0.5 then
		rt.Orient.CFrame = CFrame.lookAt(Vector3.zero, Vector3.new(flat.X, 0, flat.Z))
	end
	return dist <= 1.5
end

local function zoneAnchor(zoneId: string): Vector3
	return Registry.WorldService:GetSpawn(zoneId)
end

local function dockPosition(rt: Runtime): Vector3?
	local docks = Registry.BaseService:DockPositions(rt.Owner)
	if #docks == 0 then
		return nil
	end
	local idx = (rt.Data.Uid % #docks) + 1
	local p = docks[idx]
	local ang = (rt.Data.Uid * 1.7) % (math.pi * 2)
	return p + Vector3.new(math.cos(ang) * 4, 2, math.sin(ang) * 4)
end

function RobotService:SpawnRuntime(player: Player, data)
	local def = Robots.ById[data.Id]
	if not def then
		return
	end
	runtimes[player] = runtimes[player] or {}
	if runtimes[player][data.Uid] then
		return
	end
	local rt: Runtime = {
		Data = data,
		Def = def,
		Owner = player,
		Model = nil,
		State = "Docked",
		Pos = Vector3.zero,
		Timer = 0,
		Cargo = {},
		LastSell = os.clock(),
	}
	if def.Role == "helper" then
		rt.State = "Following"
	end
	runtimes[player][data.Uid] = rt
	local dock = dockPosition(rt)
	if dock then
		ensureModel(rt, dock)
	end
end

function RobotService:DespawnRuntime(player: Player, uid: number)
	local list = runtimes[player]
	local rt = list and list[uid]
	if not rt then
		return
	end
	-- unload cargo so nothing is lost
	if next(rt.Cargo) then
		Registry.BaseService:AddToSilo(player, rt.Cargo, true)
	end
	hideModel(rt)
	list[uid] = nil
end

------------------------------------------------------------------ AI

local function unload(rt: Runtime)
	if not next(rt.Cargo) then
		return true
	end
	local kg = Formulas.ContentsKg(rt.Cargo)
	local moved = Registry.BaseService:AddToSilo(rt.Owner, rt.Cargo)
	if moved > 0 then
		Registry.DataService:AddStat(rt.Owner, "RobotKg", moved)
	end
	return Formulas.ContentsKg(rt.Cargo) < 1e-4 or moved >= kg - 1e-4
end

local function work(rt: Runtime, profile, stats, dt: number)
	local def = rt.Def
	local data = rt.Data
	local eff = 0.6 + 0.4 * (data.Durability / 100)
	local speed = stats.Speed * eff
	-- drain & wear
	data.Battery = math.max(0, data.Battery - (100 / stats.Battery) * dt)
	data.Durability = math.max(0, data.Durability - stats.Wear * dt / 60)
	local cargoKg = Formulas.ContentsKg(rt.Cargo)
	if data.Durability <= 0 then
		rt.State = "Broken"
		notify(rt.Owner, def.Name .. " broke down! Repair it in the Robots panel.", "Warning")
		return
	end
	if data.Battery <= 10 or (def.Role ~= "hauler" and cargoKg >= stats.Capacity - 1e-3) then
		rt.State = "Returning"
		rt.Timer = 0
		return
	end
	if def.Role == "cleaner" then
		if not rt.Target or (math.random() < 0.02) then
			rt.Target = Registry.SectorService:FindDirtyTarget(data.Zone, rt.Pos)
			if not rt.Target then
				rt.State = "NoWork"
				return
			end
		end
		local from = rt.Pos
		local target: Vector3 = rt.Target :: Vector3
		local arrived = moveToward(rt, target, speed, dt)
		local res = Registry.SectorService:CleanSegment(Vector3.new(from.X, target.Y, from.Z), Vector3.new(rt.Pos.X, target.Y, rt.Pos.Z), math.max(1.5, stats.Width / 2), {
			Depth = 0.8,
			MaxKg = stats.Capacity - cargoKg,
			UserId = rt.Owner.UserId,
			MaxHeightDiff = 20,
		})
		for res2, kg in res.ByRes do
			rt.Cargo[res2] = (rt.Cargo[res2] or 0) + kg
		end
		if arrived then
			rt.Target = nil
		end
	elseif def.Role == "collector" then
		local p = Registry.PickupService:NearestInZone(data.Zone, rt.Pos, 400)
		if not p then
			-- sweep around slowly while waiting
			rt.Target = rt.Target or Registry.SectorService:FindDirtyTarget(data.Zone, rt.Pos)
			if rt.Target and moveToward(rt, rt.Target, speed * 0.5, dt) then
				rt.Target = nil
			end
			return
		end
		moveToward(rt, p.Pos, speed, dt)
		local picks = Registry.PickupService:CollectNear(rt.Pos, math.max(4, stats.Magnet * 0.4), stats.Capacity - cargoKg, 0.15, nil, 1)
		for _, pk in picks do
			rt.Cargo[pk.Res] = (rt.Cargo[pk.Res] or 0) + pk.Kg
		end
	elseif def.Role == "hauler" then
		local cap = rt.TargetCapsule
		if not cap or cap.Claimed or cap.Carried then
			cap = nil
			local best, bd = nil, math.huge
			for _, c in Registry.CapsuleService:OwnedBy(rt.Owner.UserId) do
				if not c.Carried then
					local d = (c.Model:GetPivot().Position - rt.Pos).Magnitude
					if d < bd then
						best, bd = c, d
					end
				end
			end
			rt.TargetCapsule = best
			cap = best
			if cap and bd > 250 then
				-- long haul: warp next to the capsule
				rt.State = "Travel"
				rt.Timer = math.min(15, bd / (speed * 3))
				rt.Target = cap.Model:GetPivot().Position + Vector3.new(6, 3, 6)
				return
			end
		end
		if not cap then
			if next(rt.Cargo) then
				rt.State = "Returning"
				rt.Timer = 0
			else
				rt.State = "Docked"
			end
			return
		end
		local cpos = cap.Model:GetPivot().Position
		if moveToward(rt, cpos + Vector3.new(0, 2, 0), speed, dt) or (cpos - rt.Pos).Magnitude < 6 then
			local contents = Registry.CapsuleService:Claim(cap)
			if contents then
				for res, kg in contents do
					rt.Cargo[res] = (rt.Cargo[res] or 0) + kg
				end
			end
			rt.TargetCapsule = nil
			rt.State = "Returning"
			rt.Timer = 0
		end
	end
end

function RobotService:Step(rt: Runtime, dt: number)
	local player = rt.Owner
	local profile = Registry.DataService:Get(player)
	if not profile then
		return
	end
	local data = rt.Data
	local def = rt.Def
	local stats = Formulas.RobotStats(data.Id, data.Level, profile)
	if def.Role == "helper" then
		local character = player.Character
		local hrp = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
		if not hrp then
			return
		end
		local offset = CFrame.Angles(0, math.rad(40 + (data.Uid % 4) * 70), 0) * Vector3.new(0, 0, 7)
		local goal = hrp.Position + offset
		if not rt.Model then
			ensureModel(rt, goal + Vector3.new(0, 3, 0))
		end
		if (rt.Pos - goal).Magnitude > 160 then
			rt.Pos = goal
			if rt.Root then
				rt.Root.CFrame = CFrame.new(goal + Vector3.new(0, 3, 0))
			end
		end
		local target = Vector3.new(goal.X, hrp.Position.Y + 1.5, goal.Z)
		local flat = Vector3.new(target.X - rt.Pos.X, 0, target.Z - rt.Pos.Z)
		local move = math.min(flat.Magnitude, stats.Speed * dt * 1.4)
		if flat.Magnitude > 0.1 then
			rt.Pos += flat.Unit * move
		end
		rt.Pos = Vector3.new(rt.Pos.X, target.Y, rt.Pos.Z)
		if rt.Align then
			rt.Align.MaxVelocity = stats.Speed * 2.5
			rt.Align.Position = rt.Pos
		end
		if rt.Orient then
			rt.Orient.CFrame = CFrame.lookAt(Vector3.zero, hrp.CFrame.LookVector)
		end
		data.Durability = math.max(0, data.Durability - stats.Wear * dt / 600)
		rt.State = data.Durability > 0 and "Following" or "Broken"
		-- repair drone: heals other robots
		if def.Bonus and def.Bonus.Repair then
			local mine: any = runtimes[player] or {}
			for _, other in mine do
				if other ~= rt and other.Data.Durability < 100 then
					other.Data.Durability = math.min(100, other.Data.Durability + def.Bonus.Repair * dt / 10)
				end
			end
		end
		return
	end

	-- non-helpers
	if rt.State == "Docked" or rt.State == "NoWork" or rt.State == "SiloFull" then
		local dock = dockPosition(rt)
		if dock then
			ensureModel(rt, dock)
			moveToward(rt, dock, stats.Speed, dt)
		end
		if next(rt.Cargo) then
			if not unload(rt) then
				rt.State = "SiloFull"
				return
			end
		end
		local mult = Registry.BaseService:ChargeMultiplier(player)
		data.Battery = math.min(100, data.Battery + GameConfig.RobotChargeRate * mult * dt)
		if rt.State == "NoWork" then
			rt.Timer += dt
			if rt.Timer > 10 then
				rt.State = "Docked"
				rt.Timer = 0
			end
			return
		end
		rt.State = "Docked"
		if data.Battery >= 95 and data.Durability > 0 then
			if def.Role == "hauler" then
				if #Registry.CapsuleService:OwnedBy(player.UserId) > 0 then
					rt.State = "Working"
				end
			elseif profile.Zones[data.Zone] then
				rt.State = "Travel"
				rt.Timer = math.min(12, (zoneAnchor(data.Zone) - rt.Pos).Magnitude / (stats.Speed * 4))
				rt.Target = nil
			end
		end
		-- cargo lifter auto sale
		if def.Bonus and def.Bonus.AutoSell and os.clock() - rt.LastSell > 90 then
			rt.LastSell = os.clock()
			local value = Registry.BaseService:SellSilo(player, 1 + def.Bonus.AutoSell)
			if value > 0 then
				notify(player, "Cargo Lifter sold your silo: +" .. Format.Credits(value), "Good")
			end
		end
	elseif rt.State == "Travel" then
		hideModel(rt)
		rt.Timer -= dt
		if rt.Timer <= 0 then
			local dest = rt.Target or zoneAnchor(data.Zone)
			if def.Role ~= "hauler" then
				local t = Registry.SectorService:FindDirtyTarget(data.Zone, dest)
				dest = t or dest
				rt.Target = nil
			end
			ensureModel(rt, dest + Vector3.new(0, GameConfig.RobotHover, 0))
			rt.State = "Working"
			Net.Unreliable("WorldFX"):FireAllClients({ Kind = "Warp", Pos = dest })
		end
	elseif rt.State == "Working" then
		if not rt.Model then
			ensureModel(rt, rt.Pos)
		end
		work(rt, profile, stats, dt)
	elseif rt.State == "Returning" then
		if rt.Timer == 0 then
			Net.Unreliable("WorldFX"):FireAllClients({ Kind = "Warp", Pos = rt.Pos })
			hideModel(rt)
			local dock = dockPosition(rt)
			rt.Timer = dock and math.min(12, (dock - rt.Pos).Magnitude / (stats.Speed * 4)) + 0.01 or 5
		end
		rt.Timer -= dt
		if rt.Timer <= 0 then
			rt.Timer = 0
			local dock = dockPosition(rt)
			if dock then
				ensureModel(rt, dock)
				local unloaded = unload(rt)
				rt.State = unloaded and "Docked" or "SiloFull"
				if not unloaded then
					notify(player, def.Name .. " can't unload - your silo is full.", "Warning")
				end
			else
				rt.State = "Docked"
			end
		end
	elseif rt.State == "Broken" then
		local dock = dockPosition(rt)
		if dock then
			ensureModel(rt, dock)
			moveToward(rt, dock, 6, dt)
		end
		if data.Durability > 0 then
			rt.State = "Docked"
		end
	end
	setAttrs(rt)
end

------------------------------------------------------------------ requests

local function sellRobot(player, profile, payload)
	local r, index = findRobot(profile, payload.Uid)
	if not r then
		return false, "Robot not found."
	end
	local value = Formulas.RobotSellValue(r.Id, r.Level)
	RobotService:DespawnRuntime(player, r.Uid)
	table.remove(profile.Robots, index)
	Registry.EconomyService:AddCredits(player, value, false)
	Registry.DataService:Mark(player, "Robots")
	return true, "Robot sold for " .. Format.Credits(value)
end

function RobotService:Init()
	folder = Workspace:WaitForChild("Robots") :: Folder
end

function RobotService:Start()
	local R = Registry.Router
	R.Register("BuyRobot", function(player, profile, payload)
		local def = type(payload.Id) == "string" and Robots.ById[payload.Id]
		if not def or def.Source ~= "shop" then
			return false, "That robot isn't sold here."
		end
		if profile.Level < def.Level then
			return false, string.format("Requires level %d.", def.Level)
		end
		if #profile.Robots >= MAX_OWNED then
			return false, "Robot hangar full (30)."
		end
		local price = Formulas.ShopPrice(def.Price, profile)
		if not Registry.EconomyService:Spend(player, price) then
			return false, "Not enough credits."
		end
		self:GiveRobot(player, def.Id)
		local last = profile.Robots[#profile.Robots]
		if last and not last.Active then
			return true, def.Name .. " bought - no free slot, build a Robot Dock to activate it."
		end
		return true, def.Name .. " deployed!"
	end, 2, 4)
	R.Register("SellRobot", sellRobot, 2, 4)
	R.Register("RobotSetZone", function(player, profile, payload)
		local r = findRobot(profile, payload.Uid)
		if not r or type(payload.Zone) ~= "string" or not Zones.ById[payload.Zone] then
			return false, "Bad request."
		end
		if not profile.Zones[payload.Zone] then
			return false, "Unlock that zone first."
		end
		r.Zone = payload.Zone
		Registry.DataService:Mark(player, "Robots")
		local rt = runtimes[player] and runtimes[player][r.Uid]
		if rt and rt.State == "Working" then
			rt.State = "Returning"
			rt.Timer = 0
		end
		return true, "Assigned to " .. Zones.ById[payload.Zone].Name
	end, 4, 8)
	R.Register("RobotToggle", function(player, profile, payload)
		local r = findRobot(profile, payload.Uid)
		if not r then
			return false, "Robot not found."
		end
		local want = payload.Active == true
		if want and not r.Active then
			if self:ActiveCount(profile) >= self:Slots(player) then
				return false, "No free robot slot. Build or upgrade a Robot Dock."
			end
			r.Active = true
			self:SpawnRuntime(player, r)
		elseif not want and r.Active then
			r.Active = false
			self:DespawnRuntime(player, r.Uid)
		end
		Registry.DataService:Mark(player, "Robots")
		return true
	end, 4, 8)
	R.Register("RobotRepair", function(player, profile, payload)
		local r = findRobot(profile, payload.Uid)
		if not r then
			return false, "Robot not found."
		end
		if r.Durability >= 99.5 then
			return false, "Already in perfect shape."
		end
		local cost = Formulas.RobotRepairCost(r.Id, r.Level, r.Durability)
		if not Registry.EconomyService:Spend(player, cost) then
			return false, "Not enough credits."
		end
		r.Durability = 100
		Registry.DataService:Mark(player, "Robots")
		return true, "Repaired for " .. Format.Credits(cost)
	end, 3, 6)
	R.Register("RobotUpgrade", function(player, profile, payload)
		local r = findRobot(profile, payload.Uid)
		if not r then
			return false, "Robot not found."
		end
		if r.Level >= Robots.MaxLevel then
			return false, "Max level."
		end
		local cost = Formulas.RobotUpgradeCost(r.Id, r.Level)
		if not Registry.EconomyService:Spend(player, cost) then
			return false, "Not enough credits."
		end
		r.Level += 1
		Registry.DataService:Mark(player, "Robots")
		return true, string.format("Upgraded to level %d", r.Level)
	end, 3, 6)
	R.Register("RobotRecall", function(player, profile, payload)
		local rt = runtimes[player] and runtimes[player][payload.Uid]
		if not rt then
			return false, "Robot is not active."
		end
		if rt.State == "Working" then
			rt.State = "Returning"
			rt.Timer = 0
		end
		return true, "Recalling robot"
	end, 3, 6)

	Registry.DataService.Loaded:Connect(function(player, profile)
		task.spawn(function()
			Registry.WorldService:WaitReady()
			while player.Parent and not Registry.BaseService:HasPlot(player) do
				task.wait(0.5)
			end
			if not player.Parent then
				return
			end
			-- offline robot work (estimate), capped
			local last = profile.LastLogout or 0
			if last > 0 then
				local elapsed = math.min(os.time() - last, GameConfig.OfflineCapHours * 3600)
				local total = 0
				for _, r in profile.Robots do
					local def = Robots.ById[r.Id]
					local zone = Zones.ById[r.Zone]
					if r.Active and def and zone and (def.Role == "cleaner" or def.Role == "collector") and r.Durability > 0 then
						local stats = Formulas.RobotStats(r.Id, r.Level, profile)
						local perSecond = def.Role == "cleaner" and (stats.Width * stats.Speed / 16 * 0.35 * zone.DustPerCell * 0.8) or (0.002 * stats.Magnet)
						local kg = perSecond * elapsed * 0.55
						local res = {}
						res[zone.DustResource] = kg
						total += Registry.BaseService:AddToSilo(player, res)
						r.Durability = math.max(1, r.Durability - stats.Wear * (elapsed * 0.55) / 60)
					end
				end
				if total > 0.01 then
					Registry.DataService:AddStat(player, "RobotKg", total)
					task.delay(9, function()
						if player.Parent then
							notify(player, string.format("Your robots collected %s while you were away.", Format.Kg(total)), "Good")
						end
					end)
				end
			end
			self:ClampToSlots(player)
			for _, r in profile.Robots do
				if r.Active then
					self:SpawnRuntime(player, r)
				end
			end
		end)
	end)
	Registry.DataService.Releasing:Connect(function(player)
		local list: any = runtimes[player] or {}
		for uid in table.clone(list) do
			self:DespawnRuntime(player, uid)
		end
		runtimes[player] = nil
	end)

	-- AI loop
	task.spawn(function()
		local dt = GameConfig.RobotTick
		local counter = 0
		while true do
			task.wait(dt)
			counter += 1
			for player, list in runtimes do
				if player.Parent then
					for _, rt in list do
						local ok, err = pcall(self.Step, self, rt, dt)
						if not ok then
							warn("[RobotService] step error: " .. tostring(err))
							rt.State = "Docked"
						end
					end
					if counter % 20 == 0 then
						Registry.DataService:Mark(player, "Robots")
					end
				end
			end
		end
	end)
	local _ = MapLayout
end

return RobotService
