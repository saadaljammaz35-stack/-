--!nonstrict
-- Drivable hover vehicles. Bought and spawned at a garage (the colony Motor Pool or your own
-- Garage building). The owner drives with network ownership; the client steers through the
-- chassis LinearVelocity "Drive" and AlignOrientation "Steer" constraints (VehicleController).
-- When nobody is in the driver seat the server anchors the chassis where it stopped.
--
-- Cargo: cleaning vehicles fill their hopper (profile.VehicleCargo, persisted). Empty it at
-- the Dust Exchange, your Command Center / silo / hopper, or press Q to pack it in a capsule.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local Vehicles = require(Shared.Config.Vehicles)
local Formulas = require(Shared.Formulas)
local ModelFactory = require(Shared.ModelFactory)
local Net = require(Shared.Net)
local Registry = require(script.Parent.Registry)

local VehicleService = {}

VehicleService.GARAGE_RANGE = 70 -- how close you must be to a garage to take a vehicle out
VehicleService.HOVER = 1.0 -- clearance between the hover pods and the ground

type Active = {
	Player: Player,
	Id: string,
	Model: Model,
	Chassis: BasePart,
	Seat: VehicleSeat,
	Driving: boolean,
	Parking: number,
}

local active: { [Player]: Active } = {}
local folder: Folder

local function notify(player: Player, text: string, kind: string?)
	Net.Event("Notify"):FireClient(player, { Text = text, Kind = kind or "Info", Icon = "🚙" })
end

local function hrpOf(player: Player): BasePart?
	local character = player.Character
	return character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
end

function VehicleService:Get(player: Player): Active?
	return active[player]
end

function VehicleService:IsDriving(player: Player): boolean
	local a = active[player]
	return a ~= nil and a.Driving
end

function VehicleService:HoverHeight(id: string): number
	local def = Vehicles.ById[id] or Vehicles.List[1]
	return def.Size.Y * 0.5 + self.HOVER
end

function VehicleService:CargoKg(profile): number
	return Formulas.ContentsKg(profile.VehicleCargo or {})
end

function VehicleService:UpdateAttributes(player: Player)
	local profile = Registry.DataService:Get(player)
	if not profile then
		return
	end
	local a = active[player]
	local kg = self:CargoKg(profile)
	player:SetAttribute("VehicleKg", kg)
	if a then
		local st = Formulas.VehicleStats(profile, a.Id)
		player:SetAttribute("VehicleCap", st.Hopper)
		player:SetAttribute("VehicleId", a.Id)
		a.Model:SetAttribute("Cargo", kg)
		a.Model:SetAttribute("Hopper", st.Hopper)
		a.Model:SetAttribute("MaxSpeed", st.Speed)
		a.Model:SetAttribute("Turbo", st.Turbo)
		a.Model:SetAttribute("Width", st.Width)
		a.Model:SetAttribute("Hover", self:HoverHeight(a.Id))
		local gauge = a.Model:FindFirstChild("HopperGauge")
		if gauge and gauge:IsA("BasePart") and st.Hopper > 0 then
			local f = math.clamp(kg / st.Hopper, 0, 1)
			gauge.Color = Color3.fromRGB(80, 220, 120):Lerp(Color3.fromRGB(255, 70, 50), f)
		end
	else
		player:SetAttribute("VehicleCap", 0)
		player:SetAttribute("VehicleId", nil)
	end
end

------------------------------------------------------------------ garages

-- All garage bays the player may use: the colony Motor Pool plus their own Garage buildings.
function VehicleService:GarageBays(player: Player): { CFrame }
	local out = {}
	local hub = Registry.HubBuilder
	if hub and hub.GarageBays then
		for _, cf in hub.GarageBays do
			table.insert(out, cf)
		end
	end
	if Registry.BaseService and Registry.BaseService.GaragePositions then
		for _, cf in Registry.BaseService:GaragePositions(player) do
			table.insert(out, cf)
		end
	end
	return out
