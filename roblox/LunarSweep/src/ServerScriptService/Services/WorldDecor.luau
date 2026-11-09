--!nonstrict
-- Environmental props for every zone: boulders, crashed landers and satellites, crystal
-- clusters, lava glow, vents, glyph stones, the monolith, meteorites and the light
-- bridges between orbital asteroids. Large props block the cells beneath them so sectors
-- can always reach 100%.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local MapLayout = require(Shared.MapLayout)
local Zones = require(Shared.Config.Zones)
local ModelFactory = require(Shared.ModelFactory)
local Builder = ModelFactory.Builder
local WorldGrid = require(script.Parent.WorldGrid)
local TerrainGenerator = require(script.Parent.TerrainGenerator)

local WorldDecor = {}

local M = Enum.Material
local rng = Random.new(4242)

local folder: Folder

local function groundY(x: number, z: number): number
	return TerrainGenerator.Sample(x, z)
end

local function place(model: Model, x: number, z: number, y: number?, rotY: number?, block: number?)
	local gy = y or groundY(x, z)
	model:PivotTo(CFrame.new(x, gy, z) * CFrame.Angles(0, rotY or rng:NextNumber(0, math.pi * 2), 0))
	model.Parent = folder
	if block and block > 0 then
		WorldGrid.BlockCircle(x, z, block)
	end
	return model
end

local function randomIn(zone): (number, number)
	local x0, z0, x1, z1 = MapLayout.ZoneBounds(zone.Grid[1], zone.Grid[2])
	return rng:NextNumber(x0 + 70, x1 - 70), rng:NextNumber(z0 + 70, z1 - 70)
end

------------------------------------------------------------------ prop builders

local function boulder(color: Color3, material: Enum.Material, size: number): Model
	local b = Builder.new("Boulder", true)
	local root = b:Ball(size, CFrame.new(0, size * 0.25, 0), color, material, "Rock")
	for _ = 1, rng:NextInteger(1, 3) do
		local s = size * rng:NextNumber(0.4, 0.7)
		b:Ball(s, CFrame.new(rng:NextNumber(-size * 0.45, size * 0.45), s * 0.2, rng:NextNumber(-size * 0.45, size * 0.45)), color, material, "Rock")
	end
	return b:Finish(root)
end

local function crystalCluster(color: Color3, size: number): Model
	local b = Builder.new("Crystals", true)
	local root = b:Part({ Name = "Crystal", Size = Vector3.new(size * 0.35, size * 1.6, size * 0.35), CF = CFrame.new(0, size * 0.7, 0) * CFrame.Angles(0, math.rad(45), 0), Color = color, Material = M.Neon })
	for i = 1, 4 do
		local a = math.rad(i * 90 + rng:NextNumber(-20, 20))
		local h = size * rng:NextNumber(0.6, 1.1)
		b:Part({ Name = "Crystal", Size = Vector3.new(size * 0.25, h, size * 0.25), CF = CFrame.new(math.cos(a) * size * 0.35, h * 0.4, math.sin(a) * size * 0.35) * CFrame.Angles(math.sin(a) * 0.5, a, math.cos(a) * 0.5), Color = color, Material = M.Glass })
	end
	b:Light(root, color, size * 3 + 6, 1.4)
	return b:Finish(root)
end

