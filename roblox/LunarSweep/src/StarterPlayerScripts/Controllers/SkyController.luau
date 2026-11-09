--!nonstrict
-- Space sky built locally: a black sky dome (the moon has no atmosphere), a star field,
-- a sun disc aligned with the real sun direction and a slowly turning Earth. The dome
-- follows the camera so it always reads as infinitely far away.
-- Set Lighting attribute "UseSkyDome" = false if you upload your own star skybox.

local Lighting = game:GetService("Lighting")
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")

local SkyController = {}

local DIST = 1000 -- faces are 2048 wide (max part size), so the box must stay within +-1024
local folder: Model
local earth: Model
local sun: BasePart
local anchor = Vector3.zero

local function part(props): BasePart
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	p.Material = Enum.Material.Neon
	for k, v in props do
		(p :: any)[k] = v
	end
	p.Parent = folder
	return p
end

local function build()
	folder = Instance.new("Model")
	folder.Name = "SkyDome"
	-- black box (Neon + black = unlit pure black)
	local s = DIST * 2 + 40
	for _, f in {
		{ Vector3.new(0, 0, -DIST), Vector3.new(2048, 2048, 4) },
		{ Vector3.new(0, 0, DIST), Vector3.new(2048, 2048, 4) },
		{ Vector3.new(-DIST, 0, 0), Vector3.new(4, 2048, 2048) },
		{ Vector3.new(DIST, 0, 0), Vector3.new(4, 2048, 2048) },
		{ Vector3.new(0, DIST, 0), Vector3.new(2048, 4, 2048) },
		{ Vector3.new(0, -DIST, 0), Vector3.new(2048, 4, 2048) },
	} do
		local p = part({ Name = "Void", Color = Color3.new(0, 0, 0), Size = f[2] })
		p:SetAttribute("Offset", f[1])
		local _ = s
	end
	-- stars
	local rng = Random.new(7)
	for i = 1, 420 do
		local dir = rng:NextUnitVector()
		if dir.Y < -0.15 then
			dir = Vector3.new(dir.X, -dir.Y, dir.Z)
		end
		local size = rng:NextNumber(1.2, i % 17 == 0 and 5 or 3)
		local tint = rng:NextNumber()
		local color = tint < 0.7 and Color3.fromRGB(255, 255, 255) or (tint < 0.85 and Color3.fromRGB(190, 210, 255) or Color3.fromRGB(255, 220, 180))
		local p = part({ Name = "Star", Color = color, Size = Vector3.new(size, size, size), Shape = Enum.PartType.Ball })
		p:SetAttribute("Offset", dir * (DIST - 30))
	end
	-- sun disc
	sun = part({ Name = "Sun", Color = Color3.fromRGB(255, 248, 225), Size = Vector3.new(70, 70, 70), Shape = Enum.PartType.Ball })
	local glow = Instance.new("BillboardGui")
	glow.Size = UDim2.fromOffset(400, 400)
	glow.LightInfluence = 0
	glow.AlwaysOnTop = false
	glow.Parent = sun
	local img = Instance.new("Frame")
	img.Size = UDim2.fromScale(1, 1)
	img.BackgroundColor3 = Color3.fromRGB(255, 240, 200)
	img.BackgroundTransparency = 0.85
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0.5, 0)
	c.Parent = img
	img.Parent = glow
	-- earth
	earth = Instance.new("Model")
	earth.Name = "Earth"
	local function ep(props)
		local p = part(props)
		p.Parent = earth
		return p
	end
	local core = ep({ Name = "Ocean", Shape = Enum.PartType.Ball, Size = Vector3.new(180, 180, 180), Material = Enum.Material.SmoothPlastic, Color = Color3.fromRGB(40, 90, 200) })
	local ers = Random.new(3)
	for _ = 1, 9 do
		local d = ers:NextUnitVector()
		local sz = ers:NextNumber(50, 90)
		local p = ep({ Name = "Land", Shape = Enum.PartType.Ball, Size = Vector3.new(sz, sz, sz), Material = Enum.Material.SmoothPlastic, Color = ers:NextNumber() < 0.7 and Color3.fromRGB(60, 140, 70) or Color3.fromRGB(170, 150, 100) })
		p:SetAttribute("Local", d * (90 - sz * 0.33))
	end
	for _ = 1, 7 do
		local d = ers:NextUnitVector()
		local sz = ers:NextNumber(30, 60)
		local p = ep({ Name = "Cloud", Shape = Enum.PartType.Ball, Size = Vector3.new(sz, sz * 0.5, sz), Material = Enum.Material.SmoothPlastic, Color = Color3.fromRGB(245, 248, 255) })
		p:SetAttribute("Local", d * (92 - sz * 0.2))
	end
	local atmo = ep({ Name = "Atmosphere", Shape = Enum.PartType.Ball, Size = Vector3.new(194, 194, 194), Material = Enum.Material.ForceField, Color = Color3.fromRGB(120, 180, 255), Transparency = 0.3 })
	atmo:SetAttribute("Local", Vector3.zero)
	core:SetAttribute("Local", Vector3.zero)
	earth.PrimaryPart = core
	earth.Parent = folder
	folder.Parent = Workspace
end

local earthDir = Vector3.new(0.45, 0.32, -0.83).Unit
local spin = 0

local function place(center: Vector3)
	for _, p in folder:GetChildren() do
		if p:IsA("BasePart") then
			local off = p:GetAttribute("Offset")
			if off then
				p.CFrame = CFrame.new(center + off)
			end
		end
	end
	local sunDir = Lighting:GetSunDirection()
	sun.CFrame = CFrame.new(center + sunDir * (DIST - 60))
	local ec = center + earthDir * (DIST - 220)
	local rot = CFrame.new(ec) * CFrame.Angles(0.35, spin, 0)
	for _, p in earth:GetChildren() do
		if p:IsA("BasePart") then
			local l = p:GetAttribute("Local") or Vector3.zero
			p.CFrame = rot * CFrame.new(l)
		end
	end
end

function SkyController:Init(ctx)
	if Lighting:GetAttribute("UseSkyDome") == false then
		return
	end
	build()
	local cam = Workspace.CurrentCamera
	anchor = cam and cam.CFrame.Position or Vector3.zero
	place(anchor)
	local acc = 0
	RunService.RenderStepped:Connect(function(dt)
		local camera = Workspace.CurrentCamera
		if not camera then
			return
		end
		local pos = camera.CFrame.Position
		acc += dt
		spin += dt * 0.01
		-- re-centre when the camera moved; slow earth spin every half second
		if (pos - anchor).Magnitude > 40 or acc > 0.5 then
			acc = 0
			anchor = pos
			place(anchor)
		end
	end)
	local _ = ctx
end

return SkyController
