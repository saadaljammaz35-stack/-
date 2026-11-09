--!strict
-- Hover rover vehicles. Origin = centre of the chassis, +Y up, -Z forward.
-- "Chassis" is the PrimaryPart (collides); everything else is welded to it.
-- The driver sits in a VehicleSeat named "DriverSeat"; the cleaning intake is the
-- attachment "Intake" at the front bottom. Headlights are SpotLights named "Headlight".

local Builder = require(script.Parent.Builder)
local Config = script.Parent.Parent.Config
local Vehicles = require(Config.Vehicles)
local Rarity = require(Config.Rarity)

local M = Enum.Material

local VehicleModels = {}

function VehicleModels.Model(vehicleId: string, physics: boolean?): Model
	local def = Vehicles.ById[vehicleId] or Vehicles.List[1]
	local W, H, L = def.Size.X, def.Size.Y, def.Size.Z
	local c1, c2, c3 = def.Colors[1], def.Colors[2], def.Colors[3]
	local b = Builder.new(def.Name, false)
	local chassis = b:Part({ Name = "Chassis", Size = Vector3.new(W, 1.2, L), CF = CFrame.new(), Color = c3, Material = M.DiamondPlate, CanCollide = true })
	-- body
	b:Box(Vector3.new(W - 0.6, H * 0.45, L * 0.55), CFrame.new(0, 0.6 + H * 0.22, L * 0.12), c1, M.SmoothPlastic, "Body")
	b:Neon(Vector3.new(W - 0.5, 0.18, L * 0.56), CFrame.new(0, 0.62, L * 0.12), c2, "Stripe")
	b:Part({ Name = "Hood", Shape = "Wedge", Size = Vector3.new(W - 0.8, H * 0.35, L * 0.22), CF = CFrame.new(0, 0.6 + H * 0.17, -L * 0.27) * CFrame.Angles(0, math.rad(180), 0), Color = c1, Material = M.SmoothPlastic })
	-- hopper (cleaning vehicles) or passenger deck
	if def.Hopper > 0 then
		b:Box(Vector3.new(W * 0.7, H * 0.55, L * 0.28), CFrame.new(0, 0.6 + H * 0.5, L * 0.32), c2, M.Metal, "Hopper")
		b:Neon(Vector3.new(W * 0.72, 0.15, L * 0.29), CFrame.new(0, 0.6 + H * 0.78, L * 0.32), Color3.fromRGB(255, 170, 60), "HopperGauge")
	else
		b:Box(Vector3.new(W - 1, 0.3, L * 0.5), CFrame.new(0, 0.6 + H * 0.46, L * 0.18), c3, M.Metal, "Deck")
		for _, sx in { -1, 1 } do
			b:Box(Vector3.new(0.3, H * 0.4, L * 0.5), CFrame.new(sx * (W / 2 - 0.4), 0.6 + H * 0.6, L * 0.18), c2, M.SmoothPlastic, "Rail")
		end
	end
	-- driver seat
	local seat = Instance.new("VehicleSeat")
	seat.Name = "DriverSeat"
	seat.Size = Vector3.new(2, 1, 2)
	seat.CFrame = b.Origin * CFrame.new(0, 0.6 + H * 0.45 + 0.6, -L * 0.05)
	seat.Color = Color3.fromRGB(40, 40, 46)
	seat.Material = M.Fabric
	seat.MaxSpeed = 0
	seat.Torque = 0
	seat.TurnSpeed = 0
	seat.HeadsUpDisplay = false
	seat.Anchored = true
	seat.CanCollide = false
	seat.TopSurface = Enum.SurfaceType.Smooth
	seat.Parent = b.Model
	b:Box(Vector3.new(2, 1.8, 0.4), CFrame.new(0, 0.6 + H * 0.45 + 1.5, -L * 0.05 + 1.1), Color3.fromRGB(40, 40, 46), M.Fabric, "Backrest")
	-- passenger seats
	for i = 2, def.Seats do
		local s = Instance.new("Seat")
		s.Name = "PassengerSeat"
		s.Size = Vector3.new(2, 1, 2)
		local sx = (i % 2 == 0) and -1 or 1
		s.CFrame = b.Origin * CFrame.new(sx * (W / 4), 0.6 + H * 0.45 + 0.6, L * 0.05 + (i > 3 and 3 or 2.5))
		s.Color = Color3.fromRGB(40, 40, 46)
		s.Material = M.Fabric
		s.Anchored = true
		s.CanCollide = false
		s.Parent = b.Model
	end
	-- hover pods (4 or 6)
	local pods = (L >= 14) and { -0.38, 0, 0.38 } or { -0.36, 0.36 }
	for _, sx in { -1, 1 } do
		for _, z in pods do
			local pod = b:XCyl(1.0, H * 0.45, CFrame.new(sx * (W / 2 + 0.2), -0.2, z * L), c3, M.Metal, "Pod")
			pod.CastShadow = false
			b:Neon(Vector3.new(0.9, 0.12, H * 0.32), CFrame.new(sx * (W / 2 + 0.2), -0.55, z * L), Color3.fromRGB(120, 200, 255), "PodGlow")
		end
	end
	-- cleaning brush roller at the front
	if def.Width > 0 then
		local brushW = math.min(def.Width * 0.6, W + 4)
		b:XCyl(brushW, 1.2, CFrame.new(0, -0.5, -L / 2 - 0.6), Color3.fromRGB(70, 66, 60), M.Fabric, "Spin")
		b:Box(Vector3.new(brushW + 0.4, 0.5, 1.6), CFrame.new(0, 0.3, -L / 2 - 0.6), c2, M.SmoothPlastic, "BrushHousing")
		for _, sx in { -1, 1 } do
			b:Rod(Vector3.new(sx * (W / 2 - 0.5), 0.2, -L / 2 + 0.6), Vector3.new(sx * (brushW / 2), 0.2, -L / 2 - 0.6), 0.35, c3, M.Metal, "Arm")
		end
	end
	-- headlights + tail thrusters
	for _, sx in { -1, 1 } do
		local lamp = b:Neon(Vector3.new(0.9, 0.5, 0.2), CFrame.new(sx * (W / 2 - 1), 0.6 + H * 0.2, -L / 2 + 0.1), Color3.fromRGB(255, 248, 220), "Lamp")
		local spot = Instance.new("SpotLight")
		spot.Name = "Headlight"
		spot.Face = Enum.NormalId.Front
		spot.Range = 60
		spot.Angle = 70
		spot.Brightness = 4
		spot.Color = Color3.fromRGB(255, 244, 220)
		spot.Shadows = true
		spot.Enabled = false
		spot.Parent = lamp
		local tail = b:Neon(Vector3.new(1, 0.6, 0.2), CFrame.new(sx * (W / 2 - 1), 0.6 + H * 0.2, L / 2 - 0.05), Color3.fromRGB(255, 60, 50), "TailLight")
		tail.CastShadow = false
	end
	b:Attachment(chassis, "Intake", CFrame.new(0, -0.6, -L / 2 - 1.2))
	local rar = Rarity.Get(def.Rarity)
	if rar.Order >= 4 then
		b:Sparkles(chassis, rar.Glow, 4, 0.5)
	end
	b.Model:SetAttribute("VehicleId", def.Id)
	local model = b:Finish(chassis)
	if physics then
		for _, d in model:GetDescendants() do
			if d:IsA("BasePart") and d ~= chassis then
				local w = Instance.new("WeldConstraint")
				w.Part0 = chassis
				w.Part1 = d
				w.Parent = d
				d.Anchored = false
				d.Massless = true
				if not d:IsA("Seat") and not d:IsA("VehicleSeat") then
					d.CanCollide = false
				end
			end
		end
		chassis.Anchored = false
	end
	return model
end

return VehicleModels
