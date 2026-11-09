--!nonstrict
-- Drives the player's hover vehicle (the client has network ownership while seated).
--   W/S or triggers = throttle, A/D or left stick = steer (VehicleSeat inputs, mobile thumbstick
--   included), Shift = turbo, L = headlights, Q = pack the hopper into a capsule,
--   Space = get out. While driving, the brush intake cleans: its ground position is sent to
--   the server (VehicleStroke), which validates it.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Net = require(Shared.Net)
local Format = require(Shared.Util.Format)
local Vehicles = require(Shared.Config.Vehicles)

local Lib = require(script.Parent.Parent.UI.Lib)
local Theme = require(script.Parent.Parent.UI.Theme)

local player = Players.LocalPlayer
local C = Theme.Colors

local VehicleController = {}
VehicleController.Turbo = false

local ctx
local conn: RBXScriptConnection? = nil
local model: Model? = nil
local chassis: BasePart? = nil
local seat: VehicleSeat? = nil
local yaw = 0
local speed = 0
local lastStroke = 0
local lights = false
local gui: Frame
local speedLabel: TextLabel
local hopperBar
local nameLabel: TextLabel
local turboBtn: TextButton
local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Exclude

local function findVehicle(): Model?
	local folder = Workspace:FindFirstChild("Vehicles")
	if not folder then
		return nil
	end
	for _, m in folder:GetChildren() do
		if m:IsA("Model") and m:GetAttribute("Owner") == player.UserId then
			return m
		end
	end
	return nil
end

local function ground(pos: Vector3): (number?, Vector3)
	local hit = Workspace:Raycast(pos + Vector3.new(0, 4, 0), Vector3.new(0, -60, 0), rayParams)
	if hit then
		return hit.Position.Y, hit.Normal
	end
	return nil, Vector3.yAxis
end

local function refreshFilter()
	local ignore = { player.Character, model }
	for _, n in { "LocalFX", "SkyDome", "SectorLines", "Pickups", "Capsules", "Robots", "Vehicles" } do
		local f = Workspace:FindFirstChild(n)
		if f then
			table.insert(ignore, f)
		end
	end
	rayParams.FilterDescendantsInstances = ignore
end

local function step(dt: number)
	if not model or not chassis or not seat or not chassis.Parent then
		return
	end
	local drive = chassis:FindFirstChild("Drive") :: LinearVelocity?
	local steer = chassis:FindFirstChild("Steer") :: AlignOrientation?
	if not drive or not steer then
		return
	end
	local maxSpeed = model:GetAttribute("MaxSpeed") or 20
	local turbo = (VehicleController.Turbo and (model:GetAttribute("Turbo") or 0) or 0)
	local top = maxSpeed * (1 + turbo)
	local throttle = seat.ThrottleFloat
	local steerIn = seat.SteerFloat
	-- acceleration / braking
	local target = throttle * top
	if throttle < 0 then
		target = throttle * maxSpeed * 0.5
	end
	local accel = (math.sign(target - speed) ~= math.sign(speed) and math.abs(speed) > 0.5) and top * 2.2 or top * 0.9
	if math.abs(target - speed) <= accel * dt then
		speed = target
	else
		speed += math.sign(target - speed) * accel * dt
	end
	-- steering (tighter when slow, can pivot in place)
	local turnRate = math.rad(95) * (1 - 0.45 * math.clamp(math.abs(speed) / math.max(1, top), 0, 1))
	yaw -= steerIn * turnRate * dt * (speed < -0.5 and -1 or 1)
	local pos = chassis.Position
	local gy, normal = ground(pos)
	local hover = model:GetAttribute("Hover") or 3
	local vy = 0
	if gy then
		vy = math.clamp((gy + hover - pos.Y) * 7, -45, 30)
	else
		vy = -Workspace.Gravity * 0.4
	end
	local forward = CFrame.Angles(0, yaw, 0).LookVector
	drive.VectorVelocity = forward * speed + Vector3.new(0, vy, 0)
	-- tilt with the ground
	local up = Vector3.yAxis:Lerp(normal, 0.6).Unit
	local right = forward:Cross(up).Unit
	local fwd = up:Cross(right).Unit
	steer.CFrame = CFrame.fromMatrix(Vector3.zero, right, up, -fwd)
	-- cleaning intake
	local width = model:GetAttribute("Width") or 0
	if width > 0 and os.clock() - lastStroke > 0.1 and math.abs(speed) > 0.5 then
		lastStroke = os.clock()
		local intake = chassis:FindFirstChild("Intake") :: Attachment?
		local p = intake and intake.WorldPosition or pos
		local iy = ground(p)
		if iy then
			Net.Event("VehicleStroke"):FireServer(Vector3.new(p.X, iy, p.Z))
		end
	end
	-- HUD
	speedLabel.Text = string.format("%d st/s%s", math.floor(math.abs(chassis.AssemblyLinearVelocity.Magnitude) + 0.5), turbo > 0 and "  TURBO" or "")
end

function VehicleController:SetLights(on: boolean)
	lights = on
	ctx.UI:Request("VehicleLights", { On = on })
end

