--!nonstrict
-- Builds Tranquility Colony: plaza, roads, the ring of service stations (each with a
-- ProximityPrompt), base plot pads, zone gate signs and the zone barrier force fields.
--
-- Prompt attributes:
--   Panel  = "<name>"  -> handled on the client (opens a UI panel)
--   Action = "<name>"  -> handled on the server by the owning service

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local MapLayout = require(Shared.MapLayout)
local Zones = require(Shared.Config.Zones)
local Tools = require(Shared.Config.Tools)
local ModelFactory = require(Shared.ModelFactory)
local Builder = ModelFactory.Builder

local HubBuilder = {}

local M = Enum.Material
local WHITE = Color3.fromRGB(236, 238, 242)
local GREY = Color3.fromRGB(150, 154, 162)
local DARK = Color3.fromRGB(40, 43, 52)
local ORANGE = Color3.fromRGB(255, 122, 26)
local BLUE = Color3.fromRGB(70, 140, 255)

HubBuilder.Stations = {} :: { [string]: Model }
HubBuilder.PlotModels = {} :: { [number]: Model }
HubBuilder.Boards = {} :: { [string]: SurfaceGui }

------------------------------------------------------------------ helpers

local function surfaceText(part: BasePart, text: string, color: Color3?, face: Enum.NormalId?, bg: Color3?): SurfaceGui
	local gui = Instance.new("SurfaceGui")
	gui.Face = face or Enum.NormalId.Front
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = 30
	gui.LightInfluence = 0
	gui.Brightness = 1.5
	gui.Parent = part
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = bg and 0 or 1
	label.BackgroundColor3 = bg or Color3.new()
	label.Text = text
	label.TextScaled = true
	label.Font = Enum.Font.BuilderSansExtraBold
	label.TextColor3 = color or WHITE
	label.Parent = gui
	local pad = Instance.new("UIPadding")
	pad.PaddingLeft = UDim.new(0.04, 0)
	pad.PaddingRight = UDim.new(0.04, 0)
	pad.PaddingTop = UDim.new(0.08, 0)
	pad.PaddingBottom = UDim.new(0.08, 0)
	pad.Parent = label
	return gui
end
HubBuilder.SurfaceText = surfaceText

local function prompt(part: BasePart, actionText: string, objectText: string, attrs: { [string]: any }, hold: number?): ProximityPrompt
	local p = Instance.new("ProximityPrompt")
	p.ActionText = actionText
	p.ObjectText = objectText
	p.HoldDuration = hold or 0
	p.MaxActivationDistance = 14
	p.RequiresLineOfSight = false
	p.KeyboardKeyCode = Enum.KeyCode.E
	for k, v in attrs do
		p:SetAttribute(k, v)
	end
	p.Parent = part
	return p
end
HubBuilder.Prompt = prompt

local function finish(b, name: string, cf: CFrame, primary: BasePart): Model
	local model = b:Finish(primary)
	model.Name = name
	model.ModelStreamingMode = Enum.ModelStreamingMode.Persistent
	model:PivotTo(cf)
	return model
end

------------------------------------------------------------------ stations

local STATION_BUILDERS = {}

STATION_BUILDERS.Exchange = function(b)
	local base = b:Box(Vector3.new(16, 1, 10), CFrame.new(0, 0.5, 0), GREY, M.DiamondPlate, "Base")
	b:Box(Vector3.new(14, 6, 7), CFrame.new(0, 4, 1), WHITE, M.SmoothPlastic, "Body")
	b:Neon(Vector3.new(14.1, 0.3, 7.1), CFrame.new(0, 2.2, 1), ORANGE, "Stripe")
	b:XCyl(2.5, 11, CFrame.new(0, 7.5, -0.5) * CFrame.Angles(0, math.rad(90), 0), ORANGE, M.SmoothPlastic, "Frame")
	b:XCyl(2.6, 8.6, CFrame.new(0, 7.5, -0.5) * CFrame.Angles(0, math.rad(90), 0), DARK, M.DiamondPlate, "Intake")
	b:Box(Vector3.new(7.6, 0.6, 0.2), CFrame.new(0, 7.5, -1.9), GREY, M.Metal, "Spin")
	b:Box(Vector3.new(0.6, 7.6, 0.2), CFrame.new(0, 7.5, -1.9), GREY, M.Metal, "Spin")
	local screen = b:Box(Vector3.new(4, 3, 0.3), CFrame.new(5.5, 4.5, -2.6), DARK, M.SmoothPlastic, "Screen")
	surfaceText(screen, "DEPOSIT\nDUST", ORANGE)
	local sign = b:Box(Vector3.new(14, 2.4, 0.4), CFrame.new(0, 14, 0), DARK, M.SmoothPlastic, "Sign")
	surfaceText(sign, "DUST EXCHANGE", ORANGE)
	local market = b:Box(Vector3.new(6, 6, 0.4), CFrame.new(-8.5, 5, -1), DARK, M.SmoothPlastic, "MarketBoard")
	local gui = surfaceText(market, "MARKET", WHITE)
	gui.Name = "MarketGui"
	local promptPart = b:Part({ Name = "PromptPart", Size = Vector3.new(2, 2, 2), CF = CFrame.new(0, 4, -3.5), Transparency = 1, CanCollide = false })
	prompt(promptPart, "Deposit Dust", "Dust Exchange", { Action = "Deposit" }, 0.25)
	return base
