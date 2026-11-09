--!nonstrict
-- Visual effects (all local, nothing replicates):
--  floating texts, collected debris flying into your container, screen bursts,
--  other players' sweep dust, meteor showers, warps, rocket launches, sector-clear rings,
--  dust storms, bobbing pickups, building animations (spinners, pistons, conveyor crates,
--  status lights), container fill gauges and blinking beacons.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local Workspace = game:GetService("Workspace")
local Lighting = game:GetService("Lighting")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local ModelFactory = require(Shared.ModelFactory)
local Net = require(Shared.Net)
local UITheme = require(script.Parent.Parent.UI.Theme)

local player = Players.LocalPlayer

local FXController = {}

local ctx
local fxFolder: Folder

local function particlesOn(): boolean
	local p = ctx.Data.Profile
	return not p or p.Settings.Particles ~= false
end

local function tempPart(props): BasePart
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	for k, v in props do
		(p :: any)[k] = v
	end
	p.Parent = fxFolder
	return p
end

local function puff(pos: Vector3, color: Color3, count: number, size: number?)
	if not particlesOn() then
		return
	end
	local p = tempPart({ Transparency = 1, Size = Vector3.one, Position = pos })
	local e = Instance.new("ParticleEmitter")
	e.Texture = "rbxasset://textures/particles/smoke_main.dds"
	e.Color = ColorSequence.new(color)
	e.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, size or 1.2), NumberSequenceKeypoint.new(1, (size or 1.2) * 3) })
	e.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.4), NumberSequenceKeypoint.new(1, 1) })
	e.Lifetime = NumberRange.new(0.6, 1.2)
	e.Speed = NumberRange.new(3, 7)
	e.SpreadAngle = Vector2.new(80, 80)
	e.Acceleration = Vector3.new(0, 2, 0)
	e.Rate = 0
	e.Parent = p
	e:Emit(count)
	task.delay(2, function()
		p:Destroy()
	end)
end
FXController.Puff = puff

