--!strict
-- Procedural robot models. Every robot has an invisible "Root" part (PrimaryPart) that the
-- server drives with AlignPosition/AlignOrientation; everything else is welded to it.
-- Parts named "Spin" are rotated client-side (rotors, brushes) for animation.

local Builder = require(script.Parent.Builder)
local Config = script.Parent.Parent.Config
local Robots = require(Config.Robots)
local Rarity = require(Config.Rarity)

local M = Enum.Material

local RobotModels = {}

local function eye(b: Builder.BuilderObj, cf: CFrame, color: Color3, size: number)
	b:Ball(size, cf, Color3.fromRGB(20, 20, 26), M.Glass, "Visor")
	local glow = b:Ball(size * 0.45, cf * CFrame.new(0, 0, -size * 0.32), color, M.Neon, "Eye")
	return glow
end

local function dome(b: Builder.BuilderObj, c: { Color3 }, scale: number)
	b:VCyl(0.7 * scale, 3.4 * scale, CFrame.new(0, 0, 0), c[1], M.SmoothPlastic, "Shell")
	b:VCyl(0.25 * scale, 3.5 * scale, CFrame.new(0, -0.35 * scale, 0), c[3], M.SmoothPlastic, "Skirt")
	b:Ball(2.0 * scale, CFrame.new(0, 0.45 * scale, 0), c[1], M.SmoothPlastic, "Dome")
	b:VCyl(0.12 * scale, 3.45 * scale, CFrame.new(0, 0.2 * scale, 0), c[2], M.Neon, "Ring")
	eye(b, CFrame.new(0, 0.7 * scale, -0.7 * scale), c[2], 0.7 * scale)
	-- side brushes
	for _, x in { -1, 1 } do
		local brush = b:VCyl(0.12 * scale, 1.2 * scale, CFrame.new(x * 1.4 * scale, -0.45 * scale, -1.0 * scale), Color3.fromRGB(70, 70, 76), M.Fabric, "Spin")
		brush.CastShadow = false
	end
	b:Box(Vector3.new(0.1, 0.9, 0.1) * scale, CFrame.new(0.5 * scale, 1.5 * scale, 0.3 * scale), c[3], M.Metal, "Antenna")
	b:Ball(0.25 * scale, CFrame.new(0.5 * scale, 2.0 * scale, 0.3 * scale), c[2], M.Neon, "AntennaTip")
end

local function drone(b: Builder.BuilderObj, c: { Color3 }, scale: number)
	b:Box(Vector3.new(2.0, 0.8, 2.0) * scale, CFrame.new(), c[1], M.SmoothPlastic, "Body")
	b:Ball(1.5 * scale, CFrame.new(0, 0.35 * scale, 0), c[1], M.SmoothPlastic, "Top")
	b:Neon(Vector3.new(2.05, 0.12, 2.05) * scale, CFrame.new(0, -0.1 * scale, 0), c[2], "Ring")
	eye(b, CFrame.new(0, 0.1 * scale, -1.0 * scale), c[2], 0.7 * scale)
	for _, sx in { -1, 1 } do
		for _, sz in { -1, 1 } do
			local tip = Vector3.new(sx * 2.0, 0.3, sz * 2.0) * scale
			b:Rod(Vector3.new(sx * 0.6, 0.1, sz * 0.6) * scale, tip, 0.25 * scale, c[3], M.Metal, "Arm")
			b:VCyl(0.4 * scale, 0.6 * scale, CFrame.new(tip), c[3], M.Metal, "Motor")
			local rotor = b:Box(Vector3.new(2.0, 0.06, 0.25) * scale, CFrame.new(tip + Vector3.new(0, 0.25 * scale, 0)), Color3.fromRGB(30, 30, 34), M.SmoothPlastic, "Spin")
			rotor.CastShadow = false
		end
	end
	-- suction skirt
	b:VCyl(0.5 * scale, 1.6 * scale, CFrame.new(0, -0.6 * scale, 0), c[3], M.Metal, "Skirt")