end

STATION_BUILDERS.SupplyWall = function(b)
	local base = b:Box(Vector3.new(24, 1, 8), CFrame.new(0, 0.5, 0), GREY, M.DiamondPlate, "Base")
	b:Box(Vector3.new(24, 13, 1.5), CFrame.new(0, 7.5, 3), WHITE, M.SmoothPlastic, "Wall")
	b:Neon(Vector3.new(24.1, 0.3, 1.6), CFrame.new(0, 13.8, 3), ORANGE, "Trim")
	for i, y in { 3.2, 7.2, 11.2 } do
		b:Box(Vector3.new(22, 0.3, 2.4), CFrame.new(0, y, 1.6), DARK, M.Metal, "Shelf" .. i)
	end
	local sign = b:Box(Vector3.new(16, 2.4, 0.4), CFrame.new(0, 16, 3), DARK, M.SmoothPlastic, "Sign")
	surfaceText(sign, "SUPPLY WALL", ORANGE)
	local promptPart = b:Part({ Name = "PromptPart", Size = Vector3.new(2, 2, 2), CF = CFrame.new(0, 4, -2), Transparency = 1, CanCollide = false })
	prompt(promptPart, "Browse Gear", "Supply Wall", { Panel = "Shop" })
	return base
end

STATION_BUILDERS.UpgradeTerminal = function(b)
	local base = b:Box(Vector3.new(16, 1, 9), CFrame.new(0, 0.5, 0), GREY, M.DiamondPlate, "Base")
	b:Box(Vector3.new(8, 3, 3), CFrame.new(0, 2.5, -1), WHITE, M.SmoothPlastic, "Desk")
	b:Neon(Vector3.new(6, 0.2, 2), CFrame.new(0, 4.1, -1.2), BLUE, "Keys")
	local screen = b:Box(Vector3.new(14, 7, 0.6), CFrame.new(0, 8, 3), DARK, M.SmoothPlastic, "Screen")
	surfaceText(screen, "UPGRADES", Color3.fromRGB(220, 235, 255), Enum.NormalId.Front, Color3.fromRGB(40, 70, 160))
	b:Box(Vector3.new(15, 8, 0.4), CFrame.new(0, 8, 3.5), WHITE, M.SmoothPlastic, "Frame")
	local promptPart = b:Part({ Name = "PromptPart", Size = Vector3.new(2, 2, 2), CF = CFrame.new(0, 3, -3), Transparency = 1, CanCollide = false })
	prompt(promptPart, "Open Terminal", "Upgrade Terminal", { Panel = "Upgrades" })
	return base
end

