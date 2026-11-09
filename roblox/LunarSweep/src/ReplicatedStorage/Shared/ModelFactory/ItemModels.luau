--!strict
-- Worn containers, debris pickups, dust capsules and the astronaut helmet.

local Builder = require(script.Parent.Builder)
local Config = script.Parent.Parent.Config
local Containers = require(Config.Containers)
local Resources = require(Config.Resources)
local Rarity = require(Config.Rarity)

local M = Enum.Material

local ItemModels = {}

local function ellipsoid(b: Builder.BuilderObj, size: Vector3, cf: CFrame, color: Color3, material: Enum.Material, name: string): BasePart
	local p = b:Part({ Name = name, Size = size, CF = cf, Color = color, Material = material })
	local mesh = Instance.new("SpecialMesh")
	mesh.MeshType = Enum.MeshType.Sphere
	mesh.Parent = p
	return p
end

------------------------------------------------------------------ containers (worn on the back)
-- Container space: origin = centre of the character's back, +Z = away from the body.

function ItemModels.Container(containerId: string): Model
	local def = Containers.ById[containerId] or Containers.ById.pocket_pouch
	local b = Builder.new(def.Name, false)
	local root = b:Part({ Name = "Root", Size = Vector3.new(0.4, 0.4, 0.4), Transparency = 1, CanCollide = false })
	local c1, c2 = def.Colors[1], def.Colors[2]
	local order = (def :: any).Order or 1
	local s = math.clamp(0.75 + order * 0.06, 0.8, 1.6)
	local fillHeight: number
	local fillBase: Vector3
	local fillWidth: number
	if def.Kind == "pouch" then
		b:Box(Vector3.new(1.1, 1.0, 0.55) * s, CFrame.new(0, -0.3, 0.4), c1, M.Fabric, "Pouch")
		b:Box(Vector3.new(1.15, 0.25, 0.6) * s, CFrame.new(0, 0.25 * s, 0.4), c2, M.SmoothPlastic, "Flap")
		fillHeight, fillBase, fillWidth = 0.7 * s, Vector3.new(0, -0.75 * s, 0.72 * s), 0.6 * s
	elseif def.Kind == "bag" then
		ellipsoid(b, Vector3.new(1.6, 2.0, 1.2) * s, CFrame.new(0, 0, 0.75 * s), c1, M.Fabric, "Sack")
		b:Box(Vector3.new(0.6, 0.2, 0.6) * s, CFrame.new(0, 1.0 * s, 0.75 * s), c2, M.SmoothPlastic, "Tie")
		fillHeight, fillBase, fillWidth = 1.2 * s, Vector3.new(0, -0.6 * s, 1.36 * s), 0.5 * s
	elseif def.Kind == "canister" then
		local n = (def.Capacity >= 18) and 2 or 1
		for i = 1, n do
			local x = (n == 1) and 0 or (i == 1 and -0.45 or 0.45) * s
			b:VCyl(2.0 * s, 0.9 * s, CFrame.new(x, 0, 0.6 * s), c1, M.Metal, "Canister")
			b:VCyl(0.15 * s, 0.95 * s, CFrame.new(x, 0.7 * s, 0.6 * s), c2, M.Neon, "Band")
			b:Ball(0.7 * s, CFrame.new(x, 1.0 * s, 0.6 * s), c1, M.Metal, "Cap")
		end
		fillHeight, fillBase, fillWidth = 1.5 * s, Vector3.new(0, -0.85 * s, 1.08 * s), 0.35 * s
	elseif def.Kind == "tank" then
		b:VCyl(2.4 * s, 1.3 * s, CFrame.new(0, 0, 0.8 * s), c1, M.Metal, "Tank")
		b:Ball(1.3 * s, CFrame.new(0, 1.2 * s, 0.8 * s), c1, M.Metal, "Dome")
		b:Ball(1.3 * s, CFrame.new(0, -1.2 * s, 0.8 * s), c1, M.Metal, "Dome")
		b:Box(Vector3.new(1.6, 0.25, 0.3) * s, CFrame.new(0, 0.6 * s, 0.1 * s), c2, M.SmoothPlastic, "Strap")
		b:Box(Vector3.new(1.6, 0.25, 0.3) * s, CFrame.new(0, -0.6 * s, 0.1 * s), c2, M.SmoothPlastic, "Strap")
		b:Tube(Vector3.new(0.5, 1.4, 0.8) * s, Vector3.new(0.9, 0.2, 0.2) * s, 0.2 * s, c2, M.Metal, "Pipe")
		fillHeight, fillBase, fillWidth = 1.9 * s, Vector3.new(0, -1.0 * s, 1.47 * s), 0.4 * s
	elseif def.Kind == "pod" then
		b:VCyl(2.0 * s, 1.5 * s, CFrame.new(0, 0, 0.9 * s), c1, M.SmoothPlastic, "Pod")
		b:Ball(1.5 * s, CFrame.new(0, 1.0 * s, 0.9 * s), c1, M.SmoothPlastic, "Top")
		b:Ball(1.5 * s, CFrame.new(0, -1.0 * s, 0.9 * s), c1, M.SmoothPlastic, "Bottom")
		b:VCyl(0.2 * s, 1.56 * s, CFrame.new(0, 0.4 * s, 0.9 * s), c2, M.Neon, "Ring")
		b:VCyl(0.2 * s, 1.56 * s, CFrame.new(0, -0.4 * s, 0.9 * s), c2, M.Neon, "Ring")
		fillHeight, fillBase, fillWidth = 1.7 * s, Vector3.new(0, -0.9 * s, 1.7 * s), 0.4 * s
	else -- orb
		b:Ball(2.2 * s, CFrame.new(0, 0.2 * s, 1.1 * s), c1, M.Glass, "Orb").Transparency = 0.35
		local core = b:Ball(1.0 * s, CFrame.new(0, 0.2 * s, 1.1 * s), c2, M.Neon, "Core")
		b:Box(Vector3.new(2.3, 0.2, 0.2) * s, CFrame.new(0, -0.9 * s, 0.4 * s), Color3.fromRGB(60, 60, 70), M.Metal, "Frame")
		b:Box(Vector3.new(0.2, 2.3, 0.2) * s, CFrame.new(0, 0.2 * s, 0.1 * s), Color3.fromRGB(60, 60, 70), M.Metal, "Frame")
		b:Light(core, c2, 10, 1.5)
		fillHeight, fillBase, fillWidth = 1.6 * s, Vector3.new(0, -0.6 * s, 2.25 * s), 0.3 * s
	end
	-- fill gauge (client scales "Fill" by the ContainerFill attribute)
	local gauge = b:Box(Vector3.new(fillWidth + 0.1, fillHeight + 0.1, 0.08), CFrame.new(fillBase + Vector3.new(0, fillHeight / 2, 0)), Color3.fromRGB(20, 22, 28), M.SmoothPlastic, "Gauge")
	gauge:SetAttribute("Height", fillHeight)
	local fill = b:Neon(Vector3.new(fillWidth, 0.05, 0.1), CFrame.new(fillBase + Vector3.new(0, 0.025, 0.02)), Color3.fromRGB(255, 160, 40), "Fill")
	fill:SetAttribute("Height", fillHeight)
	fill:SetAttribute("BaseY", fillBase.Y)
	local rar = Rarity.Get(def.Rarity)
	if rar.Order >= 5 then
		b:Sparkles(root, rar.Glow, 4, 0.3)
	end
	b.Model:SetAttribute("ContainerId", def.Id)
	local model = b:Finish(root)
	Builder.SetCollide(model, false, false)
	return model