end

local function rover(b: Builder.BuilderObj, c: { Color3 }, scale: number)
	b:Box(Vector3.new(3.0, 1.2, 4.2) * scale, CFrame.new(0, 0.2 * scale, 0), c[1], M.SmoothPlastic, "Body")
	b:Box(Vector3.new(2.6, 0.9, 1.6) * scale, CFrame.new(0, 1.15 * scale, 0.6 * scale), c[2], M.SmoothPlastic, "Hopper")
	b:Neon(Vector3.new(3.05, 0.15, 4.25) * scale, CFrame.new(0, -0.25 * scale, 0), c[2], "Stripe")
	eye(b, CFrame.new(0, 0.9 * scale, -1.6 * scale), c[2], 0.8 * scale)
	for _, sx in { -1, 1 } do
		for _, z in { -1.4, 0, 1.4 } do
			local w = b:XCyl(0.5 * scale, 1.1 * scale, CFrame.new(sx * 1.7 * scale, -0.3 * scale, z * scale), Color3.fromRGB(35, 35, 40), M.Rubber, "Wheel")
			w.CastShadow = false
		end
		b:VCyl(0.15 * scale, 1.6 * scale, CFrame.new(sx * 1.4 * scale, -0.6 * scale, -2.2 * scale), c[3], M.Fabric, "Spin")
	end
	b:Box(Vector3.new(3.2, 0.3, 0.6) * scale, CFrame.new(0, -0.55 * scale, -2.3 * scale), c[3], M.Metal, "Intake")
end

local function crab(b: Builder.BuilderObj, c: { Color3 }, scale: number)
	b:Ball(2.4 * scale, CFrame.new(0, 0.3 * scale, 0), c[1], M.SmoothPlastic, "Shell")
	b:Box(Vector3.new(2.6, 0.5, 2.0) * scale, CFrame.new(0, -0.1 * scale, 0), c[2], M.SmoothPlastic, "Belly")
	eye(b, CFrame.new(-0.45 * scale, 1.0 * scale, -1.0 * scale), c[3], 0.5 * scale)
	eye(b, CFrame.new(0.45 * scale, 1.0 * scale, -1.0 * scale), c[3], 0.5 * scale)
	for _, sx in { -1, 1 } do
		for i, z in { -0.7, 0.1, 0.9 } do
			local hip = Vector3.new(sx * 1.1, 0, z) * scale
			local knee = Vector3.new(sx * 2.0, 0.6, z * 1.2) * scale
			local foot = Vector3.new(sx * 2.4, -0.9, z * 1.3) * scale
			b:Rod(hip, knee, 0.22 * scale, c[2], M.Metal, "Leg" .. i)
			b:Rod(knee, foot, 0.18 * scale, c[2], M.Metal, "Leg" .. i)
		end
		-- magnet claws
		local shoulder = Vector3.new(sx * 0.9, 0.2, -1.0) * scale
		local claw = Vector3.new(sx * 1.4, 0.4, -2.4) * scale
		b:Rod(shoulder, claw, 0.3 * scale, c[2], M.Metal, "ClawArm")
		b:Ball(0.7 * scale, CFrame.new(claw), c[3], M.Neon, "Magnet")
	end
end

local function orb(b: Builder.BuilderObj, c: { Color3 }, scale: number)
	b:Ball(2.6 * scale, CFrame.new(), c[1], M.SmoothPlastic, "Body")
	b:Ball(2.62 * scale, CFrame.new(), c[2], M.ForceField, "Shield")
	local ring = b:Part({ Name = "Spin", Shape = "Cylinder", Size = Vector3.new(0.2, 3.8, 3.8) * scale, CF = CFrame.Angles(0, 0, math.rad(90)), Color = c[3], Material = M.Neon, CastShadow = false })
	ring.Transparency = 0.2
	eye(b, CFrame.new(0, 0.2 * scale, -1.1 * scale), c[2], 0.8 * scale)
	b:VCyl(0.6 * scale, 1.0 * scale, CFrame.new(0, -1.3 * scale, 0), c[3], M.Metal, "Nozzle")