local function lander(scale: number, wrecked: boolean): Model
	local b = Builder.new("Lander", true)
	local gold = Color3.fromRGB(220, 180, 80)
	local body = b:Box(Vector3.new(8, 5, 8) * scale, CFrame.new(0, 6 * scale, 0) * CFrame.Angles(wrecked and 0.25 or 0, 0, wrecked and 0.15 or 0), gold, M.Foil, "Body")
	b:Box(Vector3.new(6, 4, 6) * scale, CFrame.new(0, 10 * scale, 0) * CFrame.Angles(wrecked and 0.3 or 0, 0.4, wrecked and 0.2 or 0), Color3.fromRGB(200, 200, 205), M.Metal, "Cabin")
	for i = 0, 3 do
		local a = math.rad(45 + i * 90)
		local foot = Vector3.new(math.cos(a) * 7, 0.5, math.sin(a) * 7) * scale
		if not (wrecked and i == 2) then
			b:Rod(Vector3.new(math.cos(a) * 3.5, 5, math.sin(a) * 3.5) * scale, foot, 0.5 * scale, Color3.fromRGB(170, 170, 175), M.Metal, "Leg")
			b:VCyl(0.4 * scale, 2 * scale, CFrame.new(foot), Color3.fromRGB(170, 170, 175), M.Metal, "Foot")
		end
	end
	b:Box(Vector3.new(0.4, 4, 3) * scale, CFrame.new(4.4 * scale, 6 * scale, 0), Color3.fromRGB(40, 40, 46), M.Metal, "Hatch")
	return b:Finish(body)
end

local function satellite(): Model
	local b = Builder.new("Satellite", true)
	local body = b:Box(Vector3.new(4, 4, 4), CFrame.new(0, 2, 0) * CFrame.Angles(0.3, 0.2, 0.5), Color3.fromRGB(210, 210, 215), M.Foil, "Body")
	b:Box(Vector3.new(10, 0.2, 3), CFrame.new(6, 1, 0) * CFrame.Angles(0, 0, 0.4), Color3.fromRGB(30, 50, 110), M.Glass, "Panel")
	b:Box(Vector3.new(7, 0.2, 3), CFrame.new(-5, 0.6, 1) * CFrame.Angles(0.2, 0.3, -0.3), Color3.fromRGB(30, 50, 110), M.Glass, "Panel")
	b:Part({ Name = "Dish", Shape = "Cylinder", Size = Vector3.new(0.4, 4, 4), CF = CFrame.new(0, 4.5, 1) * CFrame.Angles(0.6, 0, 1.1), Color = Color3.fromRGB(230, 230, 235), Material = M.SmoothPlastic })
	return b:Finish(body)
end

local function vent(color: Color3): Model
	local b = Builder.new("Vent", true)
	local root = b:VCyl(1.2, 5, CFrame.new(0, 0.4, 0), Color3.fromRGB(50, 40, 40), M.Basalt, "Vent")
	local glow = b:VCyl(0.2, 3, CFrame.new(0, 1.05, 0), color, M.Neon, "Glow")
	b:Light(glow, color, 18, 2)
	local smoke = Instance.new("ParticleEmitter")
	smoke.Texture = "rbxasset://textures/particles/smoke_main.dds"
	smoke.Color = ColorSequence.new(Color3.fromRGB(90, 80, 80))
	smoke.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 2), NumberSequenceKeypoint.new(1, 8) })
	smoke.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.4), NumberSequenceKeypoint.new(1, 1) })
	smoke.Lifetime = NumberRange.new(3, 5)
	smoke.Speed = NumberRange.new(4, 8)
	smoke.Rate = 4
	smoke.SpreadAngle = Vector2.new(12, 12)
	smoke.Parent = glow
	return b:Finish(root)
end

local function glyphStone(color: Color3): Model
	local b = Builder.new("GlyphStone", true)
	local root = b:Box(Vector3.new(3, 9, 1.4), CFrame.new(0, 4, 0) * CFrame.Angles(0, 0, rng:NextNumber(-0.15, 0.15)), Color3.fromRGB(30, 28, 40), M.Slate, "Stone")
	for i = 1, 3 do
		b:Neon(Vector3.new(1.4, 0.3, 0.1), CFrame.new(0, 2 + i * 1.8, -0.72), color, "Glyph").Transparency = 0.3
	end
	return b:Finish(root)
end