local function refreshGauge()
	local cap = player:GetAttribute("VehicleCap") or 0
	local kg = player:GetAttribute("VehicleKg") or 0
	if cap > 0 then
		hopperBar:Set(kg / cap, string.format("%s / %s", Format.Kg(kg), Format.Kg(cap)))
		hopperBar:Color(kg >= cap - 1e-3 and C.Bad or C.Accent)
	else
		hopperBar:Set(0, "No hopper")
	end
end

local function startDriving()
	model = findVehicle()
	if not model then
		return
	end
	chassis = model.PrimaryPart
	seat = model:FindFirstChild("DriverSeat") :: VehicleSeat?
	if not chassis or not seat then
		return
	end
	local look = chassis.CFrame.LookVector
	yaw = math.atan2(-look.X, -look.Z)
	speed = 0
	refreshFilter()
	local vid = model:GetAttribute("VehicleId")
	local def = type(vid) == "string" and Vehicles.ById[vid] or nil
	nameLabel.Text = def and string.upper(def.Name) or "VEHICLE"
	refreshGauge()
	gui.Visible = true
	ctx.Sound:Loop("engine_loop", true)
	if ctx.Sweep and ctx.Sweep.Unequip then
		ctx.Sweep:Unequip()
	end
	if not conn then
		conn = RunService.Heartbeat:Connect(step)
	end
end

local function stopDriving()
	if conn then
		conn:Disconnect()
		conn = nil
	end
	model, chassis, seat = nil, nil, nil
	speed = 0
	VehicleController.Turbo = false
	gui.Visible = false
	ctx.Sound:Loop("engine_loop", false)
end

function VehicleController:IsDriving(): boolean
	return conn ~= nil
end

function VehicleController:Init(c)
	ctx = c
end

function VehicleController:Start()
	local isTouch = UserInputService.TouchEnabled and not UserInputService.KeyboardEnabled
	gui = Lib.Create("Frame", {
		Name = "VehicleHud",
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -84),
		Size = UDim2.fromOffset(330, 92),
		BackgroundColor3 = C.Panel,
		BackgroundTransparency = 0.12,
		Corner = 14,
		Visible = false,
		Parent = ctx.Root,
	})
	nameLabel = Lib.Label("VEHICLE", { Size = UDim2.new(0.6, 0, 0, 18), Position = UDim2.fromOffset(12, 6), TextSize = 13, TextColor3 = C.Accent, Font = Theme.FontBlack, Parent = gui })
	speedLabel = Lib.Label("0 st/s", { Size = UDim2.new(0.4, -12, 0, 18), Position = UDim2.new(0.6, 0, 0, 6), TextSize = 13, TextXAlignment = Enum.TextXAlignment.Right, Font = Theme.FontBlack, Parent = gui })
	hopperBar = Lib.Bar({ Size = UDim2.new(1, -24, 0, 16), Position = UDim2.fromOffset(12, 28), Parent = gui }, C.Accent)
	local row = Lib.Frame({ Size = UDim2.new(1, -24, 0, 34), Position = UDim2.fromOffset(12, 52), BackgroundTransparency = 1, List = { Horizontal = true, Padding = 6 }, Parent = gui })
	Lib.Button(isTouch and "PACK" or "Pack (Q)", { Size = UDim2.fromOffset(72, 32), TextSize = 13, Style = "Secondary", Parent = row }, function()
		Net.Event("PackCapsule"):FireServer()
	end)
	Lib.Button(isTouch and "LIGHTS" or "Lights (L)", { Size = UDim2.fromOffset(78, 32), TextSize = 13, Style = "Secondary", Parent = row }, function()
		self:SetLights(not lights)
	end)
	turboBtn = Lib.Button(isTouch and "TURBO" or "Turbo (Shift)", { Size = UDim2.fromOffset(96, 32), TextSize = 13, Style = "Secondary", Parent = row })
	turboBtn.InputBegan:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1 then
			self.Turbo = true
		end
	end)
	turboBtn.InputEnded:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1 then
			self.Turbo = false
		end
	end)
	Lib.Button(isTouch and "EXIT" or "Exit (Space)", { Size = UDim2.fromOffset(60, 32), TextSize = 13, Style = "Danger", Parent = row }, function()
		local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
		if hum then
			hum.Sit = false
			hum.Jump = true
		end
	end)

	UserInputService.InputBegan:Connect(function(input, processed)
		if not conn then
			return
		end
		if input.KeyCode == Enum.KeyCode.LeftShift or input.KeyCode == Enum.KeyCode.ButtonL1 then
			self.Turbo = true
		end
		if processed then
			return
		end
		if input.KeyCode == Enum.KeyCode.L or input.KeyCode == Enum.KeyCode.DPadUp then
			self:SetLights(not lights)
		end
	end)
	UserInputService.InputEnded:Connect(function(input)
		if input.KeyCode == Enum.KeyCode.LeftShift or input.KeyCode == Enum.KeyCode.ButtonL1 then
			self.Turbo = false
		end
	end)
	player:GetAttributeChangedSignal("Driving"):Connect(function()
		if player:GetAttribute("Driving") then
			startDriving()
		else
			stopDriving()
		end
	end)
	player:GetAttributeChangedSignal("VehicleKg"):Connect(refreshGauge)
	player:GetAttributeChangedSignal("VehicleCap"):Connect(refreshGauge)
	if player:GetAttribute("Driving") then
		startDriving()
	end
end

return VehicleController
