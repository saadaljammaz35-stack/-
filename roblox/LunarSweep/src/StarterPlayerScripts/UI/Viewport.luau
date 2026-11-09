--!nonstrict
-- Renders a 3D model preview inside a ViewportFrame (shop cards, inventory, robots).

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ModelFactory = require(ReplicatedStorage:WaitForChild("Shared").ModelFactory)

local Viewport = {}

local cache: { [string]: Model } = {}

local function template(kind: string, id: string): Model?
	local key = kind .. ":" .. id
	local m = cache[key]
	if not m then
		local ok, built = pcall(ModelFactory.Preview, kind, id)
		if not ok or not built then
			return nil
		end
		m = built
		for _, d in m:GetDescendants() do
			if d:IsA("ParticleEmitter") or d:IsA("Light") or d:IsA("Beam") then
				d:Destroy()
			elseif d:IsA("BasePart") then
				d.Anchored = true
			end
		end
		cache[key] = m
	end
	return m
end

function Viewport.Render(parent: GuiObject, kind: string, id: string, angle: number?): ViewportFrame
	local vf = Instance.new("ViewportFrame")
	if not parent or not parent.Parent then
		-- the card was destroyed before a deferred render ran (tab switched): skip the work
		return vf
	end
	vf.Name = "Preview"
	vf.Size = UDim2.fromScale(1, 1)
	vf.BackgroundTransparency = 1
	vf.Ambient = Color3.fromRGB(170, 170, 180)
	vf.LightColor = Color3.fromRGB(255, 250, 240)
	vf.LightDirection = Vector3.new(-1, -1.5, -0.6)
	vf.Parent = parent
	local tpl = template(kind, id)
	if not tpl then
		return vf
	end
	local model = tpl:Clone()
	model.Parent = vf
	local cf, size = model:GetBoundingBox()
	local radius = size.Magnitude / 2
	local cam = Instance.new("Camera")
	cam.FieldOfView = 40
	local a = math.rad(angle or 35)
	local dist = radius / math.tan(math.rad(cam.FieldOfView / 2)) * 1.05
	local center = cf.Position
	cam.CFrame = CFrame.lookAt(center + Vector3.new(math.sin(a) * dist, dist * 0.45, -math.cos(a) * dist), center)
	cam.Parent = vf
	vf.CurrentCamera = cam
	return vf
end

return Viewport