local function probe(): Model
	local b = Builder.new("Probe", true)
	local root = b:Box(Vector3.new(0.4, 6, 0.4), CFrame.new(0, 3, 0), Color3.fromRGB(150, 150, 160), M.Metal, "Pole")
	b:Box(Vector3.new(2, 1.2, 1.2), CFrame.new(0, 5.5, 0), Color3.fromRGB(230, 230, 235), M.SmoothPlastic, "Box")
	local light = b:Ball(0.4, CFrame.new(0, 6.4, 0), Color3.fromRGB(255, 80, 60), M.Neon, "Blink")
	light:SetAttribute("Blink", true)
	return b:Finish(root)
end

------------------------------------------------------------------ per-zone decoration

local function decorateZone(zone)
	local x0, z0, x1, z1 = MapLayout.ZoneBounds(zone.Grid[1], zone.Grid[2])
	-- generic boulders everywhere
	local count = zone.Id == "crystal_caverns" and 30 or 22
	for _ = 1, count do
		local x, z = randomIn(zone)
		local size = rng:NextNumber(3, 9)
		place(boulder(zone.RockColor, zone.RockMaterial == M.CrackedLava and M.Basalt or zone.RockMaterial, size), x, z, nil, nil, size * 0.55)
	end
	if zone.Id == "dusty_flats" then
		for _ = 1, 6 do
			local x, z = randomIn(zone)
			place(probe(), x, z, nil, nil, 2)
		end
	elseif zone.Id == "pockmark_craters" then
		for _ = 1, 10 do
			local x, z = randomIn(zone)
			local b = Builder.new("Meteorite", true)
			local s = rng:NextNumber(3, 6)
			local root = b:Ball(s, CFrame.new(0, s * 0.3, 0), Color3.fromRGB(60, 50, 48), M.Basalt, "Rock")
			b:Ball(s * 0.6, CFrame.new(s * 0.25, s * 0.45, 0), Color3.fromRGB(255, 120, 50), M.Neon, "Glow")
			b:Light(root, Color3.fromRGB(255, 120, 50), 12, 1)
			place(b:Finish(root), x, z, nil, nil, s * 0.6)
		end
	elseif zone.Id == "junkyard_expanse" then
		place(lander(1.6, true), 640, 120, nil, 0.4, 14)
		place(lander(1.0, true), 420, -150, nil, nil, 9)
		place(lander(1.2, false), 650, -180, nil, nil, 10)
		for _ = 1, 8 do
			local x, z = randomIn(zone)
			place(satellite(), x, z, nil, nil, 5)
		end
	elseif zone.Id == "crystal_caverns" then
		local colors = { Color3.fromRGB(190, 110, 255), Color3.fromRGB(110, 230, 255), Color3.fromRGB(255, 120, 220) }
		for _, c in MapLayout.CaveChambers do
			for _ = 1, 6 do
				local a = rng:NextNumber(0, math.pi * 2)
				local r = c.R - rng:NextNumber(2, 5)
				local x, z = c.X + math.cos(a) * r, c.Z + math.sin(a) * r
				place(crystalCluster(colors[rng:NextInteger(1, #colors)], rng:NextNumber(2.5, 5)), x, z, c.Floor, nil, 4)
			end
			-- ceiling glow
			local b = Builder.new("CaveLight", false)
			local orb = b:Ball(2, CFrame.new(0, 0, 0), Color3.fromRGB(200, 160, 255), M.Neon, "Orb")
			b:Light(orb, Color3.fromRGB(200, 170, 255), 60, 1.2)
			local m = b:Finish(orb)
			m:PivotTo(CFrame.new(c.X, c.Floor + 24, c.Z))
			m.Parent = folder
		end
		for _ = 1, 10 do
			local x, z = randomIn(zone)
			place(crystalCluster(colors[rng:NextInteger(1, #colors)], rng:NextNumber(3, 6)), x, z, nil, nil, 0)
		end
	elseif zone.Id == "ember_rift" then
		-- lava glow strips along the rift channels
		for _, line in TerrainGenerator.Rifts do
			for i = 1, #line - 1 do
				local a, b2 = line[i], line[i + 1]
				local len = (b2 - a).Magnitude
				local steps = math.floor(len / 26)
				for s = 0, steps do
					local p = a:Lerp(b2, s / math.max(1, steps))
					local y = groundY(p.X, p.Y)
					local lava = Instance.new("Part")
					lava.Name = "Lava"
					lava.Anchored = true
					lava.CanCollide = false
					lava.CanQuery = false
					lava.CastShadow = false
					lava.Material = M.Neon
					lava.Color = Color3.fromRGB(255, 90, 30)
					lava.Size = Vector3.new(6, 0.4, 26)
					lava.CFrame = CFrame.lookAt(Vector3.new(p.X, y + 0.3, p.Y), Vector3.new(b2.X, y + 0.3, b2.Y))
					lava.Parent = folder
					if s % 2 == 0 then
						local light = Instance.new("PointLight")
						light.Color = Color3.fromRGB(255, 110, 40)
						light.Range = 30
						light.Brightness = 2
						light.Parent = lava
					end
				end
			end
		end
		for _ = 1, 9 do
			local x, z = randomIn(zone)
			place(vent(Color3.fromRGB(255, 100, 40)), x, z, nil, nil, 4)
		end
		for _ = 1, 12 do
			local x, z = randomIn(zone)
			local b = Builder.new("ObsidianSpike", true)
			local h = rng:NextNumber(5, 12)
			local root = b:Part({ Name = "Spike", Shape = "Wedge", Size = Vector3.new(2.5, h, 3), CF = CFrame.new(0, h / 2, 0), Color = Color3.fromRGB(25, 20, 30), Material = M.Glass })
			place(b:Finish(root), x, z, nil, nil, 3)
		end
	elseif zone.Id == "shadow_side" then
		for _ = 1, 12 do
			local x, z = randomIn(zone)
			place(glyphStone(Color3.fromRGB(140, 120, 255)), x, z, nil, nil, 3)
		end
		-- the black monolith
		local b = Builder.new("Monolith", true)
		local root = b:Box(Vector3.new(6, 26, 1.6), CFrame.new(0, 13, 0), Color3.fromRGB(8, 8, 12), M.Glass, "Monolith")
		root.Reflectance = 0.4
		b:Neon(Vector3.new(6.2, 0.2, 1.7), CFrame.new(0, 26.1, 0), Color3.fromRGB(140, 120, 255), "Edge")
		place(b:Finish(root), -640, -24, nil, 0, 6)
	elseif zone.Id == "starfall_basin" then
		local peakY = groundY(-512, -512)
		local b = Builder.new("GreatMeteorite", true)
		local root = b:Ball(14, CFrame.new(0, 5, 0), Color3.fromRGB(50, 42, 40), M.Basalt, "Core")
		b:Ball(10, CFrame.new(3, 8, 2), Color3.fromRGB(255, 200, 90), M.Neon, "Glow")
		b:Light(root, Color3.fromRGB(255, 200, 100), 60, 2.5)
		b:Sparkles(root, Color3.fromRGB(255, 220, 120), 8, 1.2)
		place(b:Finish(root), -512, -490, peakY - 2, 0, 12)
		for _ = 1, 10 do
			local x, z = randomIn(zone)
			local mb = Builder.new("Meteorite", true)
			local s = rng:NextNumber(3, 7)
			local r = mb:Ball(s, CFrame.new(0, s * 0.3, 0), Color3.fromRGB(70, 60, 50), M.Basalt, "Rock")
			mb:Ball(s * 0.5, CFrame.new(0, s * 0.55, 0), Color3.fromRGB(255, 220, 120), M.Neon, "Glow")
			place(mb:Finish(r), x, z, nil, nil, s * 0.6)
		end
	elseif zone.Id == "frostbite_basin" then
		for _ = 1, 8 do
			local x, z = randomIn(zone)
			place(crystalCluster(Color3.fromRGB(160, 230, 255), rng:NextNumber(3, 5)), x, z, nil, nil, 3)
		end
		for _ = 1, 5 do
			local x, z = randomIn(zone)
			local v = vent(Color3.fromRGB(150, 220, 255))
			place(v, x, z, nil, nil, 4)
		end
	end
	local _ = x0 + z0 + x1 + z1
end

local function orbitalDecor()
	local zone = Zones.ById.orbital_ring
	local main = MapLayout.Asteroids[1]
	local mainTop = MapLayout.ORBIT_Y + main.TopOffset
	for i = 2, #MapLayout.Asteroids do
		local a = MapLayout.Asteroids[i]
		local top = MapLayout.ORBIT_Y + a.TopOffset
		local from = Vector3.new(main.X, mainTop, main.Z)
		local to = Vector3.new(a.X, top, a.Z)
		local dir = (to - from)
		local flat = Vector3.new(dir.X, 0, dir.Z).Unit
		local p0 = from + flat * (main.R - 6)
		local p1 = to - flat * (a.R - 6)
		local bridge = Instance.new("Part")
		bridge.Name = "LightBridge"
		bridge.Anchored = true
		bridge.Material = M.ForceField
		bridge.Color = zone.Accent
		bridge.Transparency = 0.1
		bridge.CastShadow = false
		bridge.Size = Vector3.new(9, 1, (p1 - p0).Magnitude + 4)
		bridge.CFrame = CFrame.lookAt((p0 + p1) / 2 + Vector3.new(0, 0.2, 0), p1 + Vector3.new(0, 0.2, 0))
		bridge.Parent = folder
		local solid = bridge:Clone()
		solid.Name = "BridgeFloor"
		solid.Material = M.Glass
		solid.Transparency = 0.6
		solid.Size = Vector3.new(8, 0.6, bridge.Size.Z)
		solid.Parent = folder
	end
	-- return pad on the main asteroid
	local b = Builder.new("ReturnPad", true)
	local pad = b:VCyl(1, 14, CFrame.new(0, 0.5, 0), Color3.fromRGB(40, 43, 52), M.Concrete, "Pad")
	b:VCyl(0.12, 12, CFrame.new(0, 1.06, 0), zone.Accent, M.Neon, "Ring")
	local p = Instance.new("ProximityPrompt")
	p.ActionText = "Return to Colony"
	p.ObjectText = "Orbital Pad"
	p.HoldDuration = 0.5
	p.MaxActivationDistance = 12
	p.RequiresLineOfSight = false
	p:SetAttribute("Action", "ReturnToHub")
	p.Parent = pad
	local m = b:Finish(pad)
	m.ModelStreamingMode = Enum.ModelStreamingMode.Persistent
	m:PivotTo(CFrame.new(main.X + 30, mainTop, main.Z + 30))
	m.Parent = folder
	WorldGrid.BlockCircle(main.X + 30, main.Z + 30, 9)
	for i = 1, #MapLayout.Asteroids do
		local a = MapLayout.Asteroids[i]
		local top = MapLayout.ORBIT_Y + a.TopOffset
		for _ = 1, 3 do
			local ang = rng:NextNumber(0, math.pi * 2)
			local r = rng:NextNumber(10, a.R - 14)
			local x, z = a.X + math.cos(ang) * r, a.Z + math.sin(ang) * r
			place(crystalCluster(Color3.fromRGB(90, 255, 220), rng:NextNumber(2.5, 4)), x, z, top, nil, 3)
		end
	end
end

function WorldDecor.Build()
	folder = Instance.new("Folder")
	folder.Name = "Decor"
	folder.Parent = Workspace
	for _, zone in Zones.List do
		if zone.Grid then
			decorateZone(zone)
			task.wait()
		end
	end
	orbitalDecor()
	return folder
end

return WorldDecor