end

------------------------------------------------------------------ pickups

function ItemModels.Pickup(resId: string): Model
	local def = Resources.ById[resId] or Resources.ById.pebble
	assert(def)
	local b = Builder.new("Pickup", false)
	local c = def.Color
	local root: BasePart
	local shape = def.Shape
	if shape == "Bolt" then
		root = b:VCyl(1.2, 0.35, CFrame.new(0, 0.6, 0) * CFrame.Angles(0, 0, math.rad(70)), c, M.Metal, "Root")
		b:Part({ Name = "HexHead", Shape = "Cylinder", Size = Vector3.new(0.3, 0.7, 0.7), CF = CFrame.new(-0.55, 0.85, 0) * CFrame.Angles(0, 0, math.rad(-20)), Color = c, Material = M.CorrodedMetal })
	elseif shape == "Shard" then
		root = b:Part({ Name = "Root", Shape = "Wedge", Size = Vector3.new(0.5, 1.4, 0.9), CF = CFrame.new(0, 0.6, 0) * CFrame.Angles(math.rad(10), math.rad(30), math.rad(12)), Color = c, Material = def.Glow and M.Glass or M.Slate })
		b:Part({ Name = "Shard2", Shape = "Wedge", Size = Vector3.new(0.4, 0.9, 0.6), CF = CFrame.new(0.4, 0.4, 0.2) * CFrame.Angles(math.rad(-15), math.rad(120), 0), Color = c, Material = def.Glow and M.Neon or M.Slate })
	elseif shape == "Plate" then
		root = b:Box(Vector3.new(1.6, 0.15, 1.1), CFrame.new(0, 0.25, 0) * CFrame.Angles(math.rad(8), math.rad(25), math.rad(5)), c, M.DiamondPlate, "Root")
		if def.Glow then
			b:Neon(Vector3.new(1.3, 0.05, 0.8), CFrame.new(0, 0.35, 0) * CFrame.Angles(math.rad(8), math.rad(25), math.rad(5)), Color3.fromRGB(90, 140, 255), "Cells")
		end
	elseif shape == "Board" then
		root = b:Box(Vector3.new(1.4, 0.12, 1.0), CFrame.new(0, 0.2, 0) * CFrame.Angles(0, math.rad(15), math.rad(6)), c, M.SmoothPlastic, "Root")
		b:Neon(Vector3.new(1.0, 0.04, 0.06), CFrame.new(0, 0.28, -0.2) * CFrame.Angles(0, math.rad(15), math.rad(6)), Color3.fromRGB(255, 220, 80), "Trace")
		b:Box(Vector3.new(0.35, 0.15, 0.35), CFrame.new(0.2, 0.3, 0.1) * CFrame.Angles(0, math.rad(15), 0), Color3.fromRGB(30, 30, 30), M.SmoothPlastic, "Chip")
	elseif shape == "Crystal" then
		root = b:Part({ Name = "Root", Size = Vector3.new(0.5, 1.6, 0.5), CF = CFrame.new(0, 0.8, 0) * CFrame.Angles(0, math.rad(45), math.rad(8)), Color = c, Material = M.Neon })
		b:Part({ Name = "Crystal2", Size = Vector3.new(0.4, 1.1, 0.4), CF = CFrame.new(0.35, 0.5, 0.1) * CFrame.Angles(0, math.rad(20), math.rad(-25)), Color = c, Material = M.Glass })
		b:Part({ Name = "Crystal3", Size = Vector3.new(0.35, 0.9, 0.35), CF = CFrame.new(-0.3, 0.45, -0.1) * CFrame.Angles(0, math.rad(60), math.rad(28)), Color = c, Material = M.Glass })
	elseif shape == "Orb" then
		root = b:Ball(1.0, CFrame.new(0, 0.6, 0), c, M.Neon, "Root")
		b:Ball(1.25, CFrame.new(0, 0.6, 0), c, M.ForceField, "Aura")
	elseif shape == "Core" then
		root = b:Ball(1.2, CFrame.new(0, 0.6, 0), Color3.fromRGB(60, 50, 46), M.Basalt, "Root")
		b:Ball(1.0, CFrame.new(0, 0.62, 0), c, M.Neon, "Glow").Transparency = 0.1
	elseif shape == "Badge" then
		root = b:XCyl(0.15, 1.1, CFrame.new(0, 0.35, 0) * CFrame.Angles(0, 0, math.rad(80)), c, M.Foil, "Root")
		b:Neon(Vector3.new(0.4, 0.4, 0.05), CFrame.new(0, 0.45, 0) * CFrame.Angles(math.rad(-10), 0, 0), Color3.fromRGB(255, 255, 255), "Star")
	elseif shape == "Canister" then
		root = b:VCyl(1.0, 0.6, CFrame.new(0, 0.5, 0), Color3.fromRGB(200, 205, 215), M.Metal, "Root")
		b:VCyl(0.5, 0.62, CFrame.new(0, 0.5, 0), c, M.Neon, "Glow")
	elseif shape == "Brick" then
		root = b:Box(Vector3.new(1.2, 0.6, 0.8), CFrame.new(0, 0.3, 0), c, M.Concrete, "Root")
	else -- Pebble
		root = b:Ball(0.9, CFrame.new(0, 0.35, 0), c, M.Slate, "Root")
		b:Ball(0.6, CFrame.new(0.35, 0.25, 0.2), c, M.Slate, "Pebble2")
	end
	if def.Glow then
		b:Light(root, c, 9, 1.2)
	end
	local rar = Rarity.Get(def.Rarity)
	if rar.Order >= 3 then
		b:Sparkles(root, rar.Glow, 3, 0.4)
	end
	b.Model:SetAttribute("Res", def.Id)
	local model = b:Finish(root)
	Builder.SetCollide(model, false, false)
	Builder.SetShadows(model, false)
	return model
