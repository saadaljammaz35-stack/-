--!strict
-- Procedural models for base buildings. Origin = centre of the footprint at ground level.
-- Every model gets: a "Base" PrimaryPart slab, a "Status" neon light (recoloured by the
-- client from the building's status), and parts named "Spin"/"Piston"/"Belt" that the
-- client animates.

local Builder = require(script.Parent.Builder)
local Config = script.Parent.Parent.Config
local Buildings = require(Config.Buildings)

local M = Enum.Material
local WHITE = Color3.fromRGB(236, 238, 242)
local GREY = Color3.fromRGB(150, 154, 162)
local DARK = Color3.fromRGB(46, 48, 56)
local ORANGE = Color3.fromRGB(255, 122, 26)
local BLUE = Color3.fromRGB(60, 140, 255)
local GLASS = Color3.fromRGB(150, 200, 255)

local BuildingModels = {}

type B = Builder.BuilderObj

local function stripe(b: B, w: number, d: number, y: number, color: Color3?)
	b:Neon(Vector3.new(w + 0.06, 0.18, d + 0.06), CFrame.new(0, y, 0), color or ORANGE, "Stripe")
end

local function status(b: B, pos: Vector3)
	b:Ball(0.7, CFrame.new(pos), Color3.fromRGB(80, 220, 120), M.Neon, "Status")
end

local function windows(b: B, w: number, y: number, z: number, count: number)
	for i = 1, count do
		local x = -w / 2 + (i - 0.5) * (w / count)
		b:Box(Vector3.new(w / count * 0.7, 1.0, 0.1), CFrame.new(x, y, z), GLASS, M.Glass, "Window").Transparency = 0.2
	end
end

local function solarPanel(b: B, size: Vector3, cf: CFrame)
	b:Box(size, cf, Color3.fromRGB(28, 44, 96), M.Glass, "Panel").Reflectance = 0.25
	-- grid lines
	local nx = math.max(1, math.floor(size.X / 1.6))
	for i = 1, nx - 1 do
		local x = -size.X / 2 + i * size.X / nx
		b:Part({ Name = "Grid", Size = Vector3.new(0.06, size.Y + 0.02, size.Z), CF = cf * CFrame.new(x, 0, 0), Color = Color3.fromRGB(180, 190, 210), Material = M.Metal, CastShadow = false })
	end
	b:Part({ Name = "Frame", Size = Vector3.new(size.X + 0.2, size.Y * 0.6, 0.2), CF = cf * CFrame.new(0, 0, size.Z / 2), Color = GREY, Material = M.Metal })
	b:Part({ Name = "Frame", Size = Vector3.new(size.X + 0.2, size.Y * 0.6, 0.2), CF = cf * CFrame.new(0, 0, -size.Z / 2), Color = GREY, Material = M.Metal })
end

local function tank(b: B, h: number, d: number, pos: Vector3, color: Color3, band: Color3)
	b:VCyl(h, d, CFrame.new(pos + Vector3.new(0, h / 2, 0)), color, M.Metal, "Tank")
	b:Ball(d, CFrame.new(pos + Vector3.new(0, h, 0)), color, M.Metal, "TankTop")
	b:VCyl(0.3, d + 0.08, CFrame.new(pos + Vector3.new(0, h * 0.7, 0)), band, M.Neon, "TankBand")
end

local BUILD: { [string]: (b: B, W: number, D: number) -> () } = {}

BUILD.command_center = function(b, W, D)
	b:Box(Vector3.new(W - 2, 6, D - 4), CFrame.new(0, 3.6, 0.5), WHITE, M.SmoothPlastic, "Hall")
	b:Box(Vector3.new(W - 1.6, 0.6, D - 3.6), CFrame.new(0, 6.9, 0.5), DARK, M.Metal, "Roof")
	stripe(b, W - 2, D - 4, 2.2)
	windows(b, W - 3, 4.2, -(D - 4) / 2 + 0.45, 5)
	b:Box(Vector3.new(3, 3.6, 0.4), CFrame.new(0, 2.4, -(D - 4) / 2 + 0.3), DARK, M.Metal, "Door")
	b:Neon(Vector3.new(3.2, 0.2, 0.45), CFrame.new(0, 4.3, -(D - 4) / 2 + 0.3), ORANGE, "DoorLight")
	-- comms dish on the roof
	b:VCyl(2.0, 0.4, CFrame.new(3, 8.2, 2), GREY, M.Metal, "DishPost")
	local dish = b:Part({ Name = "Spin", Shape = "Cylinder", Size = Vector3.new(0.4, 4.2, 4.2), CF = CFrame.new(3, 9.6, 2) * CFrame.Angles(0, 0, math.rad(60)), Color = WHITE, Material = M.SmoothPlastic })
	dish.CastShadow = true
	b:Box(Vector3.new(0.15, 4, 0.15), CFrame.new(-4, 9, 3), GREY, M.Metal, "Antenna")
	b:Ball(0.4, CFrame.new(-4, 11.1, 3), Color3.fromRGB(255, 60, 60), M.Neon, "Beacon")
	status(b, Vector3.new(-4.5, 6, -(D - 4) / 2))
end

BUILD.dust_silo = function(b, W, D)
	local d = math.min(W, D) - 3
	b:VCyl(11, d, CFrame.new(0, 6.1, 0), WHITE, M.SmoothPlastic, "Silo")
	b:Ball(d, CFrame.new(0, 11.6, 0), WHITE, M.SmoothPlastic, "SiloDome")
	for _, y in { 3, 7, 10.5 } do
		b:VCyl(0.35, d + 0.15, CFrame.new(0, y, 0), ORANGE, M.SmoothPlastic, "Band")
	end
	for i = 0, 7 do
		b:Box(Vector3.new(0.12, 0.12, 0.9), CFrame.new(d / 2 + 0.35, 1.2 + i * 1.3, 0), GREY, M.Metal, "Rung")
	end
	b:Box(Vector3.new(0.15, 10.5, 0.15), CFrame.new(d / 2 + 0.35, 5.8, 0.45), GREY, M.Metal, "Rail")
	b:Box(Vector3.new(0.15, 10.5, 0.15), CFrame.new(d / 2 + 0.35, 5.8, -0.45), GREY, M.Metal, "Rail")
	-- fill gauge
	b:Box(Vector3.new(0.9, 8.2, 0.12), CFrame.new(0, 5.5, -d / 2 - 0.02), DARK, M.SmoothPlastic, "Gauge")
	local fill = b:Neon(Vector3.new(0.7, 0.1, 0.16), CFrame.new(0, 1.5, -d / 2 - 0.05), ORANGE, "Fill")
	fill:SetAttribute("Height", 8)
	fill:SetAttribute("BaseY", 1.45)
	status(b, Vector3.new(-d / 2, 1.5, -d / 2))
end

BUILD.deposit_hopper = function(b, W, D)
	b:Box(Vector3.new(W - 1, 2.5, D - 2), CFrame.new(0, 1.85, 0.5), WHITE, M.SmoothPlastic, "Machine")
	b:Part({ Name = "Frame", Shape = "Cylinder", Size = Vector3.new(1.2, 5.6, 5.6), CF = CFrame.new(0, 4.4, 0.2) * CFrame.Angles(0, math.rad(90), 0), Color = ORANGE, Material = M.SmoothPlastic })
	b:Part({ Name = "Intake", Shape = "Cylinder", Size = Vector3.new(1.25, 4.2, 4.2), CF = CFrame.new(0, 4.4, 0.2) * CFrame.Angles(0, math.rad(90), 0), Color = DARK, Material = M.DiamondPlate })
	local fan = b:Part({ Name = "Spin", Size = Vector3.new(3.6, 0.3, 0.1), CF = CFrame.new(0, 4.4, -0.45), Color = GREY, Material = M.Metal })
	fan.CastShadow = false
	b:Box(Vector3.new(1.6, 1.4, 1.0), CFrame.new(2.4, 1.8, -1.2), WHITE, M.SmoothPlastic, "Panel")
	b:Neon(Vector3.new(1.2, 0.6, 0.1), CFrame.new(2.4, 2.0, -1.72), BLUE, "Screen")
	status(b, Vector3.new(-2.6, 3.4, -1.2))
end

BUILD.robot_dock = function(b, W, D)
	b:VCyl(0.5, W - 2, CFrame.new(0, 0.85, 0), DARK, M.DiamondPlate, "Pad")
	b:VCyl(0.08, W - 1.6, CFrame.new(0, 1.12, 0), Color3.fromRGB(80, 220, 255), M.Neon, "ChargeRing")
	b:VCyl(0.08, W - 5, CFrame.new(0, 1.12, 0), Color3.fromRGB(80, 220, 255), M.Neon, "ChargeRing")
	for _, sx in { -1, 1 } do
		b:Box(Vector3.new(0.6, 6, 0.6), CFrame.new(sx * (W / 2 - 1), 3.6, D / 2 - 1), GREY, M.Metal, "Post")
	end
	b:Box(Vector3.new(W - 1, 0.4, 4), CFrame.new(0, 6.6, D / 2 - 2), WHITE, M.SmoothPlastic, "Canopy")
	b:Neon(Vector3.new(W - 1.2, 0.12, 0.2), CFrame.new(0, 6.4, D / 2 - 4), ORANGE, "CanopyLight")
	b:Box(Vector3.new(1.4, 2, 1), CFrame.new(-(W / 2 - 1.5), 1.6, -(D / 2 - 1.2)), WHITE, M.SmoothPlastic, "Charger")
	status(b, Vector3.new(-(W / 2 - 1.5), 2.8, -(D / 2 - 1.2)))
end

BUILD.capsule_catcher = function(b, W, D)
	b:VCyl(1.0, W - 3, CFrame.new(0, 1.1, 0), WHITE, M.SmoothPlastic, "Base2")
	b:VCyl(7, 1.6, CFrame.new(0, 5, 0), GREY, M.Metal, "Tower")
	for i = 0, 7 do
		local a = math.rad(i * 45)
		local r = (W - 3) / 2
		b:Box(Vector3.new(2.2, 0.5, 0.6), CFrame.new(r * math.cos(a), 9, r * math.sin(a)) * CFrame.Angles(0, -a + math.rad(90), 0), ORANGE, M.SmoothPlastic, "RingSeg")
	end
	b:Ball(1.6, CFrame.new(0, 9, 0), Color3.fromRGB(120, 220, 255), M.Neon, "Emitter")
	status(b, Vector3.new(0, 2, -(W - 3) / 2))
end

BUILD.research_lab = function(b, W, D)
	b:Box(Vector3.new(W - 1.5, 3, D - 1.5), CFrame.new(0, 2.1, 0), WHITE, M.SmoothPlastic, "Lab")
	b:Ball(W - 3, CFrame.new(0, 3.6, 0), GLASS, M.Glass, "Dome").Transparency = 0.35
	b:Ball(2, CFrame.new(0, 4.5, 0), Color3.fromRGB(120, 255, 180), M.Neon, "Experiment")
	stripe(b, W - 1.5, D - 1.5, 1.2, Color3.fromRGB(120, 255, 180))
	windows(b, W - 2, 2.3, -(D - 1.5) / 2 - 0.02, 3)
	status(b, Vector3.new(W / 2 - 1, 3.8, -(D / 2 - 1)))
end

BUILD.launch_pad = function(b, W, D)
	b:VCyl(0.4, W - 1, CFrame.new(0, 0.8, 0), DARK, M.Concrete, "Pad")
	b:VCyl(0.08, W - 2, CFrame.new(0, 1.02, 0), ORANGE, M.Neon, "PadRing")
	-- rocket
	b:VCyl(7, 2.4, CFrame.new(0, 5, 0), WHITE, M.SmoothPlastic, "Rocket")
	b:Ball(2.4, CFrame.new(0, 8.6, 0), ORANGE, M.SmoothPlastic, "Nose")
	b:VCyl(0.4, 2.45, CFrame.new(0, 6.5, 0), DARK, M.SmoothPlastic, "Band")
	for i = 0, 2 do
		local a = math.rad(i * 120)
		b:Part({ Name = "Fin", Shape = "Wedge", Size = Vector3.new(0.2, 2, 1.4), CF = CFrame.new(1.4 * math.cos(a), 2.2, 1.4 * math.sin(a)) * CFrame.Angles(0, -a, 0), Color = ORANGE, Material = M.SmoothPlastic })
	end
	b:Box(Vector3.new(1, 11, 1), CFrame.new(W / 2 - 1.5, 6.5, 0), GREY, M.DiamondPlate, "Gantry")
	b:Box(Vector3.new(3, 0.4, 0.8), CFrame.new(W / 2 - 3, 8, 0), GREY, M.Metal, "Arm")
	status(b, Vector3.new(W / 2 - 1.5, 12.3, 0))
end

BUILD.conveyor = function(b, W, D)
	b:Box(Vector3.new(3.4, 0.5, 4), CFrame.new(0, 0.85, 0), DARK, M.Fabric, "Belt")
	for _, sx in { -1, 1 } do
		b:Box(Vector3.new(0.3, 0.9, 4), CFrame.new(sx * 1.85, 1.05, 0), WHITE, M.SmoothPlastic, "Rail")
		b:Neon(Vector3.new(0.32, 0.12, 4), CFrame.new(sx * 1.85, 1.5, 0), ORANGE, "RailLight")
	end
	b:Neon(Vector3.new(0.8, 0.05, 0.8), CFrame.new(0, 1.12, 0) * CFrame.Angles(0, math.rad(45), 0), Color3.fromRGB(255, 200, 120), "Arrow").Transparency = 0.4
end

local function drill(b: B, W: number, D: number, big: boolean)
	local h = big and 12 or 8
	local s = big and 1.4 or 1
	for _, sx in { -1, 1 } do
		for _, sz in { -1, 1 } do
			b:Rod(Vector3.new(sx * (W / 2 - 0.8), 0.6, sz * (D / 2 - 0.8)), Vector3.new(sx * 0.6, h, sz * 0.6), 0.35, GREY, M.Metal, "Leg")
		end
	end
	b:Box(Vector3.new(2.2, 1.2, 2.2) * s, CFrame.new(0, h - 0.4, 0), ORANGE, M.SmoothPlastic, "Motor")
	local bit = b:VCyl(h - 2, 0.9 * s, CFrame.new(0, (h - 2) / 2 + 0.4, 0), DARK, M.DiamondPlate, "Spin")
	bit.CastShadow = true
	b:Box(Vector3.new(1.6, 1.6, 1.6) * s, CFrame.new(W / 2 - 1.2, 1.4, -(D / 2 - 1.2)), WHITE, M.SmoothPlastic, "Box")
	status(b, Vector3.new(W / 2 - 1.2, 2.6 * s, -(D / 2 - 1.2)))
end

BUILD.extractor_drill = function(b, W, D)
	drill(b, W, D, false)
end
BUILD.deep_drill = function(b, W, D)
	drill(b, W, D, true)
end

BUILD.pressure_chamber = function(b, W, D)
	b:XCyl(W - 3, D - 2.4, CFrame.new(0, 3.6, 0), WHITE, M.SmoothPlastic, "Chamber")
	b:Ball(D - 2.4, CFrame.new((W - 3) / 2, 3.6, 0), WHITE, M.SmoothPlastic, "EndCap")
	b:Ball(D - 2.4, CFrame.new(-(W - 3) / 2, 3.6, 0), DARK, M.Metal, "EndCap")
	for i = -1, 1 do
		b:XCyl(0.4, D - 2.2, CFrame.new(i * 2.6, 3.6, 0), DARK, M.SmoothPlastic, "Band")
	end
	b:Box(Vector3.new(W - 2, 1.0, D - 2.6), CFrame.new(0, 1.1, 0), GREY, M.Metal, "Cradle")
	b:Box(Vector3.new(1.4, 2.2, 1.0), CFrame.new(-(W / 2 - 1.2), 1.7, -(D / 2 - 0.8)), WHITE, M.SmoothPlastic, "Console")
	b:Neon(Vector3.new(1.0, 0.8, 0.1), CFrame.new(-(W / 2 - 1.2), 2.2, -(D / 2 - 0.3)), BLUE, "Screen")
	status(b, Vector3.new(-(W / 2 - 1.2), 3.1, -(D / 2 - 0.8)))
end

BUILD.stone_press = function(b, W, D)
	b:Box(Vector3.new(W - 2, 1.2, D - 2), CFrame.new(0, 1.2, 0), DARK, M.DiamondPlate, "Bed")
	for _, sx in { -1, 1 } do
		b:Box(Vector3.new(1.2, 9, 1.2), CFrame.new(sx * (W / 2 - 1.6), 5.1, 0), WHITE, M.SmoothPlastic, "Column")
	end
	b:Box(Vector3.new(W - 1.5, 1.5, 3), CFrame.new(0, 9.8, 0), ORANGE, M.SmoothPlastic, "Crown")
	b:Box(Vector3.new(3.4, 2.6, 3.4), CFrame.new(0, 6.5, 0), GREY, M.Metal, "Piston")
	for i = 0, 2 do
		b:Box(Vector3.new(1.4, 0.7, 1), CFrame.new(-2 + i * 1.6, 2.15, D / 2 - 1.6), Color3.fromRGB(225, 225, 230), M.Concrete, "Stone")
	end
	status(b, Vector3.new(W / 2 - 1.6, 10, -1))
end

BUILD.crystal_refinery = function(b, W, D)
	b:VCyl(1.2, W - 2, CFrame.new(0, 1.2, 0), WHITE, M.SmoothPlastic, "Plinth")
	b:VCyl(7, W - 4.5, CFrame.new(0, 5.3, 0), GLASS, M.Glass, "Column").Transparency = 0.5
	b:Part({ Name = "Spin", Size = Vector3.new(1.4, 4, 1.4), CF = CFrame.new(0, 5, 0) * CFrame.Angles(0, math.rad(45), 0), Color = Color3.fromRGB(200, 120, 255), Material = M.Neon })
	b:VCyl(0.6, W - 4, CFrame.new(0, 9, 0), DARK, M.Metal, "Cap")
	b:Tube(Vector3.new(W / 2 - 1, 1.8, 0), Vector3.new(W / 2 - 1, 8.5, 0), 0.5, GREY, M.Metal, "Pipe")
	b:Tube(Vector3.new(W / 2 - 1, 8.5, 0), Vector3.new(1, 8.5, 0), 0.5, GREY, M.Metal, "Pipe")
	status(b, Vector3.new(-(W / 2 - 1), 2.2, 0))
end

BUILD.helium_extractor = function(b, W, D)
	b:Box(Vector3.new(W - 1.5, 1, D - 1.5), CFrame.new(0, 1.1, 0), GREY, M.DiamondPlate, "Deck")
	tank(b, 6, 3, Vector3.new(-2.2, 1.6, -2.2), WHITE, Color3.fromRGB(120, 250, 255))
	tank(b, 7, 3, Vector3.new(2.2, 1.6, -2.2), WHITE, Color3.fromRGB(120, 250, 255))
	tank(b, 5, 3, Vector3.new(0, 1.6, 2.2), WHITE, Color3.fromRGB(120, 250, 255))
	b:Tube(Vector3.new(-2.2, 6, -2.2), Vector3.new(2.2, 6, -2.2), 0.4, GREY, M.Metal, "Pipe")
	b:Tube(Vector3.new(0, 5, 2.2), Vector3.new(0, 5, -2.2), 0.4, GREY, M.Metal, "Pipe")
	status(b, Vector3.new(W / 2 - 1, 2.2, D / 2 - 1))
end

BUILD.solar_post = function(b, W, D)
	b:Box(Vector3.new(0.35, 3.4, 0.35), CFrame.new(0, 2.3, 0), GREY, M.Metal, "Post")
	solarPanel(b, Vector3.new(3.2, 0.15, 2.4), CFrame.new(0, 4.1, 0) * CFrame.Angles(math.rad(-30), 0, 0))
end

BUILD.solar_panel = function(b, W, D)
	for _, sx in { -1, 1 } do
		b:Box(Vector3.new(0.3, 2.2, 0.3), CFrame.new(sx * 2.8, 1.7, 1.6), GREY, M.Metal, "Leg")
		b:Box(Vector3.new(0.3, 1.0, 0.3), CFrame.new(sx * 2.8, 1.1, -1.6), GREY, M.Metal, "Leg")
	end
	solarPanel(b, Vector3.new(7, 0.15, 6.4), CFrame.new(0, 2.2, 0) * CFrame.Angles(math.rad(-22), 0, 0))
end

BUILD.solar_tracker = function(b, W, D)
	b:VCyl(5.5, 1.0, CFrame.new(0, 3.4, 0), GREY, M.Metal, "Mast")
	b:Box(Vector3.new(1.6, 1.0, 1.6), CFrame.new(0, 6.3, 0), DARK, M.Metal, "Pivot")
	solarPanel(b, Vector3.new(10.5, 0.2, 7.5), CFrame.new(0, 7.2, 0) * CFrame.Angles(math.rad(-35), 0, 0))
	status(b, Vector3.new(0, 1.6, -1.2))
end

BUILD.fusion_reactor = function(b, W, D)
	b:VCyl(1.2, W - 1, CFrame.new(0, 1.2, 0), DARK, M.DiamondPlate, "Base2")
	local r = W / 2 - 2.5
	for i = 0, 11 do
		local a = math.rad(i * 30)
		b:Box(Vector3.new(2.6, 2.2, 1.6), CFrame.new(r * math.cos(a), 4.2, r * math.sin(a)) * CFrame.Angles(0, -a + math.rad(90), 0), WHITE, M.SmoothPlastic, "Torus")
	end
	b:Ball(3.6, CFrame.new(0, 4.2, 0), Color3.fromRGB(120, 230, 255), M.Neon, "Core")
	for i = 0, 3 do
		local a = math.rad(i * 90 + 45)
		b:Rod(Vector3.new(r * math.cos(a), 4.2, r * math.sin(a)), Vector3.new(0, 4.2, 0), 0.3, Color3.fromRGB(120, 230, 255), M.Neon, "Spoke")
	end
	status(b, Vector3.new(0, 2, -(W / 2 - 1)))
end

BUILD.battery_bank = function(b, W, D)
	b:Box(Vector3.new(W - 1, 0.6, D - 1), CFrame.new(0, 0.9, 0), DARK, M.Metal, "Rack")
	for i = 0, 3 do
		local x = -2.4 + i * 1.6
		b:VCyl(3, 1.2, CFrame.new(x, 2.7, 0), WHITE, M.SmoothPlastic, "Cell")
		b:VCyl(0.3, 1.25, CFrame.new(x, 3.4, 0), Color3.fromRGB(80, 255, 120), M.Neon, "Charge")
	end
	status(b, Vector3.new(W / 2 - 0.8, 1.6, -(D / 2 - 0.8)))
end

BUILD.foundation_tile = function(b, W, D)
	b:Box(Vector3.new(3.9, 0.3, 3.9), CFrame.new(0, 0.75, 0), Color3.fromRGB(200, 204, 212), M.Concrete, "Tile")
	b:Neon(Vector3.new(0.15, 0.05, 3.9), CFrame.new(1.9, 0.92, 0), ORANGE, "Edge")
end

BUILD.lamp_post = function(b, W, D)
	b:Box(Vector3.new(0.35, 6, 0.35), CFrame.new(0, 3.6, 0), GREY, M.Metal, "Pole")
	b:Box(Vector3.new(1.8, 0.3, 0.6), CFrame.new(0.6, 6.6, 0), DARK, M.Metal, "Arm")
	local lamp = b:Neon(Vector3.new(1, 0.25, 0.5), CFrame.new(1.2, 6.4, 0), Color3.fromRGB(255, 240, 210), "Lamp")
	b:Light(lamp, Color3.fromRGB(255, 236, 200), 26, 2.2)
end

BUILD.colony_flag = function(b, W, D)
	b:Box(Vector3.new(0.2, 7, 0.2), CFrame.new(0, 4.1, 0), GREY, M.Metal, "Pole")
	b:Box(Vector3.new(2.6, 1.6, 0.08), CFrame.new(1.4, 6.6, 0), ORANGE, M.Fabric, "Flag")
	b:Box(Vector3.new(2.6, 0.3, 0.1), CFrame.new(1.4, 6.0, 0), WHITE, M.Fabric, "FlagStripe")
	b:Box(Vector3.new(2.8, 0.12, 0.12), CFrame.new(1.4, 7.45, 0), GREY, M.Metal, "Bar")
end

BUILD.antenna_mast = function(b, W, D)
	for i = 0, 2 do
		local a = math.rad(i * 120)
		b:Rod(Vector3.new(1.3 * math.cos(a), 0.6, 1.3 * math.sin(a)), Vector3.new(0.2 * math.cos(a), 11, 0.2 * math.sin(a)), 0.18, GREY, M.Metal, "Strut")
	end
	b:Ball(0.5, CFrame.new(0, 11.3, 0), Color3.fromRGB(255, 60, 60), M.Neon, "Beacon")
	b:Part({ Name = "Spin", Shape = "Cylinder", Size = Vector3.new(0.2, 2.2, 2.2), CF = CFrame.new(0, 8, 0) * CFrame.Angles(0, 0, math.rad(55)), Color = WHITE, Material = M.SmoothPlastic })
end

BUILD.hab_dome = function(b, W, D)
	b:Ball(W - 2, CFrame.new(0, 0.6, 0), WHITE, M.SmoothPlastic, "Dome")
	b:VCyl(0.4, W - 1.8, CFrame.new(0, 1.0, 0), ORANGE, M.SmoothPlastic, "Ring")
	b:ZCyl(3, 3, CFrame.new(0, 1.9, -(D / 2 - 1.5)), WHITE, M.SmoothPlastic, "Tunnel")
	b:Box(Vector3.new(1.6, 2.4, 0.2), CFrame.new(0, 1.9, -(D / 2) + 0.05), DARK, M.Metal, "Door")
	for i = 0, 3 do
		local a = math.rad(45 + i * 90)
		local r = (W - 2) / 2 - 0.2
		b:Ball(1.2, CFrame.new(r * 0.75 * math.cos(a), 3.4, r * 0.75 * math.sin(a)), GLASS, M.Glass, "Porthole")
	end
end

BUILD.greenhouse_dome = function(b, W, D)
	b:VCyl(0.8, W - 1.5, CFrame.new(0, 1, 0), WHITE, M.SmoothPlastic, "Planter")
	b:Ball(W - 2, CFrame.new(0, 1.2, 0), GLASS, M.Glass, "Glass").Transparency = 0.55
	local rng = Random.new(7)
	for _ = 1, 9 do
		local x, z = rng:NextNumber(-3, 3), rng:NextNumber(-3, 3)
		local s = rng:NextNumber(1, 2.2)
		b:Ball(s, CFrame.new(x, 1.6 + s / 2, z), Color3.fromRGB(70, 170 + rng:NextInteger(0, 60), 80), M.Grass, "Plant")
	end
	local lamp = b:Neon(Vector3.new(1, 0.2, 1), CFrame.new(0, 6.4, 0), Color3.fromRGB(255, 120, 230), "GrowLight")
	b:Light(lamp, Color3.fromRGB(255, 140, 230), 16, 1.5)
end

BUILD.astronaut_statue = function(b, W, D)
	local gold = Color3.fromRGB(255, 200, 80)
	b:Box(Vector3.new(W - 1, 1.6, D - 1), CFrame.new(0, 1.4, 0), WHITE, M.Marble, "Pedestal")
	b:Box(Vector3.new(2, 2.4, 1.2), CFrame.new(0, 4.6, 0), gold, M.Foil, "Torso")
	b:Ball(2.2, CFrame.new(0, 6.8, 0), gold, M.Foil, "Helmet")
	b:Ball(1.4, CFrame.new(0, 6.9, -0.5), Color3.fromRGB(40, 40, 50), M.Glass, "Visor")
	b:Box(Vector3.new(0.8, 2.2, 0.8), CFrame.new(-0.55, 2.3, 0), gold, M.Foil, "Leg")
	b:Box(Vector3.new(0.8, 2.2, 0.8), CFrame.new(0.55, 2.3, 0), gold, M.Foil, "Leg")
	b:Box(Vector3.new(0.7, 2.2, 0.7), CFrame.new(-1.4, 5.0, 0) * CFrame.Angles(0, 0, math.rad(-20)), gold, M.Foil, "Arm")
	b:Box(Vector3.new(0.7, 2.6, 0.7), CFrame.new(1.5, 6.4, 0) * CFrame.Angles(0, 0, math.rad(150)), gold, M.Foil, "Arm")
	b:Box(Vector3.new(0.25, 4, 0.25), CFrame.new(2.3, 8.4, 0), GREY, M.Metal, "BroomShaft")
	b:Box(Vector3.new(1.8, 0.8, 0.6), CFrame.new(2.3, 10.6, 0), gold, M.Foil, "BroomHead")
end

function BuildingModels.Model(buildingId: string, level: number?): Model
	local def = Buildings.ById[buildingId] or Buildings.ById.foundation_tile
	local W, D = def.W * 4, def.D * 4
	local b = Builder.new(def.Name, true)
	local isFlat = buildingId == "conveyor" or buildingId == "foundation_tile"
	local base = b:Part({
		Name = "Base",
		Size = Vector3.new(W - 0.15, 0.6, D - 0.15),
		CF = CFrame.new(0, 0.3, 0),
		Color = isFlat and Color3.fromRGB(70, 74, 84) or Color3.fromRGB(176, 180, 190),
		Material = M.Concrete,
	})
	local builder = BUILD[def.Id]
	if builder then
		builder(b, W, D)
	end
	if (level or 1) > 1 and not isFlat then
		-- upgraded buildings get glowing corner pylons
		for _, sx in { -1, 1 } do
			for _, sz in { -1, 1 } do
				b:Neon(Vector3.new(0.4, 0.4 + 0.3 * (level :: number), 0.4), CFrame.new(sx * (W / 2 - 0.4), 0.8 + 0.15 * (level :: number), sz * (D / 2 - 0.4)), ORANGE, "Pylon")
			end
		end
	end
	local info = b:Attachment(base, "Info", CFrame.new(0, 4 + math.max(W, D) * 0.45, 0))
	info:SetAttribute("Height", 4 + math.max(W, D) * 0.45)
	b.Model:SetAttribute("BuildingId", def.Id)
	b.Model:SetAttribute("Level", level or 1)
	return b:Finish(base)
end

return BuildingModels