STATION_BUILDERS.RobotBay = function(b)
	local base = b:Box(Vector3.new(20, 1, 14), CFrame.new(0, 0.5, 0), GREY, M.DiamondPlate, "Base")
	b:Box(Vector3.new(20, 10, 1), CFrame.new(0, 6, 6.5), WHITE, M.SmoothPlastic, "Back")
	b:Box(Vector3.new(1, 10, 13), CFrame.new(-9.5, 6, 0), WHITE, M.SmoothPlastic, "Side")
	b:Box(Vector3.new(1, 10, 13), CFrame.new(9.5, 6, 0), WHITE, M.SmoothPlastic, "Side")
	b:Box(Vector3.new(20, 1, 14), CFrame.new(0, 11.5, 0), DARK, M.Metal, "Roof")
	b:Neon(Vector3.new(20.1, 0.3, 0.3), CFrame.new(0, 11, -6.9), ORANGE, "RoofLight")
	for _, x in { -5, 5 } do
		b:VCyl(0.4, 6, CFrame.new(x, 1.2, 1), DARK, M.DiamondPlate, "Pad")
		b:VCyl(0.1, 6.2, CFrame.new(x, 1.4, 1), Color3.fromRGB(80, 220, 255), M.Neon, "PadRing")
	end
	local sign = b:Box(Vector3.new(14, 2.4, 0.4), CFrame.new(0, 13.5, -6.5), DARK, M.SmoothPlastic, "Sign")
	surfaceText(sign, "ROBOT BAY", ORANGE)
	local promptPart = b:Part({ Name = "PromptPart", Size = Vector3.new(2, 2, 2), CF = CFrame.new(0, 3, -6), Transparency = 1, CanCollide = false })
	prompt(promptPart, "Manage Robots", "Robot Bay", { Panel = "Robots" })
	return base
end

STATION_BUILDERS.MissionBoard = function(b)
	local base = b:Box(Vector3.new(12, 1, 5), CFrame.new(0, 0.5, 0), GREY, M.DiamondPlate, "Base")
	for _, x in { -5, 5 } do
		b:Box(Vector3.new(0.8, 10, 0.8), CFrame.new(x, 5.5, 1), DARK, M.Metal, "Post")
	end
	local board = b:Box(Vector3.new(11, 7, 0.5), CFrame.new(0, 7, 1), Color3.fromRGB(30, 34, 42), M.SmoothPlastic, "Board")
	local gui = surfaceText(board, "MISSIONS\nDaily & Weekly", WHITE)
	gui.Name = "MissionGui"
	b:Neon(Vector3.new(11.2, 0.25, 0.6), CFrame.new(0, 10.6, 1), Color3.fromRGB(120, 220, 120), "Trim")
	local promptPart = b:Part({ Name = "PromptPart", Size = Vector3.new(2, 2, 2), CF = CFrame.new(0, 3, -1.5), Transparency = 1, CanCollide = false })
	prompt(promptPart, "View Missions", "Mission Board", { Panel = "Missions" })
	return base
end

STATION_BUILDERS.LaunchPad = function(b)
	local base = b:VCyl(1, 20, CFrame.new(0, 0.5, 0), DARK, M.Concrete, "Base")
	b:VCyl(0.12, 18, CFrame.new(0, 1.05, 0), Color3.fromRGB(90, 255, 220), M.Neon, "Ring")
	b:VCyl(9, 3.4, CFrame.new(0, 6, 3), WHITE, M.SmoothPlastic, "Rocket")
	b:Ball(3.4, CFrame.new(0, 10.6, 3), Color3.fromRGB(90, 255, 220), M.SmoothPlastic, "Nose")
	b:VCyl(0.5, 3.45, CFrame.new(0, 8, 3), DARK, M.SmoothPlastic, "Band")
	b:Box(Vector3.new(1.4, 15, 1.4), CFrame.new(6, 8, 3), GREY, M.DiamondPlate, "Gantry")
	local sign = b:Box(Vector3.new(12, 2.4, 0.4), CFrame.new(0, 17, 5), DARK, M.SmoothPlastic, "Sign")
	surfaceText(sign, "ORBITAL LAUNCH", Color3.fromRGB(90, 255, 220))
	local promptPart = b:Part({ Name = "PromptPart", Size = Vector3.new(2, 2, 2), CF = CFrame.new(0, 3, -2), Transparency = 1, CanCollide = false })
	prompt(promptPart, "Launch to Orbit", "Orbital Ring", { Action = "OrbitalLaunch" }, 0.6)
	return base
end

STATION_BUILDERS.RebirthPortal = function(b)
	local base = b:Box(Vector3.new(16, 1, 8), CFrame.new(0, 0.5, 0), DARK, M.DiamondPlate, "Base")
	local purple = Color3.fromRGB(180, 100, 255)
	for i = 0, 11 do
		local a = math.rad(i * 30)
		b:Box(Vector3.new(2.6, 1.2, 1.2), CFrame.new(6 * math.cos(a), 7.5 + 6 * math.sin(a), 1) * CFrame.Angles(0, 0, a + math.rad(90)), WHITE, M.SmoothPlastic, "RingSeg")
	end
	local disc = b:XCyl(0.3, 11.5, CFrame.new(0, 7.5, 1) * CFrame.Angles(0, math.rad(90), 0), purple, M.ForceField, "Spin")
	disc.CanCollide = false
	b:Light(disc, purple, 20, 2)
	local sign = b:Box(Vector3.new(12, 2.2, 0.4), CFrame.new(0, 15.5, 1), DARK, M.SmoothPlastic, "Sign")
	surfaceText(sign, "RE-LAUNCH PORTAL", purple)
	local promptPart = b:Part({ Name = "PromptPart", Size = Vector3.new(2, 2, 2), CF = CFrame.new(0, 3, -2), Transparency = 1, CanCollide = false })
	prompt(promptPart, "Re-Launch", "Prestige Portal", { Panel = "Rebirth" })
	return base
