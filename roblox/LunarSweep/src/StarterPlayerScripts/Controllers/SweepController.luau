--!nonstrict
-- Client side of cleaning: equip the tool (1 / tool button), hold to sweep (mouse,
-- touch SWEEP button, gamepad R2) or toggle auto-sweep (G). Sends the tool-head position to
-- the server every StrokeInterval; shows the footprint ring, animates the tool, plays
-- dust particles and sounds, and shows collected-dust feedback.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local ContextActionService = game:GetService("ContextActionService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local GameConfig = require(Shared.Config.GameConfig)
local Formulas = require(Shared.Formulas)
local Tools = require(Shared.Config.Tools)
local Rarity = require(Shared.Config.Rarity)
local Resources = require(Shared.Config.Resources)
local Format = require(Shared.Util.Format)
local Net = require(Shared.Net)

local player = Players.LocalPlayer

local SweepController = {}

local ctx
local held = false
local auto = false
local lastStroke = 0
local lastProductive = 0
local ring: Part
local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Exclude
rayParams.IgnoreWater = true

local function currentTool(): Tool?
	local character = player.Character
	if not character then
		return nil
	end
	local t = character:FindFirstChildOfClass("Tool")
	if t and t:GetAttribute("CleaningTool") then
		return t
	end
	return nil
end

local function backpackTool(): Tool?
	local bp = player:FindFirstChildOfClass("Backpack")
	if not bp then
		return nil
	end
	for _, t in bp:GetChildren() do
		if t:IsA("Tool") and t:GetAttribute("CleaningTool") then
			return t
		end
	end
	return nil
end

function SweepController:ToggleEquip()
	local character = player.Character
	local hum = character and character:FindFirstChildOfClass("Humanoid")
	if not hum then
		return
	end
	if currentTool() then
		hum:UnequipTools()
	else
		local t = backpackTool()
		if t then
			hum:EquipTool(t)
			if ctx.HUD then
				ctx.HUD:TutorialEvent("Equip")
			end
		end
	end
end

function SweepController:Unequip()
	local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
	if hum then
		hum:UnequipTools()
	end
	held = false
	if auto then
		auto = false
		if ctx.HUD then
			ctx.HUD:SetAuto(false)
		end
	end
end

-- Q: throw the carried capsule (where you are looking), otherwise pack one
function SweepController:CapsuleAction()
	local character = player.Character
	if character and character:GetAttribute("Carrying") and not player:GetAttribute("Driving") then
		local cam = Workspace.CurrentCamera
		local dir = cam and cam.CFrame.LookVector or Vector3.new(0, 0, -1)
		Net.Event("ThrowCapsule"):FireServer(dir)
		ctx.Sound:Play("throw")
	else
		Net.Event("PackCapsule"):FireServer()
	end
end

function SweepController:SetHeld(on: boolean)
	held = on
	if on and not currentTool() then
		self:ToggleEquip()
	end
end

function SweepController:ToggleAuto()
	auto = not auto
	if auto and not currentTool() then
		self:ToggleEquip()
	end
	if ctx.HUD then
		ctx.HUD:SetAuto(auto)
	end
	ctx.UI:Notify(auto and "Auto-sweep ON" or "Auto-sweep OFF", "Info", "🧹")
end

local function updateFilter()
	local list = {}
	for _, name in { "Pickups", "Robots", "Capsules", "SkyDome", "FX", "Relics" } do
		local f = Workspace:FindFirstChild(name)
		if f then
			table.insert(list, f)
		end
	end
	for _, p in Players:GetPlayers() do
		if p.Character then
			table.insert(list, p.Character)
		end
	end
	local hub = Workspace:FindFirstChild("Hub")
	local barriers = hub and hub:FindFirstChild("Barriers")
	if barriers then
		table.insert(list, barriers)
	end
	table.insert(list, ring)
	rayParams.FilterDescendantsInstances = list
end

-- where the tool head touches the ground
local function headPosition(stats): Vector3?
	local character = player.Character
	local hrp = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not hrp then
		return nil
	end
	local look = hrp.CFrame.LookVector
	local dir = Vector3.new(look.X, 0, look.Z)
	local reach = stats.Reach
	-- aiming: crosshair in first person, mouse on desktop
	local firstPerson = ctx.Camera and ctx.Camera:IsFirstPerson() and not ctx.Camera:CursorFree()
	if firstPerson or (UserInputService.MouseEnabled and not UserInputService.TouchEnabled) then
		local cam = Workspace.CurrentCamera
		local mouse = firstPerson and (cam.ViewportSize / 2) or UserInputService:GetMouseLocation()
		local ray = cam:ViewportPointToRay(mouse.X, mouse.Y)
		local hit = Workspace:Raycast(ray.Origin, ray.Direction * 300, rayParams)
		if hit then
			local flat = Vector3.new(hit.Position.X - hrp.Position.X, 0, hit.Position.Z - hrp.Position.Z)
			if flat.Magnitude > 1 and flat.Magnitude < reach * 3 + 12 then
				dir = flat.Unit
				reach = math.clamp(flat.Magnitude, math.min(3, reach), reach)
			end
		end
	end
	if dir.Magnitude < 0.01 then
		return nil
	end
	local target = hrp.Position + dir.Unit * reach
	local hit = Workspace:Raycast(target + Vector3.new(0, 6, 0), Vector3.new(0, -24, 0), rayParams)
	if hit then
		return hit.Position
	end
	return Vector3.new(target.X, hrp.Position.Y - 3, target.Z)
end

local function setDust(tool: Tool?, on: boolean)
	if not tool then
		return
	end
	local enabled = on and (ctx.Data.Profile and ctx.Data.Profile.Settings.Particles ~= false)
	for _, d in tool:GetDescendants() do
		if d:IsA("ParticleEmitter") and d.Name == "SweepDust" then
			d.Enabled = enabled
		elseif d:IsA("Beam") and d.Name == "SweepBeam" then
			d.Enabled = on
		end
	end
end

function SweepController:Init(c)
	ctx = c
	ring = Instance.new("Part")
	ring.Name = "FootprintRing"
	ring.Shape = Enum.PartType.Cylinder
	ring.Anchored = true
	ring.CanCollide = false
	ring.CanQuery = false
	ring.CanTouch = false
	ring.CastShadow = false
	ring.Material = Enum.Material.Neon
	ring.Color = Color3.fromRGB(255, 160, 60)
	ring.Transparency = 0.75
	ring.Size = Vector3.new(0.1, 4, 4)
	ring.Parent = nil

	Net.Unreliable("CleanFX").OnClientEvent:Connect(function(fx)
		self:OnCleanFX(fx)
	end)
end

function SweepController:OnCleanFX(fx)
	if fx.Cells and fx.Cells > 0 then
		lastProductive = os.clock()
		if ctx.HUD then
			ctx.HUD:TutorialEvent("Sweep")
		end
	end
	if fx.Kg and fx.Kg > 0 and ctx.FX then
		ctx.FX:FloatingText(string.format("+%s", Format.Kg(fx.Kg)), Color3.fromRGB(255, 220, 160), false, ring.Parent and ring.Position or nil)
	end
	local tool = currentTool()
	local head = tool and tool:FindFirstChild("Head", true)
	for _, pick in fx.Picks or {} do
		local res = Resources.ById[pick[1]]
		local rar = res and Rarity.Get(res.Rarity)
		if ctx.FX then
			ctx.FX:CollectFly(pick[1], pick[2], head and head.Position or nil)
		end
		if rar and rar.Order >= 3 then
			ctx.Sound:Play("rare_pickup")
			ctx.UI:Notify(string.format("Found %s!", res.Name), "Good", "✨")
		else
			ctx.Sound:Play("pickup", 0.2)
		end
	end
	if fx.Tokens and fx.Tokens > 0 and ctx.Season then
		local s = ctx.Season()
		if s and ctx.FX then
			ctx.FX:FloatingText(string.format("+%d %s", fx.Tokens, s.TokenIcon), s.Color, false)
		end
	end
	if fx.Coop and fx.Coop > 0 and math.random() < 0.05 then
		ctx.UI:Notify(string.format("Co-op bonus +%d%% (cleaning with %d nearby)", math.min(30, fx.Coop * 10), fx.Coop), "Good", "🤝")
	end
	if fx.Full then
		ctx.Sound:Play("full")
	end
end

function SweepController:Start()
	-- keyboard / gamepad
	UserInputService.InputBegan:Connect(function(input, processed)
		if input.KeyCode == Enum.KeyCode.ButtonR2 then
			held = true
		end
		if processed then
			return
		end
		if player:GetAttribute("Driving") then
			return
		end
		if input.KeyCode == Enum.KeyCode.One then
			self:ToggleEquip()
		elseif input.KeyCode == Enum.KeyCode.G then
			self:ToggleAuto()
		elseif input.KeyCode == Enum.KeyCode.Q or input.KeyCode == Enum.KeyCode.ButtonY then
			self:CapsuleAction()
		elseif input.UserInputType == Enum.UserInputType.MouseButton1 then
			if currentTool() and not (ctx.Build and ctx.Build.Active) then
				held = true
			end
		end
	end)
	UserInputService.InputEnded:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 or input.KeyCode == Enum.KeyCode.ButtonR2 then
			held = false
		end
	end)
	ContextActionService:BindAction("LunarEquip", function(_, state)
		if state == Enum.UserInputState.Begin then
			self:ToggleEquip()
		end
		return Enum.ContextActionResult.Pass
	end, false, Enum.KeyCode.ButtonL1)

	local swayTime = 0
	local filterTimer = 0
	RunService.RenderStepped:Connect(function(dt)
		local profile = ctx.Data.Profile
		local tool = currentTool()
		if not profile or not tool then
			if ring.Parent then
				ring.Parent = nil
			end
			ctx.Sound:Loop("vacuum_loop", false)
			return
		end
		filterTimer -= dt
		if filterTimer <= 0 then
			filterTimer = 2
			updateFilter()
		end
		local stats = Formulas.ToolStats(profile, tool:GetAttribute("ToolId"))
		local head = headPosition(stats)
		if head then
			ring.Parent = Workspace
			ring.Size = Vector3.new(0.12, stats.Width, stats.Width)
			ring.CFrame = CFrame.new(head + Vector3.new(0, 0.15, 0)) * CFrame.Angles(0, 0, math.rad(90))
		end
		local sweeping = (held or auto or profile.Settings.AutoSweep) and head ~= nil
		local productive = os.clock() - lastProductive < 0.45
		ring.Color = productive and Color3.fromRGB(120, 255, 160) or Color3.fromRGB(255, 160, 60)
		-- procedural sweep animation via the tool grip
		if sweeping then
			swayTime += dt * (productive and 11 or 7)
			local def = Tools.ById[tool:GetAttribute("ToolId")]
			local isVac = def and (def.Kind == "vacuum" or def.Kind == "canister" or def.Kind == "plasma" or def.Kind == "wand")
			local sway = isVac and math.sin(swayTime) * 0.12 or math.sin(swayTime) * 0.38
			tool.Grip = CFrame.new(0, math.abs(math.sin(swayTime * 2)) * 0.15, 0) * CFrame.Angles(0, sway, 0)
			ctx.Sound:Loop("vacuum_loop", isVac and productive)
		else
			tool.Grip = tool.Grip:Lerp(CFrame.new(), math.min(1, dt * 8))
			ctx.Sound:Loop("vacuum_loop", false)
		end
		setDust(tool, sweeping and productive)
		if sweeping and os.clock() - lastStroke >= GameConfig.StrokeInterval then
			lastStroke = os.clock()
			Net.Event("Stroke"):FireServer(head)
			if productive then
				ctx.Sound:Play("sweep", 0.3)
			end
		end
	end)
end

return SweepController