end

function VehicleService:NearestBay(player: Player, maxDist: number?): CFrame?
	local hrp = hrpOf(player)
	if not hrp then
		return nil
	end
	local best, bd = nil, maxDist or math.huge
	for _, cf in self:GarageBays(player) do
		local d = (Vector3.new(cf.X, 0, cf.Z) - Vector3.new(hrp.Position.X, 0, hrp.Position.Z)).Magnitude
		if d < bd then
			best, bd = cf, d
		end
	end
	return best
end

------------------------------------------------------------------ spawn / park / store

local function setConstraints(a: Active, on: boolean)
	local drive = a.Chassis:FindFirstChild("Drive")
	local steer = a.Chassis:FindFirstChild("Steer")
	if drive then
		drive.Enabled = on
	end
	if steer then
		steer.Enabled = on
	end
end

local function park(a: Active)
	a.Driving = false
	local chassis = a.Chassis
	if not chassis.Parent then
		return
	end
	pcall(function()
		chassis:SetNetworkOwner(nil)
	end)
	setConstraints(a, false)
	chassis.AssemblyLinearVelocity = Vector3.zero
	chassis.AssemblyAngularVelocity = Vector3.zero
	-- settle level at hover height over the ground below
	local pos = chassis.Position
	local look = chassis.CFrame.LookVector
	local flat = Vector3.new(look.X, 0, look.Z)
	if flat.Magnitude < 0.1 then
		flat = Vector3.new(0, 0, -1)
	end
	local ground = Registry.WorldService:GroundAt(pos.X, pos.Z, pos.Y)
	local y = (math.abs(ground - pos.Y) < 30) and (ground + VehicleService:HoverHeight(a.Id)) or pos.Y
	chassis.Anchored = true
	a.Model:PivotTo(CFrame.lookAt(Vector3.new(pos.X, y, pos.Z), Vector3.new(pos.X, y, pos.Z) + flat.Unit))
	a.Player:SetAttribute("Driving", nil)
	local character = a.Player.Character
	if character then
		character:SetAttribute("VehicleSpeed", nil)
	end
end

local function startDriving(a: Active, hum: Humanoid)
	local profile = Registry.DataService:Get(a.Player)
	if not profile then
		return
	end
	local st = Formulas.VehicleStats(profile, a.Id)
	a.Driving = true
	a.Chassis.Anchored = false
	setConstraints(a, true)
	local drive = a.Chassis:FindFirstChild("Drive")
	if drive then
		drive.VectorVelocity = Vector3.zero
	end
	pcall(function()
		a.Chassis:SetNetworkOwner(a.Player)
	end)
	a.Player:SetAttribute("Driving", a.Id)
	local character = hum.Parent
	if character then
		-- generous allowance for the movement sanity check (turbo + slopes)
		character:SetAttribute("VehicleSpeed", st.Speed * (1 + st.Turbo) * 1.25 + 8)
	end
	-- carried capsules are dropped when you get in
	if Registry.CapsuleService then
		Registry.CapsuleService:Drop(a.Player)
	end
end

local function addPhysics(model: Model, chassis: BasePart)
	local root = Instance.new("Attachment")
	root.Name = "Root"
	root.Parent = chassis
	local drive = Instance.new("LinearVelocity")
	drive.Name = "Drive"
	drive.Attachment0 = root
	drive.RelativeTo = Enum.ActuatorRelativeTo.World
	drive.VelocityConstraintMode = Enum.VelocityConstraintMode.Vector
	local okMass, mass = pcall(function()
		return chassis.AssemblyMass
	end)
	drive.MaxForce = math.max(1e6, (okMass and mass or 0) * 400)
	drive.VectorVelocity = Vector3.zero
	drive.Enabled = false
	drive.Parent = chassis
	local steer = Instance.new("AlignOrientation")
	steer.Name = "Steer"
	steer.Mode = Enum.OrientationAlignmentMode.OneAttachment
	steer.Attachment0 = root
	steer.MaxTorque = 1e7
	steer.Responsiveness = 30
	steer.CFrame = chassis.CFrame.Rotation
	steer.Enabled = false
	steer.Parent = chassis
	model:SetAttribute("Physics", true)