end

STATION_BUILDERS.Customizer = function(b)
	local base = b:VCyl(1, 12, CFrame.new(0, 0.5, 0), GREY, M.DiamondPlate, "Base")
	b:VCyl(9, 9, CFrame.new(0, 5.5, 0), Color3.fromRGB(180, 220, 255), M.Glass, "Pod").Transparency = 0.7
	b:Ball(9, CFrame.new(0, 10, 0), WHITE, M.SmoothPlastic, "Cap")
	b:VCyl(0.3, 9.2, CFrame.new(0, 1.3, 0), ORANGE, M.Neon, "Ring")
	-- mannequin astronaut
	b:Box(Vector3.new(2, 2.6, 1.2), CFrame.new(0, 4.4, 0), WHITE, M.SmoothPlastic, "Torso")
	b:Ball(2.2, CFrame.new(0, 6.6, 0), WHITE, M.SmoothPlastic, "Helmet")
	b:Ball(1.5, CFrame.new(0, 6.7, -0.5), Color3.fromRGB(255, 190, 60), M.Glass, "Visor")
	b:Box(Vector3.new(0.8, 2.2, 0.8), CFrame.new(-0.55, 2.1, 0), WHITE, M.SmoothPlastic, "Leg")
	b:Box(Vector3.new(0.8, 2.2, 0.8), CFrame.new(0.55, 2.1, 0), WHITE, M.SmoothPlastic, "Leg")
	local sign = b:Box(Vector3.new(10, 2, 0.4), CFrame.new(0, 15.5, 0), DARK, M.SmoothPlastic, "Sign")
	surfaceText(sign, "SUIT LOCKER", ORANGE)
	local promptPart = b:Part({ Name = "PromptPart", Size = Vector3.new(2, 2, 2), CF = CFrame.new(0, 3, -5), Transparency = 1, CanCollide = false })
	prompt(promptPart, "Customize Suit", "Suit Locker", { Panel = "Customize" })
	return base
end

STATION_BUILDERS.CrateDispenser = function(b)
	local base = b:Box(Vector3.new(14, 1, 7), CFrame.new(0, 0.5, 0), GREY, M.DiamondPlate, "Base")
	b:Box(Vector3.new(10, 12, 5), CFrame.new(0, 7, 1), Color3.fromRGB(60, 40, 90), M.SmoothPlastic, "Machine")
	b:Box(Vector3.new(8, 8, 0.3), CFrame.new(0, 8, -1.6), Color3.fromRGB(180, 200, 255), M.Glass, "Glass").Transparency = 0.5
	local colors = { Color3.fromRGB(255, 150, 50), Color3.fromRGB(170, 100, 255), Color3.fromRGB(80, 200, 255), Color3.fromRGB(255, 200, 80) }
	for i, c in colors do
		local row = (i - 1) // 2
		local col = (i - 1) % 2
		local crate = b:Box(Vector3.new(2.4, 2.4, 2.4), CFrame.new(-1.8 + col * 3.6, 6 + row * 3.6, 0) * CFrame.Angles(0, math.rad(20), 0), c, M.SmoothPlastic, "Crate")
		b:Light(crate, c, 6, 1)
	end
	b:Neon(Vector3.new(10.1, 0.3, 5.1), CFrame.new(0, 12.9, 1), Color3.fromRGB(200, 120, 255), "Trim")
	local sign = b:Box(Vector3.new(12, 2.2, 0.4), CFrame.new(0, 15, 1), DARK, M.SmoothPlastic, "Sign")
	surfaceText(sign, "COSMIC CRATES", Color3.fromRGB(200, 140, 255))
	local promptPart = b:Part({ Name = "PromptPart", Size = Vector3.new(2, 2, 2), CF = CFrame.new(0, 3, -3), Transparency = 1, CanCollide = false })
	prompt(promptPart, "Open Crates", "Crate Dispenser", { Panel = "Crates" })
	return base