function FXController:FloatingText(text: string, color: Color3, big: boolean?, at: Vector3?)
	local character = player.Character
	local hrp = character and character:FindFirstChild("HumanoidRootPart")
	local pos = at or (hrp and hrp.Position + Vector3.new(0, 3, 0))
	if not pos then
		return
	end
	local anchor = tempPart({ Transparency = 1, Size = Vector3.one * 0.2, Position = pos + Vector3.new(math.random() * 2 - 1, 1.5, math.random() * 2 - 1) })
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.fromOffset(big and 260 or 160, big and 60 or 36)
	bb.LightInfluence = 0
	bb.AlwaysOnTop = true
	bb.MaxDistance = 120
	bb.Parent = anchor
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Text = text
	label.TextScaled = true
	label.Font = UITheme.FontBlack
	label.TextColor3 = color
	label.TextStrokeTransparency = 0.3
	label.Parent = bb
	TweenService:Create(anchor, TweenInfo.new(1.1, Enum.EasingStyle.Quad), { Position = anchor.Position + Vector3.new(0, big and 6 or 4, 0) }):Play()
	TweenService:Create(label, TweenInfo.new(1.1), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
	task.delay(1.15, function()
		anchor:Destroy()
	end)
end

function FXController:CollectFly(resId: string, from: Vector3, to: Vector3?)
	local character = player.Character
	local container = character and character:FindFirstChild("DustContainer")
	local target = to or (container and container.PrimaryPart and container.PrimaryPart.Position)
	if not target then
		return
	end
	local ok, model = pcall(ModelFactory.Pickup, resId)
	if not ok or not model then
		return
	end
	model:PivotTo(CFrame.new(from))
	for _, d in model:GetDescendants() do
		if d:IsA("ParticleEmitter") or d:IsA("Light") then
			d:Destroy()
		end
	end
	model.Parent = fxFolder
	local value = Instance.new("CFrameValue")
	value.Value = CFrame.new(from)
	value.Changed:Connect(function(cf)
		model:PivotTo(cf)
	end)
	local mid = (from + target) / 2 + Vector3.new(0, 4, 0)
	local t0 = os.clock()
	local conn
	conn = RunService.RenderStepped:Connect(function()
		local t = math.min(1, (os.clock() - t0) / 0.45)
		local a = from:Lerp(mid, t)
		local b = mid:Lerp(target, t)
		local cur = character and character:FindFirstChild("DustContainer")
		if cur and cur.PrimaryPart then
			target = cur.PrimaryPart.Position
		end
		model:PivotTo(CFrame.new(a:Lerp(b, t)) * CFrame.Angles(t * 6, t * 4, 0))
		local s = 1 - t * 0.7
		model:ScaleTo(math.max(0.05, s))
		if t >= 1 then
			conn:Disconnect()
			model:Destroy()
			value:Destroy()
		end
	end)
end

function FXController:ScreenBurst(color: Color3)
	local root = ctx.Root
	if not root then
		return
	end
	local f = Instance.new("Frame")
	f.Size = UDim2.fromScale(1, 1)
	f.BackgroundColor3 = color
	f.BackgroundTransparency = 0.7
	f.BorderSizePixel = 0
	f.ZIndex = 35
	f.Parent = root
	TweenService:Create(f, TweenInfo.new(0.6), { BackgroundTransparency = 1 }):Play()
	task.delay(0.65, function()
		f:Destroy()
	end)
	self:Shake(0.25, 0.4)
end

function FXController:Shake(duration: number, intensity: number)
	local p = ctx.Data.Profile
	if p and p.Settings.CameraShake == false then
		return
	end
	local character = player.Character
	local hum = character and character:FindFirstChildOfClass("Humanoid")
	if not hum then
		return
	end
	local t0 = os.clock()
	local conn
	conn = RunService.RenderStepped:Connect(function()
		local t = os.clock() - t0
		if t > duration or not hum.Parent then
			hum.CameraOffset = Vector3.zero
			conn:Disconnect()
			return
		end
		local k = intensity * (1 - t / duration)
		hum.CameraOffset = Vector3.new((math.random() - 0.5) * k, (math.random() - 0.5) * k, 0)
	end)
end

------------------------------------------------------------------ world fx

local function meteor(target: Vector3)
	local start = target + Vector3.new(math.random(-120, 120), 260, math.random(-120, 120))
	local rock = tempPart({ Shape = Enum.PartType.Ball, Size = Vector3.new(4, 4, 4), Material = Enum.Material.Neon, Color = Color3.fromRGB(255, 150, 60), Position = start })
	local a0 = Instance.new("Attachment")
	a0.Position = Vector3.new(0, 1.5, 0)
	a0.Parent = rock
	local a1 = Instance.new("Attachment")
	a1.Position = Vector3.new(0, -1.5, 0)
	a1.Parent = rock
	local trail = Instance.new("Trail")
	trail.Attachment0 = a0
	trail.Attachment1 = a1
	trail.Lifetime = 0.8
	trail.Color = ColorSequence.new(Color3.fromRGB(255, 200, 100), Color3.fromRGB(255, 60, 20))
	trail.LightEmission = 1
	trail.Transparency = NumberSequence.new(0.1, 1)
	trail.Parent = rock
	local light = Instance.new("PointLight")
	light.Color = Color3.fromRGB(255, 140, 60)
	light.Range = 30
	light.Brightness = 3
	light.Parent = rock
	local tw = TweenService:Create(rock, TweenInfo.new(1.6, Enum.EasingStyle.Quad, Enum.EasingDirection.In), { Position = target })
	tw:Play()
	tw.Completed:Connect(function()
		puff(target, Color3.fromRGB(150, 120, 100), 18, 2)
		ctx.Sound:PlayAt("meteor", target, 0.8)
		local character = player.Character
		local hrp = character and character:FindFirstChild("HumanoidRootPart")
		if hrp and (hrp.Position - target).Magnitude < 60 then
			FXController:Shake(0.3, 0.6)
		end
		rock:Destroy()
	end)
end

local function ring(pos: Vector3, color: Color3, size: number, duration: number)
	local r = tempPart({ Shape = Enum.PartType.Cylinder, Material = Enum.Material.Neon, Color = color, Size = Vector3.new(0.3, 2, 2), CFrame = CFrame.new(pos + Vector3.new(0, 0.6, 0)) * CFrame.Angles(0, 0, math.rad(90)), Transparency = 0.2 })
	TweenService:Create(r, TweenInfo.new(duration, Enum.EasingStyle.Quad), { Size = Vector3.new(0.3, size, size), Transparency = 1 }):Play()
	task.delay(duration, function()
		r:Destroy()
	end)
end

local function onWorldFX(fx)
	local kind = fx.Kind
	local cam = Workspace.CurrentCamera
	local camPos = cam and cam.CFrame.Position or Vector3.zero
	if kind == "Sweep" then
		if fx.UserId ~= player.UserId and fx.Pos and (fx.Pos - camPos).Magnitude < 150 then
			puff(fx.Pos, Color3.fromRGB(190, 186, 178), 4, 0.8)
		end
	elseif kind == "Meteors" then
		for i, pos in fx.Positions or {} do
			if (pos - camPos).Magnitude < 500 then
				task.delay(i * 0.25, meteor, pos)
			end
		end
	elseif kind == "Warp" then
		if fx.Pos and (fx.Pos - camPos).Magnitude < 200 then
			ring(fx.Pos, Color3.fromRGB(120, 220, 255), 14, 0.5)
			puff(fx.Pos, Color3.fromRGB(160, 220, 255), 6, 0.8)
		end
	elseif kind == "Launch" then
		if fx.Pos and (fx.Pos - camPos).Magnitude < 400 then
			ctx.Sound:PlayAt("launch", fx.Pos)
			local flame = tempPart({ Material = Enum.Material.Neon, Color = Color3.fromRGB(255, 180, 80), Size = Vector3.new(3, 4, 3), Position = fx.Pos + Vector3.new(0, 4, 0), Transparency = 0.2 })
			TweenService:Create(flame, TweenInfo.new(2.2, Enum.EasingStyle.Quad, Enum.EasingDirection.In), { Position = fx.Pos + Vector3.new(0, 300, 0), Size = Vector3.new(1, 30, 1), Transparency = 0.8 }):Play()
			puff(fx.Pos, Color3.fromRGB(220, 220, 220), 30, 3)
			task.delay(2.3, function()
				flame:Destroy()
			end)
		end
	elseif kind == "SectorClear" then
		if fx.Pos and (fx.Pos - camPos).Magnitude < 250 then
			ring(fx.Pos, Color3.fromRGB(90, 255, 150), 90, 1.4)
		end
	elseif kind == "DustStorm" then
		local zone = player:GetAttribute("Zone")
		if zone == fx.Zone then
			local cc = Lighting:FindFirstChild("ColorGrade")
			if cc then
				local original = (cc :: ColorCorrectionEffect).TintColor
				TweenService:Create(cc, TweenInfo.new(2), { TintColor = Color3.fromRGB(220, 190, 150) }):Play()
				task.delay(20, function()
					TweenService:Create(cc, TweenInfo.new(4), { TintColor = original }):Play()
				end)
			end
			for _ = 1, 12 do
				local character = player.Character
				local hrp = character and character:FindFirstChild("HumanoidRootPart")
				if hrp then
					puff(hrp.Position + Vector3.new(math.random(-40, 40), 2, math.random(-40, 40)), Color3.fromRGB(170, 150, 120), 10, 4)
				end
				task.wait(0.5)
			end
		end
	end
end

------------------------------------------------------------------ ambient animation

local fillParts: { [Model]: BasePart } = {}

local function animate(dt: number, t: number)
	local cam = Workspace.CurrentCamera
	if not cam then
		return
	end
	local camPos = cam.CFrame.Position
	-- pickups bob & spin (nearest only)
	local pickups = Workspace:FindFirstChild("Pickups")
	if pickups then
		local n = 0
		for _, m in pickups:GetChildren() do
			local root = m:IsA("Model") and m.PrimaryPart
			if root and (root.Position - camPos).Magnitude < 90 then
				n += 1
				if n > 60 then
					break
				end
				local base = m:GetAttribute("BaseCF")
				if not base then
					base = m:GetPivot()
					m:SetAttribute("BaseCF", base)
				end
				local id = m:GetAttribute("PickupId") or 0
				m:PivotTo(base * CFrame.new(0, 0.5 + math.sin(t * 2 + id) * 0.35, 0) * CFrame.Angles(0, t * 1.5 + id, 0))
			end
		end
	end
	-- buildings & hub spinners, pistons, status lights (cached lists)
	for _, d in FXController._spin do
		if d.Parent and (d.Position - camPos).Magnitude < 220 then
			d.CFrame = d.CFrame * CFrame.Angles(0, dt * 2.5, 0)
		end
	end
	for _, d in FXController._status do
		if d.Parent then
			local model = d:FindFirstAncestorOfClass("Model")
			local status = model and model:GetAttribute("Status") or "Idle"
			d.Color = UITheme.StatusColors[status] or UITheme.StatusColors.Idle
		end
	end
	for _, d in FXController._piston do
		if d.Parent and (d.Position - camPos).Magnitude < 200 then
			local model = d:FindFirstAncestorOfClass("Model")
			if model and model:GetAttribute("Status") == "Working" then
				local base = d:GetAttribute("BaseCF")
				if not base then
					base = d.CFrame
					d:SetAttribute("BaseCF", base)
				end
				d.CFrame = base * CFrame.new(0, -math.abs(math.sin(t * 2)) * 2, 0)
			end
		end
	end
	for _, d in FXController._blink do
		if d.Parent then
			d.Transparency = (math.floor(t * 1.5) % 2 == 0) and 0 or 0.8
		end
	end
	-- container fill gauges (local overlay parts)
	for _, p in Players:GetPlayers() do
		local character = p.Character
		local container = character and character:FindFirstChild("DustContainer")
		local gaugeFill = container and container:FindFirstChild("Fill")
		if gaugeFill and gaugeFill:IsA("BasePart") and (gaugeFill.Position - camPos).Magnitude < 120 then
			gaugeFill.Transparency = 1
			local overlay = fillParts[container]
			if not overlay then
				overlay = tempPart({ Name = "FillOverlay", Material = Enum.Material.Neon, Color = Color3.fromRGB(255, 160, 40), Size = gaugeFill.Size })
				fillParts[container] = overlay
			end
			local frac = character:GetAttribute("ContainerFill") or 0
			local height = gaugeFill:GetAttribute("Height") or 1
			local h = math.max(0.05, height * frac)
			overlay.Size = Vector3.new(gaugeFill.Size.X, h, gaugeFill.Size.Z)
			overlay.Color = frac >= 0.999 and Color3.fromRGB(255, 60, 60) or Color3.fromRGB(255, 160, 40)
			overlay.CFrame = gaugeFill.CFrame * CFrame.new(0, h / 2 - gaugeFill.Size.Y / 2, 0)
		end
	end
	for container, overlay in fillParts do
		if not container.Parent then
			overlay:Destroy()
			fillParts[container] = nil
		end
	end
end

-- conveyor crates
local crates: { [BasePart]: BasePart } = {}
local function conveyors(t: number)
	local cam = Workspace.CurrentCamera
	local camPos = cam and cam.CFrame.Position or Vector3.zero
	local bases = Workspace:FindFirstChild("Bases")
	if not bases then
		return
	end
	for _, belt in FXController._belts do
		do
			if belt.Parent then
				local near = (belt.Position - camPos).Magnitude < 150
				local crate = crates[belt]
				if near then
					if not crate then
						crate = tempPart({ Name = "Crate", Size = Vector3.new(1.2, 1, 1.2), Material = Enum.Material.SmoothPlastic, Color = Color3.fromRGB(255, 170, 60) })
						crates[belt] = crate
					end
					local phase = (t * 0.6 + (belt.Position.X + belt.Position.Z) * 0.01) % 1
					crate.CFrame = belt.CFrame * CFrame.new(0, 0.8, -2 + phase * 4)
				elseif crate then
					crate:Destroy()
					crates[belt] = nil
				end
			end
		end
	end
	for belt, crate in crates do
		if not belt.Parent then
			crate:Destroy()
			crates[belt] = nil
		end
	end
end

FXController._spin = {} :: { BasePart }
FXController._status = {} :: { BasePart }
FXController._piston = {} :: { BasePart }
FXController._blink = {} :: { BasePart }
FXController._belts = {} :: { BasePart }

local function rebuildCaches()
	local spin, status, piston, blink, belts = {}, {}, {}, {}, {}
	for _, folderName in { "Bases", "Hub", "Decor" } do
		local f = Workspace:FindFirstChild(folderName)
		if f then
			for _, d in f:GetDescendants() do
				if d:IsA("BasePart") and d.Anchored then
					local n = d.Name
					if n == "Spin" and folderName ~= "Decor" then
						table.insert(spin, d)
					elseif n == "Status" then
						table.insert(status, d)
					elseif n == "Piston" then
						table.insert(piston, d)
					elseif n == "Beacon" or d:GetAttribute("Blink") then
						table.insert(blink, d)
					elseif n == "Belt" then
						local model = d:FindFirstAncestorOfClass("Model")
						if model and model:GetAttribute("BuildingId") == "conveyor" then
							table.insert(belts, d)
						end
					end
				end
			end
		end
	end
	FXController._spin, FXController._status, FXController._piston, FXController._blink, FXController._belts = spin, status, piston, blink, belts
end

function FXController:Init(c)
	ctx = c
	fxFolder = Instance.new("Folder")
	fxFolder.Name = "LocalFX"
	fxFolder.Parent = Workspace
	Net.Unreliable("WorldFX").OnClientEvent:Connect(function(fx)
		task.spawn(onWorldFX, fx)
	end)
end

function FXController:Start()
	local t = 0
	local acc = 0
	task.spawn(function()
		while true do
			pcall(rebuildCaches)
			task.wait(2.5)
		end
	end)
	RunService.Heartbeat:Connect(function(dt)
		t += dt
		acc += dt
		if acc < 1 / 30 then
			return
		end
		local step = acc
		acc = 0
		local ok, err = pcall(animate, step, t)
		if not ok then
			warn("[FX] " .. tostring(err))
		end
		pcall(conveyors, t)
	end)
end

return FXController