end

function VehicleService:Despawn(player: Player)
	local a = active[player]
	if not a then
		return
	end
	active[player] = nil
	if a.Seat.Occupant then
		a.Seat.Occupant.Sit = false
		local weld = a.Seat:FindFirstChild("SeatWeld")
		if weld then
			weld:Destroy()
		end
	end
	player:SetAttribute("Driving", nil)
	local character = player.Character
	if character then
		character:SetAttribute("VehicleSpeed", nil)
	end
	a.Model:Destroy()
	self:UpdateAttributes(player)
end

function VehicleService:Spawn(player: Player, profile, id: string, at: CFrame?): (boolean, string?)
	local def = Vehicles.ById[id]
	if not def then
		return false, "Unknown vehicle."
	end
	if not profile.Vehicles[id] then
		return false, "You don't own the " .. def.Name .. " yet."
	end
	local bay = at or self:NearestBay(player, self.GARAGE_RANGE)
	if not bay then
		return false, "Go to a garage first (the Motor Pool in the colony, or build your own Garage)."
	end
	self:Despawn(player)
	local model = ModelFactory.Vehicle(id, true)
	model.Name = player.Name .. "_" .. def.Id
	model.ModelStreamingMode = Enum.ModelStreamingMode.Persistent
	model:SetAttribute("Owner", player.UserId)
	local chassis = model.PrimaryPart :: BasePart
	local seat = model:FindFirstChild("DriverSeat") :: VehicleSeat
	addPhysics(model, chassis)
	local pos = bay.Position
	local ground = Registry.WorldService:GroundAt(pos.X, pos.Z, pos.Y + 4)
	local y = ground + self:HoverHeight(id)
	local look = bay.LookVector
	local flat = Vector3.new(look.X, 0, look.Z)
	if flat.Magnitude < 0.1 then
		flat = Vector3.new(0, 0, -1)
	end
	chassis.Anchored = true
	model:PivotTo(CFrame.lookAt(Vector3.new(pos.X, y, pos.Z), Vector3.new(pos.X, y, pos.Z) + flat.Unit))
	-- prompt to get in (owner only; others are ejected from the driver seat)
	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = "DrivePrompt"
	prompt.ActionText = "Drive"
	prompt.ObjectText = def.Name
	prompt.HoldDuration = 0
	prompt.MaxActivationDistance = math.max(10, def.Size.Z * 0.6)
	prompt.RequiresLineOfSight = false
	prompt.KeyboardKeyCode = Enum.KeyCode.E
	prompt:SetAttribute("Action", "EnterVehicle")
	prompt:SetAttribute("Owner", player.UserId)
	prompt.Parent = chassis
	model.Parent = folder
	local a: Active = { Player = player, Id = id, Model = model, Chassis = chassis, Seat = seat, Driving = false, Parking = 0 }
	active[player] = a
	seat:GetPropertyChangedSignal("Occupant"):Connect(function()
		if active[player] ~= a then
			return
		end
		local hum = seat.Occupant
		if hum then
			local who = Players:GetPlayerFromCharacter(hum.Parent)
			if who ~= player then
				hum.Sit = false
				return
			end
			prompt.Enabled = false
			startDriving(a, hum)
		else
			prompt.Enabled = true
			a.Parking = os.clock()
			local stamp = a.Parking
			task.delay(0.35, function()
				if active[player] == a and a.Parking == stamp and not seat.Occupant then
					park(a)
				end
			end)
		end
	end)
	self:UpdateAttributes(player)
	return true, def.Name .. " is ready. Press E next to it to drive."
end