end

STATION_BUILDERS.Leaderboards = function(b)
	local base = b:Box(Vector3.new(30, 1, 6), CFrame.new(0, 0.5, 0), GREY, M.DiamondPlate, "Base")
	local titles = { { "Kg", "TOP CLEANERS (kg)" }, { "Earned", "TOP EARNERS" }, { "Sectors", "SECTORS CLEARED" } }
	for i, t in titles do
		local x = (i - 2) * 10
		local board = b:Box(Vector3.new(9, 13, 0.6), CFrame.new(x, 8, 1.5), Color3.fromRGB(26, 29, 36), M.SmoothPlastic, "Board_" .. t[1])
		local gui = Instance.new("SurfaceGui")
		gui.Name = "BoardGui"
		gui.Face = Enum.NormalId.Front
		gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
		gui.PixelsPerStud = 40
		gui.LightInfluence = 0
		gui:SetAttribute("Title", t[2])
		gui:SetAttribute("Key", t[1])
		gui.Parent = board
		HubBuilder.Boards[t[1]] = gui
		b:Neon(Vector3.new(9.2, 0.3, 0.7), CFrame.new(x, 14.6, 1.5), ORANGE, "Trim")
	end
	local promptPart = b:Part({ Name = "PromptPart", Size = Vector3.new(2, 2, 2), CF = CFrame.new(0, 3, -2), Transparency = 1, CanCollide = false })
	prompt(promptPart, "View Rankings", "Leaderboards", { Panel = "Leaderboards" })
	return base
end

------------------------------------------------------------------ plaza & roads

local function buildPlaza(parent: Instance)
	local b = Builder.new("Plaza", true)
	b:VCyl(0.6, 168, CFrame.new(0, 0.3, 0), Color3.fromRGB(196, 200, 208), M.Concrete, "Floor")
	b:VCyl(0.1, 170, CFrame.new(0, 0.62, 0), ORANGE, M.Neon, "OuterRing").Transparency = 0.2
	b:VCyl(0.62, 164, CFrame.new(0, 0.32, 0), Color3.fromRGB(196, 200, 208), M.Concrete, "FloorInner")
	b:VCyl(0.1, 40, CFrame.new(0, 0.66, 0), BLUE, M.Neon, "InnerRing").Transparency = 0.3
	b:VCyl(0.64, 38, CFrame.new(0, 0.34, 0), Color3.fromRGB(210, 214, 222), M.Marble, "Centre")
	-- teleport console + event booth near spawn
	local console = b:VCyl(4, 2.6, CFrame.new(16, 2.6, 14), DARK, M.Metal, "Console")
	local globe = b:Ball(4, CFrame.new(16, 7, 14), Color3.fromRGB(90, 170, 255), M.ForceField, "Spin")
	globe.CanCollide = false
	b:Light(globe, Color3.fromRGB(90, 170, 255), 16, 1.5)
	prompt(console, "Fast Travel", "Moon Map", { Panel = "Map" })
	local booth = b:Box(Vector3.new(6, 4, 4), CFrame.new(-16, 2.6, 14), Color3.fromRGB(255, 160, 50), M.SmoothPlastic, "EventBooth")
	b:Part({ Name = "Awning", Shape = "Wedge", Size = Vector3.new(7, 1.6, 5), CF = CFrame.new(-16, 5.4, 14), Color = WHITE, Material = M.Fabric })
	local boothSign = b:Box(Vector3.new(6, 1.6, 0.3), CFrame.new(-16, 7, 11.6), DARK, M.SmoothPlastic, "BoothSign")
	local gui = surfaceText(boothSign, "EVENT", Color3.fromRGB(255, 200, 80))
	gui.Name = "EventGui"
	prompt(booth, "Seasonal Event", "Event Booth", { Panel = "Event" })
	-- community goal hologram
	local holo = b:Part({ Name = "GoalHolo", Shape = "Cylinder", Size = Vector3.new(0.3, 18, 18), CF = CFrame.new(0, 24, 0) * CFrame.Angles(0, 0, math.rad(90)), Color = Color3.fromRGB(90, 200, 255), Material = M.ForceField, CanCollide = false })
	local bb = Instance.new("BillboardGui")
	bb.Name = "GoalGui"
	bb.Size = UDim2.fromOffset(320, 90)
	bb.StudsOffset = Vector3.new(0, 4, 0)
	bb.AlwaysOnTop = false
	bb.MaxDistance = 220
	bb.LightInfluence = 0
	bb.Parent = holo
	local label = Instance.new("TextLabel")
	label.Name = "Text"
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Font = Enum.Font.BuilderSansExtraBold
	label.TextScaled = true
	label.TextColor3 = Color3.fromRGB(200, 240, 255)
	label.TextStrokeTransparency = 0.4
	label.Text = "COMMUNITY CLEAN-UP 0%"
	label.Parent = bb
	local model = b:Finish()
	model.ModelStreamingMode = Enum.ModelStreamingMode.Persistent
	model.Parent = parent