end

------------------------------------------------------------------ capsules

function ItemModels.Capsule(accent: Color3): Model
	local b = Builder.new("DustCapsule", true)
	local root = b:VCyl(2.0, 1.6, CFrame.new(0, 1.6, 0), Color3.fromRGB(235, 236, 240), M.SmoothPlastic, "Root")
	b:Ball(1.6, CFrame.new(0, 2.6, 0), Color3.fromRGB(235, 236, 240), M.SmoothPlastic, "Top")
	b:Ball(1.6, CFrame.new(0, 0.6, 0), Color3.fromRGB(70, 72, 80), M.Metal, "Bottom")
	b:VCyl(0.25, 1.65, CFrame.new(0, 1.9, 0), accent, M.Neon, "Band")
	b:VCyl(0.25, 1.65, CFrame.new(0, 1.2, 0), accent, M.Neon, "Band")
	b:Box(Vector3.new(0.5, 0.5, 0.1), CFrame.new(0, 1.55, -0.8), Color3.fromRGB(30, 30, 36), M.SmoothPlastic, "Label")
	b:Light(root, accent, 8, 1)
	local model = b:Finish(root)
	Builder.SetShadows(model, true)
	return model
end

------------------------------------------------------------------ helmet (welded to the head)

function ItemModels.Helmet(visor: Color3, suit: Color3): Model
	local b = Builder.new("SpaceHelmet", false)
	local root = b:Part({ Name = "Root", Size = Vector3.new(0.4, 0.4, 0.4), Transparency = 1, CanCollide = false })
	local shell = b:Ball(2.35, CFrame.new(0, 0.15, 0.05), Color3.fromRGB(220, 235, 255), M.Glass, "Shell")
	shell.Transparency = 0.7
	local glass = ellipsoid(b, Vector3.new(1.9, 1.2, 1.1), CFrame.new(0, 0.45, -0.62), visor, M.Glass, "Visor")
	glass.Transparency = 0.45
	glass.Reflectance = 0.3
	b:Box(Vector3.new(2.0, 0.5, 1.6), CFrame.new(0, -0.75, 0.35), suit, M.SmoothPlastic, "Collar")
	b:XCyl(0.25, 1.6, CFrame.new(0, -0.95, 0) * CFrame.Angles(0, 0, math.rad(90)), Color3.fromRGB(255, 130, 40), M.SmoothPlastic, "NeckRing")
	b:Box(Vector3.new(0.12, 0.7, 0.12), CFrame.new(0.75, 1.0, 0.3), Color3.fromRGB(70, 70, 76), M.Metal, "Antenna")
	local tip = b:Ball(0.22, CFrame.new(0.75, 1.4, 0.3), Color3.fromRGB(255, 80, 60), M.Neon, "AntennaTip")
	local lamp = b:Ball(0.35, CFrame.new(-0.85, 0.5, -0.45), Color3.fromRGB(255, 245, 220), M.Neon, "Lamp")
	local spot = Instance.new("SpotLight")
	spot.Name = "HelmetLamp"
	spot.Range = 40
	spot.Angle = 75
	spot.Brightness = 3
	spot.Face = Enum.NormalId.Front
	spot.Color = Color3.fromRGB(255, 244, 220)
	spot.Shadows = true
	spot.Enabled = false
	spot.Parent = lamp
	tip:SetAttribute("Blink", true)
	local model = b:Finish(root)
	Builder.SetCollide(model, false, false)
	Builder.SetShadows(model, false)
	return model
end

return ItemModels