function VehicleService:Store(player: Player, profile): (boolean, string?)
	if not active[player] then
		return false, "You have no vehicle out."
	end
	self:Despawn(player)
	return true, "Vehicle stored in the garage."
end

-- Get the owner into the driver seat (prompt / request)
function VehicleService:Enter(player: Player): (boolean, string?)
	local a = active[player]
	local character = player.Character
	local hum = character and character:FindFirstChildOfClass("Humanoid")
	local hrp = hrpOf(player)
	if not a or not hum or not hrp or hum.Health <= 0 then
		return false, "No vehicle."
	end
	if (a.Chassis.Position - hrp.Position).Magnitude > 30 then
		return false, "Too far from your vehicle."
	end
	if a.Seat.Occupant then
		return false, "Seat taken."
	end
	if Registry.CapsuleService then
		Registry.CapsuleService:Drop(player)
	end
	a.Seat:Sit(hum)
	return true
end

-- Get out (e.g. before a teleport): leaves the vehicle parked where it is
function VehicleService:Exit(player: Player)
	local a = active[player]
	if not a then
		return
	end
	local occ = a.Seat.Occupant
	if occ then
		occ.Sit = false
		local weld = a.Seat:FindFirstChild("SeatWeld")
		if weld then
			weld:Destroy()
		end
	end
	if a.Driving then
		park(a)
	end
end

-- Drive into a locked zone / fall out of the world: the vehicle goes back to the garage
function VehicleService:Recall(player: Player, reason: string?)
	local profile = Registry.DataService:Get(player)
	if not active[player] or not profile then
		return
	end
	self:Exit(player)
	self:Despawn(player)
	if reason then
		notify(player, reason, "Warning")
	end
end

------------------------------------------------------------------ cargo

-- Validates a vehicle cleaning stroke; returns (active, stats, remainingKg) or nil
function VehicleService:StrokeContext(player: Player, profile, pos: Vector3)
	local a = active[player]
	if not a or not a.Driving or not a.Chassis.Parent then
		return nil
	end
	local st = Formulas.VehicleStats(profile, a.Id)
	if st.Width <= 0 or st.Hopper <= 0 then
		return nil
	end
	local def = Vehicles.ById[a.Id]
	local c = a.Chassis.Position
	local flat = Vector3.new(pos.X - c.X, 0, pos.Z - c.Z).Magnitude
	if flat > def.Size.Z * 0.5 + 6 or math.abs(pos.Y - c.Y) > 14 then
		return nil
	end
	return a, st, st.Hopper - self:CargoKg(profile)
end

function VehicleService:AddCargo(player: Player, profile, byRes: { [string]: number })
	profile.VehicleCargo = profile.VehicleCargo or {}
	for res, kg in byRes do
		profile.VehicleCargo[res] = (profile.VehicleCargo[res] or 0) + kg
	end
	Registry.DataService:Mark(player, "VehicleCargo")
	self:UpdateAttributes(player)
end

-- Remove the cargo if the player's vehicle is within `radius` of them (deposits)
function VehicleService:TakeCargoNear(player: Player, radius: number): { [string]: number }?
	local profile = Registry.DataService:Get(player)
	local a = active[player]
	local hrp = hrpOf(player)
	if not profile or not a or not hrp then
		return nil
	end
	if (a.Chassis.Position - hrp.Position).Magnitude > radius then
		return nil
	end
	local cargo = profile.VehicleCargo or {}
	if Formulas.ContentsKg(cargo) <= 1e-4 then
		return nil
	end
	profile.VehicleCargo = {}
	Registry.DataService:Mark(player, "VehicleCargo")
	self:UpdateAttributes(player)
	return cargo
end

function VehicleService:ReturnCargo(player: Player, cargo: { [string]: number })
	local profile = Registry.DataService:Get(player)
	if profile then
		self:AddCargo(player, profile, cargo)
	end
end