end

local function lampPost(b, pos: Vector3)
	b:Box(Vector3.new(0.5, 9, 0.5), CFrame.new(pos + Vector3.new(0, 4.5, 0)), GREY, M.Metal, "LampPole")
	local lamp = b:Neon(Vector3.new(1.4, 0.4, 1.4), CFrame.new(pos + Vector3.new(0, 9.1, 0)), Color3.fromRGB(255, 236, 200), "Lamp")
	b:Light(lamp, Color3.fromRGB(255, 230, 190), 30, 1.6)
end

local function buildRoads(parent: Instance)
	local b = Builder.new("Roads", true)
	for i = 0, 3 do
		local dir = CFrame.Angles(0, math.rad(i * 90), 0)
		local mid = dir * Vector3.new(0, 0, -168)
		b:Part({ Name = "Road", Size = Vector3.new(26, 0.4, 176), CF = CFrame.new(mid.X, 0.22, mid.Z) * dir, Color = Color3.fromRGB(70, 74, 84), Material = M.Asphalt })
		for _, side in { -1, 1 } do
			local edge = dir * Vector3.new(side * 13, 0, -168)
			b:Part({ Name = "RoadLine", Size = Vector3.new(0.5, 0.42, 176), CF = CFrame.new(edge.X, 0.24, edge.Z) * dir, Color = ORANGE, Material = M.Neon, CastShadow = false })
			for k = 0, 4 do
				local p = dir * Vector3.new(side * 16, 0, -96 - k * 36)
				lampPost(b, p)
			end
		end
		-- welcome arch at the hub exit
		local archPos = dir * Vector3.new(0, 0, -238)
		for _, side in { -1, 1 } do
			local post = dir * Vector3.new(side * 15, 0, -238)
			b:Part({ Name = "ArchPost", Size = Vector3.new(2, 16, 2), CF = CFrame.new(post.X, 8, post.Z) * dir, Color = WHITE, Material = M.SmoothPlastic })
		end
		local beam = b:Part({ Name = "ArchBeam", Size = Vector3.new(32, 3, 2), CF = CFrame.new(archPos.X, 17, archPos.Z) * dir, Color = DARK, Material = M.Metal })
		surfaceText(beam, "TRANQUILITY COLONY", ORANGE, Enum.NormalId.Back)
		surfaceText(beam, "WELCOME BACK, CLEANER", WHITE, Enum.NormalId.Front)
	end
	local model = b:Finish()
	model.Parent = parent
end

------------------------------------------------------------------ plots

