--!nonstrict
-- Dust capsules: pack your container into a capsule and keep cleaning. Capsules can be
-- carried (one at a time, slows you down), deposited at the Exchange or a base hopper,
-- fetched by hauler robots, pulled home by a Capsule Catcher, or recalled for a fee.
-- Only the owner can interact with their capsules.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local ModelFactory = require(Shared.ModelFactory)
local Net = require(Shared.Net)
local Registry = require(script.Parent.Registry)

local CapsuleService = {}

type Capsule = { Id: number, Owner: number, Contents: { [string]: number }, Kg: number, Model: Model, Created: number, Carried: boolean, Claimed: boolean, Moving: boolean? }

CapsuleService.THROW_SPEED = 46 -- horizontal launch speed (studs/s) before Throw Assist
CapsuleService.THROW_LIFT = 34 -- vertical launch speed
CapsuleService.CATCH_RADIUS = 26 -- a Capsule Catcher grabs thrown capsules landing this close
CapsuleService.CATCH_BONUS = 1.10 -- caught capsules sell instantly at +10%
CapsuleService.CONVEYOR_SPEED = 16

local capsules: { [number]: Capsule } = {}
local carrying: { [Player]: Capsule } = {}
local nextId = 0
local folder: Folder

local function notify(player: Player, text: string, kind: string?)
	Net.Event("Notify"):FireClient(player, { Text = text, Kind = kind or "Info", Icon = "🛢" })
end

local function ownedBy(userId: number): { Capsule }
	local out = {}
	for _, c in capsules do
		if c.Owner == userId and not c.Claimed then
			table.insert(out, c)
		end
	end
	return out
end
CapsuleService.OwnedBy = function(_, userId)
	return ownedBy(userId)
end

local function destroy(c: Capsule)
	capsules[c.Id] = nil
	c.Claimed = true
	if c.Model then
		c.Model:Destroy()
	end
end