-- Take all cargo for packing into a capsule (Q while driving)
function VehicleService:TakeAllCargo(player: Player): { [string]: number }?
	local profile = Registry.DataService:Get(player)
	if not profile or Formulas.ContentsKg(profile.VehicleCargo or {}) <= 1e-4 then
		return nil
	end
	local cargo = profile.VehicleCargo
	profile.VehicleCargo = {}
	Registry.DataService:Mark(player, "VehicleCargo")
	self:UpdateAttributes(player)
	return cargo
end

function VehicleService:SetLights(player: Player, profile, on: boolean)
	local a = active[player]
	if not a then
		return
	end
	local st = Formulas.VehicleStats(profile, a.Id)
	for _, d in a.Model:GetDescendants() do
		if d:IsA("SpotLight") and d.Name == "Headlight" then
			d.Enabled = on
			d.Range = st.Lights and 90 or 60
			d.Brightness = st.Lights and 6 or 4
		end
	end
	a.Model:SetAttribute("Lights", on)
end

------------------------------------------------------------------ lifecycle

function VehicleService:Init()
	local existing = Workspace:FindFirstChild("Vehicles")
	if existing and existing:IsA("Folder") then
		folder = existing
	else
		local f = Instance.new("Folder")
		f.Name = "Vehicles"
		f.Parent = Workspace
		folder = f
	end
end

function VehicleService:Start()
	local R = Registry.Router
	R.Register("BuyVehicle", function(player, profile, payload)
		local def = type(payload.Id) == "string" and Vehicles.ById[payload.Id]
		if not def then
			return false, "Unknown vehicle."
		end
		if profile.Vehicles[def.Id] then
			return false, "You already own it."
		end
		if profile.Level < def.Level then
			return false, string.format("Requires level %d.", def.Level)
		end
		if not Registry.EconomyService:Spend(player, def.Price) then
			return false, "Not enough credits."
		end
		profile.Vehicles[def.Id] = true
		Registry.DataService:Mark(player, "Vehicles")
		Registry.DataService:AddStat(player, "VehiclesBought", 1)
		return true, def.Name .. " purchased! Take it out from any garage."
	end, 2, 4)
	R.Register("SpawnVehicle", function(player, profile, payload)
		if type(payload.Id) ~= "string" then
			return false, "Bad vehicle."
		end
		return self:Spawn(player, profile, payload.Id)
	end, 1, 3)
	R.Register("StoreVehicle", function(player, profile)
		return self:Store(player, profile)
	end, 1, 3)
	R.Register("EnterVehicle", function(player)
		return self:Enter(player)
	end, 2, 4)
	R.Register("VehicleLights", function(player, profile, payload)
		self:SetLights(player, profile, payload.On == true)
		return true
	end, 4, 6)

	game:GetService("ProximityPromptService").PromptTriggered:Connect(function(prompt, player)
		if prompt:GetAttribute("Action") == "EnterVehicle" then
			if prompt:GetAttribute("Owner") ~= player.UserId then
				notify(player, "That isn't your vehicle.", "Warning")
				return
			end
			local ok, msg = self:Enter(player)
			if not ok and msg then
				notify(player, msg, "Warning")
			end
		end
	end)
	-- vehicles are kept in the garage when you leave (cargo is saved in your profile)
	Registry.DataService.Releasing:Connect(function(player)
		self:Despawn(player)
	end)
	Players.PlayerRemoving:Connect(function(player)
		self:Despawn(player)
	end)
	-- respawning: get out of the seat cleanly
	Players.PlayerAdded:Connect(function(player)
		player.CharacterAdded:Connect(function()
			local a = active[player]
			if a and a.Driving then
				park(a)
			end
		end)
	end)
	-- safety: vehicles that fall out of the world go home
	task.spawn(function()
		while true do
			task.wait(2)
			for player, a in active do
				if a.Chassis.Parent and a.Chassis.Position.Y < -150 then
					self:Recall(player, "Your vehicle fell off the map and was returned to the garage.")
				end
			end
		end
	end)
end

return VehicleService