local function buildPlots(parent: Instance)
	for index, p in MapLayout.Plots do
		local b = Builder.new("Plot" .. index, true)
		local size = MapLayout.PLOT_SIZE
		local pad = b:Box(Vector3.new(size, 1, size), CFrame.new(p.X, 0.5, p.Z), Color3.fromRGB(150, 156, 168), M.Concrete, "Pad")
		for _, s in { -1, 1 } do
			b:Neon(Vector3.new(size, 0.2, 0.5), CFrame.new(p.X, 1.02, p.Z + s * (size / 2 - 0.25)), Color3.fromRGB(120, 130, 150), "Border")
			b:Neon(Vector3.new(0.5, 0.2, size), CFrame.new(p.X + s * (size / 2 - 0.25), 1.02, p.Z), Color3.fromRGB(120, 130, 150), "Border")
		end
		-- sign facing the colony centre
		local toCentre = Vector3.new(-p.X, 0, -p.Z).Unit
		local signPos = Vector3.new(p.X, 0, p.Z) + toCentre * (size / 2 + 4)
		local post = b:Part({ Name = "SignPost", Size = Vector3.new(0.6, 7, 0.6), CF = CFrame.new(signPos + Vector3.new(0, 3.5, 0)), Color = GREY, Material = M.Metal })
		local bb = Instance.new("BillboardGui")
		bb.Name = "OwnerGui"
		bb.Size = UDim2.fromOffset(260, 70)
		bb.StudsOffset = Vector3.new(0, 5, 0)
		bb.MaxDistance = 260
		bb.LightInfluence = 0
		bb.Parent = post
		local label = Instance.new("TextLabel")
		label.Name = "Text"
		label.Size = UDim2.fromScale(1, 1)
		label.BackgroundColor3 = Color3.fromRGB(24, 27, 33)
		label.BackgroundTransparency = 0.25
		label.Font = Enum.Font.BuilderSansExtraBold
		label.TextScaled = true
		label.TextColor3 = WHITE
		label.Text = "FREE PLOT"
		label.Parent = bb
		local corner = Instance.new("UICorner")
		corner.CornerRadius = UDim.new(0, 10)
		corner.Parent = label
		local model = b:Finish(pad)
		model:SetAttribute("PlotIndex", index)
		model:SetAttribute("Owner", 0)
		model.Parent = parent
		HubBuilder.PlotModels[index] = model
	end
end

------------------------------------------------------------------ zone gates & barriers

-- 12 internal borders. Each: zones on both sides, centre of the pass, orientation.
function HubBuilder.Borders(): { any }
	local out = {}
	for gx = 0, 2 do
		for gz = 0, 2 do
			local a = MapLayout.ZoneGrid[gx .. "," .. gz]
			if gx < 2 then
				local b = MapLayout.ZoneGrid[(gx + 1) .. "," .. gz]
				local x = (gx + 1) * 512 - MapLayout.HALF
				local z = gz * 512 - MapLayout.HALF + 256
				table.insert(out, { A = a, B = b, X = x, Z = z, Axis = "X" })
			end
			if gz < 2 then
				local b = MapLayout.ZoneGrid[gx .. "," .. (gz + 1)]
				local x = gx * 512 - MapLayout.HALF + 256
				local z = (gz + 1) * 512 - MapLayout.HALF
				table.insert(out, { A = a, B = b, X = x, Z = z, Axis = "Z" })
			end
		end
	end
	return out
end

local function zoneIndex(id: string): number
	if id == "hub" then
		return 0
	end
	return Zones.ById[id].Index
end