end

local function lifter(b: Builder.BuilderObj, c: { Color3 }, scale: number)
	b:Box(Vector3.new(2.4, 1.0, 3.0) * scale, CFrame.new(0, 0.3 * scale, 0), c[1], M.SmoothPlastic, "Body")
	b:Box(Vector3.new(2.2, 0.4, 2.6) * scale, CFrame.new(0, 0.95 * scale, 0), c[2], M.SmoothPlastic, "Roof")
	eye(b, CFrame.new(0, 0.4 * scale, -1.5 * scale), c[2], 0.6 * scale)
	for _, sx in { -1, 1 } do
		b:ZCyl(2.0 * scale, 0.7 * scale, CFrame.new(sx * 1.6 * scale, 0.3 * scale, 0), c[3], M.Metal, "Thruster")
		b:Neon(Vector3.new(0.5, 0.5, 0.1) * scale, CFrame.new(sx * 1.6 * scale, 0.3 * scale, 1.05 * scale), Color3.fromRGB(120, 200, 255), "Flame")
	end
	-- cargo claw
	b:Box(Vector3.new(0.3, 1.0, 0.3) * scale, CFrame.new(0, -0.6 * scale, 0), c[3], M.Metal, "ClawPost")
	b:Box(Vector3.new(1.8, 0.2, 0.3) * scale, CFrame.new(0, -1.1 * scale, 0), c[3], M.Metal, "ClawBar")
	for _, sx in { -1, 1 } do
		b:Box(Vector3.new(0.2, 0.8, 0.3) * scale, CFrame.new(sx * 0.85 * scale, -1.45 * scale, 0), c[3], M.Metal, "Claw")
	end
end

local SHAPES: { [string]: (Builder.BuilderObj, { Color3 }, number) -> () } = {
	dome = dome,
	drone = drone,
	rover = rover,
	crab = crab,
	orb = orb,
	lifter = lifter,
}

local SCALE = { Common = 0.9, Uncommon = 1.0, Rare = 1.15, Epic = 1.3, Legendary = 1.45, Mythic = 1.5 }

-- Display/physics model. `physics` = unanchored & welded to Root, otherwise all anchored.
function RobotModels.Model(robotId: string, physics: boolean?): Model
	local def = Robots.ById[robotId] or Robots.ById.dustbot_mk1
	local b = Builder.new(def.Name, false)
	local scale = (SCALE :: any)[def.Rarity] or 1
	local root = b:Part({ Name = "Root", Size = Vector3.new(1, 1, 1), Transparency = 1, CanCollide = false, CastShadow = false })
	local shapeFn: (Builder.BuilderObj, { Color3 }, number) -> () = SHAPES[def.Model] or dome
	shapeFn(b, def.Colors, scale)
	local rar = Rarity.Get(def.Rarity)
	if rar.Order >= 4 then
		b:Sparkles(root, rar.Glow, 5, 0.4)
	end
	if def.Bonus and def.Bonus.Light then
		local lamp = b:Ball(0.6, CFrame.new(0, -0.6, -1.0), Color3.fromRGB(255, 245, 210), M.Neon, "Lamp")
		b:Light(lamp, Color3.fromRGB(255, 240, 200), 45, 2.5)
	end
	local status = b:Attachment(root, "Status", CFrame.new(0, 3.2 * scale, 0))
	status:SetAttribute("Scale", scale)
	b.Model:SetAttribute("RobotId", def.Id)
	local model = b:Finish(root)
	Builder.SetCollide(model, false, false)
	Builder.SetShadows(model, rar.Order >= 3)
	if physics then
		Builder.WeldAll(model, root, true)
		root.Massless = false
	end
	return model
end

return RobotModels