local function updatePlayerCount(userId: number)
	local player = Players:GetPlayerByUserId(userId)
	if player then
		player:SetAttribute("Capsules", #ownedBy(userId))
	end
end

function CapsuleService:Pack(player: Player, auto: boolean?): boolean
	local profile = Registry.DataService:Get(player)
	local character = player.Character
	local hrp = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not profile or not hrp then
		return false
	end
	local vs = Registry.VehicleService
	local driving = vs ~= nil and vs:IsDriving(player)
	if carrying[player] and not driving then
		self:Drop(player)
		return true
	end
	local source = driving and (profile.VehicleCargo or {}) or profile.Contents
	local kg = Formulas.ContentsKg(source)
	if kg < 0.01 then
		if not auto then
			notify(player, driving and "Nothing to pack - your hopper is empty." or "Nothing to pack - your container is empty.")
		end
		return false
	end
	if #ownedBy(player.UserId) >= GameConfig.MaxCapsules then
		if not auto then
			notify(player, "Too many capsules out. Deposit or recall some first.", "Warning")
		end
		return false
	end
	local contents: { [string]: number }
	local origin: CFrame = hrp.CFrame
	local back = 4
	if driving then
		contents = vs:TakeAllCargo(player) or {}
		local a = vs:Get(player)
		if a then
			origin = a.Chassis.CFrame
			back = a.Chassis.Size.Z / 2 + 3
		end
	else
		contents = profile.Contents
		profile.Contents = {}
		Registry.DataService:Mark(player, "Contents")
		Registry.PlayerService:UpdateFill(player)
	end
	nextId += 1
	local model = ModelFactory.Capsule(Color3.fromRGB(255, 140, 40))
	model.Name = "Capsule"
	local look = Vector3.new(origin.LookVector.X, 0, origin.LookVector.Z)
	if look.Magnitude < 0.05 then
		look = Vector3.new(0, 0, -1)
	end
	local pos = origin.Position - look.Unit * back
	local ground = Registry.WorldService:GroundAt(pos.X, pos.Z, origin.Position.Y)
	local y = math.abs(ground - origin.Position.Y) < 14 and ground or (origin.Position.Y - 3)
	model:PivotTo(CFrame.new(pos.X, y, pos.Z))
	model:SetAttribute("CapsuleId", nextId)
	model:SetAttribute("Owner", player.UserId)
	model:SetAttribute("Kg", kg)
	local root = model.PrimaryPart :: BasePart
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "Carry"
	prompt.ObjectText = string.format("%s's capsule (%s)", player.DisplayName, Format.Kg(kg))
	prompt.HoldDuration = 0.2
	prompt.MaxActivationDistance = 10
	prompt.RequiresLineOfSight = false
	prompt:SetAttribute("Action", "CarryCapsule")
	prompt:SetAttribute("Owner", player.UserId)
	prompt.Parent = root
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.fromOffset(120, 30)
	bb.StudsOffset = Vector3.new(0, 2.6, 0)
	bb.MaxDistance = 90
	bb.LightInfluence = 0
	bb.Parent = root
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.TextColor3 = Color3.fromRGB(255, 200, 120)
	label.TextStrokeTransparency = 0.3
	label.Font = Enum.Font.BuilderSansBold
	label.TextScaled = true
	label.Text = Format.Kg(kg)
	label.Parent = bb
	model.Parent = folder
	local c: Capsule = { Id = nextId, Owner = player.UserId, Contents = contents, Kg = kg, Model = model, Created = os.clock(), Carried = false, Claimed = false }
	capsules[nextId] = c
	Registry.DataService:AddStat(player, "CapsulesPacked", 1)
	updatePlayerCount(player.UserId)
	Net.Event("Reward"):FireClient(player, { Kind = "Capsule", Kg = kg, Auto = auto })
	return true
end

function CapsuleService:Carry(player: Player, capsuleId: number): (boolean, string?)
	local c = capsules[capsuleId]
	local character = player.Character
	local hrp = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not c or c.Claimed or not hrp or not character then
		return false, "Capsule not found."
	end
	if c.Owner ~= player.UserId then
		return false, "That isn't your capsule."
	end
	if carrying[player] then
		return false, "You are already carrying a capsule."
	end
	if (c.Model:GetPivot().Position - hrp.Position).Magnitude > 16 then
		return false, "Too far away."
	end
	c.Carried = true
	carrying[player] = c
	local root = c.Model.PrimaryPart :: BasePart
	ModelFactory.Builder.WeldAll(c.Model, root, true)
	ModelFactory.Builder.SetCollide(c.Model, false)
	root.Massless = true
	c.Model:PivotTo(hrp.CFrame * CFrame.new(0, -1.2, -2.6))
	local weld = Instance.new("WeldConstraint")
	weld.Name = "CarryWeld"
	weld.Part0 = hrp
	weld.Part1 = root
	weld.Parent = root
	c.Model.Parent = character
	local prompt = root:FindFirstChildOfClass("ProximityPrompt")
	if prompt then
		prompt.Enabled = false
	end
	character:SetAttribute("Carrying", true)
	Registry.PlayerService:ApplyMovement(player)
	return true
end

function CapsuleService:Drop(player: Player)
	local c = carrying[player]
	if not c then
		return
	end
	carrying[player] = nil
	local character = player.Character
	if character then
		character:SetAttribute("Carrying", nil)
	end
	local root = c.Model.PrimaryPart :: BasePart
	local weld = root and root:FindFirstChild("CarryWeld")
	if weld then
		weld:Destroy()
	end
	local pos = c.Model:GetPivot().Position
	local ground = Registry.WorldService:GroundAt(pos.X, pos.Z, pos.Y)
	for _, d in c.Model:GetDescendants() do
		if d:IsA("BasePart") then
			d.Anchored = true
		end
	end
	ModelFactory.Builder.SetCollide(c.Model, true, true)
	c.Model:PivotTo(CFrame.new(pos.X, math.abs(ground - pos.Y) < 12 and ground or pos.Y - 2, pos.Z))
	c.Model.Parent = folder
	c.Carried = false
	local prompt = root and root:FindFirstChildOfClass("ProximityPrompt")
	if prompt then
		prompt.Enabled = true
	end
	Registry.PlayerService:ApplyMovement(player)
end

-- Remove the carried capsule and return its contents (used by deposits)
function CapsuleService:TakeCarried(player: Player): { [string]: number }?
	local c = carrying[player]
	if not c then
		return nil
	end
	carrying[player] = nil
	if player.Character then
		player.Character:SetAttribute("Carrying", nil)
	end
	local contents = c.Contents
	destroy(c)
	updatePlayerCount(c.Owner)
	Registry.PlayerService:ApplyMovement(player)
	return contents
end

-- Claim a capsule (robots / catcher). Returns contents.
function CapsuleService:Claim(c: Capsule): { [string]: number }?
	if c.Claimed or c.Carried or c.Moving then
		return nil
	end
	local contents = c.Contents
	destroy(c)
	updatePlayerCount(c.Owner)
	return contents
end

function CapsuleService:Recall(player: Player, profile, free: boolean?): (number, number)
	local list = ownedBy(player.UserId)
	local fee = free and 0 or GameConfig.CapsuleRecallFee * math.max(0, 1 - 0.25 * (profile.Upgrades.capsule_tether or 0))
	local moved, count = 0, 0
	for _, c in list do
		if not c.Carried and not c.Moving then
			local contents = {}
			for res, kg in c.Contents do
				contents[res] = kg * (1 - fee)
			end
			local space = Registry.BaseService:SiloSpace(player)
			local kg = Formulas.ContentsKg(contents)
			if kg <= space + 1e-6 then
				Registry.BaseService:AddToSilo(player, contents)
				moved += kg
				count += 1
				destroy(c)
			end
		end
	end
	updatePlayerCount(player.UserId)
	return count, moved
end

------------------------------------------------------------------ throwing

local function rest(c: Capsule, pos: Vector3)
	local ground = Registry.WorldService:GroundAt(pos.X, pos.Z, pos.Y + 2)
	local y = math.abs(ground - pos.Y) < 10 and ground or pos.Y
	ModelFactory.Builder.SetCollide(c.Model, true, true)
	c.Model:PivotTo(CFrame.new(pos.X, y, pos.Z))
	c.Moving = false
	local root = c.Model.PrimaryPart
	local prompt = root and root:FindFirstChildOfClass("ProximityPrompt")
	if prompt then
		prompt.Enabled = true
	end
	c.Model:SetAttribute("Moving", nil)
end

-- A Capsule Catcher grabs the capsule and launches it to the colony: instant sale with a bonus
function CapsuleService:CatchSell(owner: Player, c: Capsule, catcher: Model?): number
	if c.Claimed then
		return 0
	end
	local contents = c.Contents
	local kg = c.Kg
	destroy(c)
	updatePlayerCount(c.Owner)
	local value = Registry.EconomyService:SellContents(owner, contents, true, self.CATCH_BONUS)
	Registry.DataService:AddStat(owner, "CapsulesCaught", 1)
	Net.Event("Reward"):FireClient(owner, { Kind = "Catch", Credits = value, Kg = kg })
	if catcher then
		Net.Unreliable("WorldFX"):FireAllClients({ Kind = "Launch", Pos = catcher:GetPivot().Position })
	end
	return value
end

local function deliver(owner: Player, c: Capsule, target: Model?, kind: string?, at: Vector3)
	if c.Claimed then
		return
	end
	if kind == "Catcher" then
		CapsuleService:CatchSell(owner, c, target)
		return
	end
	-- storage: the silo takes what fits
	local base = Registry.BaseService
	local space = base:SiloSpace(owner)
	if space + 1e-6 >= c.Kg then
		base:AddToSilo(owner, c.Contents)
		local kg = c.Kg
		destroy(c)
		updatePlayerCount(c.Owner)
		Registry.DataService:AddStat(owner, "Deposits", 1)
		notify(owner, string.format("Conveyor stored %s in your silo", Format.Kg(kg)))
	else
		notify(owner, "Your silo is full - the capsule is waiting at the end of the conveyor.", "Warning")
		rest(c, at)
	end
end

local function ride(owner: Player, c: Capsule, points: { Vector3 }, target: Model?, kind: string?)
	c.Model:SetAttribute("Moving", "Conveyor")
	local speed = CapsuleService.CONVEYOR_SPEED
	local last = c.Model:GetPivot().Position
	for _, pt in points do
		local dist = (pt - last).Magnitude
		local t, dur = 0, math.max(0.05, dist / speed)
		while t < dur do
			if c.Claimed then
				return
			end
			t += task.wait()
			c.Model:PivotTo(CFrame.new(last:Lerp(pt, math.min(1, t / dur))))
		end
		last = pt
	end
	deliver(owner, c, target, kind, last)
end

-- try the landing cell and its neighbours for a conveyor
local function findRoute(owner: Player, pos: Vector3)
	local base = Registry.BaseService
	for _, off in { Vector3.zero, Vector3.new(4, 0, 0), Vector3.new(-4, 0, 0), Vector3.new(0, 0, 4), Vector3.new(0, 0, -4) } do
		local pts, target, kind = base:ConveyorRoute(owner, pos + off)
		if pts then
			return pts, target, kind
		end
	end
	return nil
end

function CapsuleService:Land(c: Capsule, pos: Vector3)
	if c.Claimed then
		return
	end
	local owner = Players:GetPlayerByUserId(c.Owner)
	if owner and Registry.BaseService then
		local catcher = Registry.BaseService:CatcherNear(owner, pos, self.CATCH_RADIUS)
		if catcher then
			self:CatchSell(owner, c, catcher)
			return
		end
		local pts, target, kind = findRoute(owner, pos)
		if pts then
			task.spawn(ride, owner, c, pts, target, kind)
			return
		end
	end
	rest(c, pos)
end

local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Exclude

local function fly(c: Capsule, p: Vector3, v: Vector3)
	local g = Vector3.new(0, -Workspace.Gravity, 0)
	local exclude = { folder }
	for _, plr in Players:GetPlayers() do
		if plr.Character then
			table.insert(exclude, plr.Character)
		end
	end
	local vehicles = Workspace:FindFirstChild("Vehicles")
	if vehicles then
		table.insert(exclude, vehicles)
	end
	rayParams.FilterDescendantsInstances = exclude
	local elapsed = 0
	local spin = 0
	while elapsed < 8 do
		if c.Claimed then
			return
		end
		local dt = math.clamp(task.wait(), 1 / 120, 0.1)
		elapsed += dt
		local nextP = p + v * dt + g * (0.5 * dt * dt)
		local hit = Workspace:Raycast(p, nextP - p, rayParams)
		if hit then
			CapsuleService:Land(c, hit.Position)
			return
		end
		v += g * dt
		p = nextP
		spin += dt * 9
		c.Model:PivotTo(CFrame.new(p) * CFrame.Angles(spin, 0, spin * 0.5))
		if p.Y < -200 then
			break
		end
	end
	-- never landed (fell off): snap to the ground below the last position
	local ground = Registry.WorldService:GroundAt(p.X, p.Z, 200)
	CapsuleService:Land(c, Vector3.new(p.X, ground, p.Z))
end

function CapsuleService:Throw(player: Player, dir: any): (boolean, string?)
	local c = carrying[player]
	local character = player.Character
	local hrp = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
	local profile = Registry.DataService:Get(player)
	if not c or not hrp or not character or not profile then
		return false, "You aren't carrying a capsule."
	end
	local flat = Vector3.new(hrp.CFrame.LookVector.X, 0, hrp.CFrame.LookVector.Z)
	if typeof(dir) == "Vector3" and dir == dir and dir.Magnitude > 0.05 and dir.Magnitude < 1e4 then
		local d = Vector3.new(dir.X, 0, dir.Z)
		if d.Magnitude > 0.05 then
			flat = d
		end
	end
	flat = flat.Unit
	local power = Formulas.ThrowPower(profile)
	carrying[player] = nil
	character:SetAttribute("Carrying", nil)
	local root = c.Model.PrimaryPart :: BasePart
	local weld = root and root:FindFirstChild("CarryWeld")
	if weld then
		weld:Destroy()
	end
	for _, d in c.Model:GetDescendants() do
		if d:IsA("BasePart") then
			d.Anchored = true
		end
	end
	ModelFactory.Builder.SetCollide(c.Model, false)
	c.Model.Parent = folder
	c.Carried = false
	c.Moving = true
	c.Model:SetAttribute("Moving", "Thrown")
	local prompt = root and root:FindFirstChildOfClass("ProximityPrompt")
	if prompt then
		prompt.Enabled = false
	end
	Registry.PlayerService:ApplyMovement(player)
	Registry.DataService:AddStat(player, "CapsulesThrown", 1)
	local start = hrp.Position + flat * 2.5 + Vector3.new(0, 2, 0)
	local velocity = flat * self.THROW_SPEED * power + Vector3.new(0, self.THROW_LIFT * math.sqrt(power), 0)
	c.Model:PivotTo(CFrame.new(start))
	task.spawn(fly, c, start, velocity)
	Net.Unreliable("WorldFX"):FireAllClients({ Kind = "Throw", UserId = player.UserId, Pos = start })
	return true
end

function CapsuleService:IsCarrying(player: Player): boolean
	return carrying[player] ~= nil
end

function CapsuleService:Init()
	folder = Workspace:WaitForChild("Capsules") :: Folder
end

function CapsuleService:Start()
	Net.Event("PackCapsule").OnServerEvent:Connect(function(player)
		pcall(self.Pack, self, player, false)
	end)
	Net.Event("ThrowCapsule").OnServerEvent:Connect(function(player, dir)
		local ok, err = pcall(self.Throw, self, player, dir)
		if not ok then
			warn("[CapsuleService] throw error: " .. tostring(err))
		end
	end)
	Registry.Router.Register("RecallCapsules", function(player, profile)
		if not Registry.BaseService:HasPlot(player) then
			return false, "You need a base to recall capsules."
		end
		local count, kg = self:Recall(player, profile, false)
		if count == 0 then
			return false, "No capsules recalled (none out, or your silo is full)."
		end
		return true, string.format("Recalled %d capsules (%s) to your silo", count, Format.Kg(kg))
	end, 1, 2)
	-- prompt actions
	game:GetService("ProximityPromptService").PromptTriggered:Connect(function(prompt, player)
		if prompt:GetAttribute("Action") == "CarryCapsule" then
			local model = prompt:FindFirstAncestorOfClass("Model")
			local id = model and model:GetAttribute("CapsuleId")
			if id then
				local ok, msg = self:Carry(player, id)
				if not ok and msg then
					notify(player, msg, "Warning")
				end
			end
		end
	end)
	-- runs before the final save so capsule contents are persisted
	Registry.DataService.Releasing:Connect(function(player)
		local c = carrying[player]
		if c then
			carrying[player] = nil
			c.Carried = false
		end
		-- capsules go home to the silo when you leave (no fee, ignores capacity)
		for _, cap in ownedBy(player.UserId) do
			Registry.BaseService:AddToSilo(player, cap.Contents, true)
			destroy(cap)
		end
	end)
	-- expiry: old capsules are recalled automatically
	task.spawn(function()
		while true do
			task.wait(30)
			local now = os.clock()
			for _, c in capsules do
				if not c.Carried and now - c.Created > GameConfig.CapsuleLifetime then
					local owner = Players:GetPlayerByUserId(c.Owner)
					if owner then
						Registry.BaseService:AddToSilo(owner, c.Contents, true)
						notify(owner, "An old capsule was auto-recalled to your silo.")
					end
					destroy(c)
					updatePlayerCount(c.Owner)
				end
			end
		end
	end)
end

return CapsuleService