local function buildBarriers(parent: Instance, heightAt: (number, number) -> number)
	local folder = Instance.new("Folder")
	folder.Name = "Barriers"
	folder.Parent = parent
	for _, border in HubBuilder.Borders() do
		local gated = zoneIndex(border.A) > zoneIndex(border.B) and border.A or border.B
		local zone = Zones.ById[gated]
		local wall = Instance.new("Part")
		wall.Name = "Barrier"
		wall.Anchored = true
		wall.CanCollide = false
		wall.CanQuery = false
		wall.CanTouch = false
		wall.CastShadow = false
		wall.Material = M.ForceField
		wall.Color = zone.Accent
		wall.Transparency = 0.15
		if border.Axis == "X" then
			wall.Size = Vector3.new(1.5, 420, 512)
		else
			wall.Size = Vector3.new(512, 420, 1.5)
		end
		wall.Position = Vector3.new(border.X, 90, border.Z)
		wall:SetAttribute("ZoneA", border.A)
		wall:SetAttribute("ZoneB", border.B)
		wall.Parent = folder

		-- unlock sign on the lower-tier side of the pass
		local lower = gated == border.A and border.B or border.A
		local lowerIdx = zoneIndex(lower)
		local gatedIdx = zoneIndex(gated)
		if gatedIdx == lowerIdx + 1 or lower == "hub" then
			local offset: Vector3
			if border.Axis == "X" then
				local side = (MapLayout.GridZoneAt(border.X - 10, border.Z) == lower) and -1 or 1
				offset = Vector3.new(side * 14, 0, 26)
			else
				local side = (MapLayout.GridZoneAt(border.X, border.Z - 10) == lower) and -1 or 1
				offset = Vector3.new(26, 0, side * 14)
			end
			local pos = Vector3.new(border.X, 0, border.Z) + offset
			local y = heightAt(pos.X, pos.Z)
			local b = Builder.new("Gate_" .. gated, true)
			b:Box(Vector3.new(1, 8, 1), CFrame.new(pos.X, y + 4, pos.Z), GREY, M.Metal, "Post")
			local panel = b:Box(Vector3.new(6, 3.4, 0.4), CFrame.lookAt(Vector3.new(pos.X, y + 8.5, pos.Z), Vector3.new(border.X, y + 8.5, border.Z)) * CFrame.Angles(0, math.rad(180), 0), Color3.fromRGB(26, 29, 36), M.SmoothPlastic, "Panel")
			local bb = Instance.new("BillboardGui")
			bb.Name = "GateGui"
			bb.Size = UDim2.fromOffset(280, 110)
			bb.StudsOffset = Vector3.new(0, 3.5, 0)
			bb.MaxDistance = 140
			bb.LightInfluence = 0
			bb.Parent = panel
			local label = Instance.new("TextLabel")
			label.Name = "Text"
			label.Size = UDim2.fromScale(1, 1)
			label.BackgroundColor3 = Color3.fromRGB(20, 22, 28)
			label.BackgroundTransparency = 0.2
			label.TextColor3 = zone.Accent
			label.Font = Enum.Font.BuilderSansExtraBold
			label.TextScaled = true
			label.Text = string.format("%s\nLevel %d  •  $%s", string.upper(zone.Name), zone.Level, tostring(zone.Cost))
			label.Parent = bb
			local c = Instance.new("UICorner")
			c.Parent = label
			prompt(panel, "Unlock Zone", zone.Name, { Action = "UnlockZone", ZoneId = zone.Id }, 0.4)
			local model = b:Finish()
			model.ModelStreamingMode = Enum.ModelStreamingMode.Persistent
			model.Parent = folder
		end
	end
	-- outer map walls
	for i = 0, 3 do
		local w = Instance.new("Part")
		w.Name = "WorldEdge"
		w.Anchored = true
		w.Transparency = 1
		w.CanQuery = false
		w.CastShadow = false
		local horizontal = i % 2 == 0
		w.Size = horizontal and Vector3.new(1600, 900, 4) or Vector3.new(4, 900, 1600)
		local s = (i < 2) and -1 or 1
		w.Position = horizontal and Vector3.new(0, 200, s * (MapLayout.HALF + 2)) or Vector3.new(s * (MapLayout.HALF + 2), 200, 0)
		w.Parent = folder
	end
end

------------------------------------------------------------------ entry

function HubBuilder.Build(heightAt: (number, number) -> number)
	local hub = Instance.new("Folder")
	hub.Name = "Hub"
	hub.Parent = Workspace

	buildPlaza(hub)
	buildRoads(hub)
	buildPlots(hub)

	for name in MapLayout.Stations do
		local builderFn = STATION_BUILDERS[name]
		if builderFn then
			local b = Builder.new(name, true)
			local base = builderFn(b)
			local _, cf = MapLayout.StationPosition(name)
			-- stations face the plaza centre (their -Z points inward)
			local model = finish(b, name, cf, base)
			model.Parent = hub
			HubBuilder.Stations[name] = model
		end
	end

	-- display tools on the supply wall shelves
	local wall = HubBuilder.Stations.SupplyWall
	if wall then
		local showcase = { "nail_brush", "household_broom", "wide_broom", "hand_vac", "canister_vac", "industrial_vac", "ion_brush", "plasma_vac", "gravity_rake" }
		for i, id in showcase do
			if Tools.ById[id] then
				local m = ModelFactory.ToolModel(id)
				local row = (i - 1) // 3
				local col = (i - 1) % 3
				local local_ = CFrame.new(-7 + col * 7, 4 + row * 4, 1.4) * CFrame.Angles(math.rad(-90), 0, math.rad(90))
				m:PivotTo(wall:GetPivot() * local_)
				for _, d in m:GetDescendants() do
					if d:IsA("BasePart") then
						d.Anchored = true
						d.CanCollide = false
					elseif d:IsA("ParticleEmitter") then
						d.Enabled = false
					end
				end
				m.Parent = wall
			end
		end
	end
	-- display robots in the bay
	local bay = HubBuilder.Stations.RobotBay
	if bay then
		for i, id in { "dustbot_mk2", "sweeper_drone" } do
			local m = ModelFactory.Robot(id, false)
			m:PivotTo(bay:GetPivot() * CFrame.new(i == 1 and -5 or 5, 3.5, 1))
			m.Parent = bay
		end
	end

	buildBarriers(hub, heightAt)
	return hub
end

return HubBuilder
