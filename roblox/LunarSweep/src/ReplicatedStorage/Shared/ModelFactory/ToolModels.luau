--!strict
-- Procedural models for the cleaning tools.
-- Tool space: origin = the hand grip, -Z = forward, +Y = up. The tool head sits on the
-- ground roughly 3.5 studs in front of and 4 studs below the hand (arm held forward).

local Builder = require(script.Parent.Builder)
local Config = script.Parent.Parent.Config
local Tools = require(Config.Tools)
local Rarity = require(Config.Rarity)

local M = Enum.Material

local ToolModels = {}

local HEAD = Vector3.new(0, -3.9, -3.4)
local TOP = Vector3.new(0, 0.9, 0.8)

local function headWidth(def: Tools.ToolDef): number
	return math.clamp(def.Width * 0.22 + 0.6, 0.8, 5.2)
end

local function addHeadFx(b: Builder.BuilderObj, head: BasePart, def: Tools.ToolDef)
	local att = b:Attachment(head, "HeadFX", CFrame.new(0, -0.3, 0))
	local dust = Instance.new("ParticleEmitter")
	dust.Name = "SweepDust"
	dust.Texture = "rbxasset://textures/particles/smoke_main.dds"
	dust.Color = ColorSequence.new(Color3.fromRGB(200, 196, 188))
	dust.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.6), NumberSequenceKeypoint.new(1, 2.2) })
	dust.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.55), NumberSequenceKeypoint.new(1, 1) })
	dust.Lifetime = NumberRange.new(0.5, 1.1)
	dust.Speed = NumberRange.new(1.5, 4)
	dust.SpreadAngle = Vector2.new(70, 70)
	dust.Acceleration = Vector3.new(0, 1.5, 0)
	dust.Rate = 28
	dust.Enabled = false
	dust.Parent = att
	local rar = Rarity.Get(def.Rarity)
	if rar.Order >= 4 then
		b:Light(head, def.Colors[3], 8, 1.4)
		b:Sparkles(head, rar.Glow, 6, 0.35)
	end
end

local function shaft(b: Builder.BuilderObj, def: Tools.ToolDef, headPos: Vector3, thickness: number)
	local c1, c3 = def.Colors[1], def.Colors[3]
	local dir = (headPos - TOP).Unit
	b:Tube(TOP, headPos - dir * 0.35, thickness, c1, M.SmoothPlastic, "Shaft")
	-- grip wraps + accent band
	b:Tube(TOP + dir * 0.4, TOP + dir * 1.6, thickness + 0.12, Color3.fromRGB(40, 40, 46), M.Fabric, "Wrap")
	b:Tube(TOP + dir * 2.4, TOP + dir * 2.65, thickness + 0.16, c3, M.Neon, "Band")
	b:Ball(thickness + 0.15, CFrame.new(TOP), c3, M.SmoothPlastic, "Cap")
end

local function buildBrush(b: Builder.BuilderObj, def: Tools.ToolDef): BasePart
	local c1, c2, c3 = def.Colors[1], def.Colors[2], def.Colors[3]
	shaft(b, def, HEAD + Vector3.new(0, 0.35, 0), 0.32)
	local w = headWidth(def)
	local head = b:Box(Vector3.new(w, 0.45, 1.1), CFrame.new(HEAD + Vector3.new(0, 0.35, 0)), c1, M.SmoothPlastic, "Head")
	b:Box(Vector3.new(w - 0.1, 0.5, 0.9), CFrame.new(HEAD + Vector3.new(0, -0.1, 0)), c2, M.Fabric, "Bristles")
	b:Box(Vector3.new(w + 0.05, 0.12, 1.15), CFrame.new(HEAD + Vector3.new(0, 0.62, 0)), c3, M.SmoothPlastic, "Trim")
	return head
end

local function buildBroom(b: Builder.BuilderObj, def: Tools.ToolDef): BasePart
	local c2, c3 = def.Colors[2], def.Colors[3]
	shaft(b, def, HEAD + Vector3.new(0, 0.9, 0), 0.3)
	local w = headWidth(def)
	local head = b:Box(Vector3.new(w * 0.5, 0.5, 0.6), CFrame.new(HEAD + Vector3.new(0, 0.9, 0)), c3, M.SmoothPlastic, "Head")
	-- flared bristle fan made of wedges
	b:Part({ Name = "Fan", Shape = "Wedge", Size = Vector3.new(w, 1.1, 0.7), CF = CFrame.new(HEAD + Vector3.new(0, 0.15, 0)) * CFrame.Angles(0, 0, 0), Color = c2, Material = M.Fabric })
	b:Box(Vector3.new(w, 0.35, 0.8), CFrame.new(HEAD + Vector3.new(0, -0.3, 0)), c2, M.Fabric, "Bristles")
	b:Box(Vector3.new(w * 0.52, 0.12, 0.65), CFrame.new(HEAD + Vector3.new(0, 1.2, 0)), Color3.fromRGB(50, 50, 56), M.Metal, "Clamp")
	return head
end

local function buildPushBroom(b: Builder.BuilderObj, def: Tools.ToolDef): BasePart
	local c1, c2, c3 = def.Colors[1], def.Colors[2], def.Colors[3]
	shaft(b, def, HEAD + Vector3.new(0, 0.5, 0.2), 0.3)
	local w = headWidth(def)
	local head = b:Box(Vector3.new(w, 0.55, 0.75), CFrame.new(HEAD + Vector3.new(0, 0.35, 0)), c1, M.SmoothPlastic, "Head")
	b:Box(Vector3.new(w - 0.1, 0.45, 0.6), CFrame.new(HEAD + Vector3.new(0, -0.12, 0)), c2, M.Fabric, "Bristles")
	b:Neon(Vector3.new(w + 0.04, 0.1, 0.08), CFrame.new(HEAD + Vector3.new(0, 0.5, -0.4)), c3, "Strip")
	-- two brace struts from shaft to head ends
	local brace = HEAD + Vector3.new(0, 1.6, 0.9)
	b:Rod(brace, HEAD + Vector3.new(w * 0.3, 0.6, 0), 0.14, Color3.fromRGB(60, 60, 66), M.Metal, "Brace")
	b:Rod(brace, HEAD + Vector3.new(-w * 0.3, 0.6, 0), 0.14, Color3.fromRGB(60, 60, 66), M.Metal, "Brace")
	b:XCyl(0.3, 0.42, CFrame.new(HEAD + Vector3.new(w / 2 + 0.1, 0.35, 0)), c3, M.SmoothPlastic, "EndCap")
	b:XCyl(0.3, 0.42, CFrame.new(HEAD + Vector3.new(-w / 2 - 0.1, 0.35, 0)), c3, M.SmoothPlastic, "EndCap")
	return head
end

local function buildVacuum(b: Builder.BuilderObj, def: Tools.ToolDef, canister: boolean): BasePart
	local c1, c2, c3 = def.Colors[1], def.Colors[2], def.Colors[3]
	-- motor body around the hand
	b:Box(Vector3.new(0.9, 1.1, 1.8), CFrame.new(0, 0.1, -0.3), c1, M.SmoothPlastic, "Body")
	b:ZCyl(0.4, 1.0, CFrame.new(0, 0.15, 0.55), c2, M.SmoothPlastic, "Motor")
	b:Neon(Vector3.new(0.95, 0.12, 1.2), CFrame.new(0, 0.62, -0.3), c3, "Indicator")
	b:Box(Vector3.new(0.35, 0.8, 0.35), CFrame.new(0, -0.6, 0.2), Color3.fromRGB(40, 40, 46), M.Fabric, "Grip")
	if canister then
		b:ZCyl(1.4, 0.9, CFrame.new(0, 0.95, 0.1), c2, M.Metal, "Tank")
		b:ZCyl(0.2, 0.95, CFrame.new(0, 0.95, -0.55), c3, M.Neon, "TankRing")
	end
	local nozzleStart = Vector3.new(0, -0.2, -1.2)
	local nozzleEnd = HEAD + Vector3.new(0, 0.45, -0.1)
	b:Tube(nozzleStart, nozzleEnd, 0.42, Color3.fromRGB(70, 72, 80), M.Metal, "Tube")
	b:Tube(nozzleStart + (nozzleEnd - nozzleStart) * 0.45, nozzleStart + (nozzleEnd - nozzleStart) * 0.5, 0.52, c3, M.Neon, "TubeRing")
	local w = headWidth(def)
	local head = b:Box(Vector3.new(w, 0.45, 1.0), CFrame.new(HEAD + Vector3.new(0, 0.2, -0.1)), c2, M.SmoothPlastic, "Head")
	b:Neon(Vector3.new(w - 0.2, 0.08, 0.6), CFrame.new(HEAD + Vector3.new(0, -0.05, -0.1)), c3, "Intake")
	return head
end

local function buildWand(b: Builder.BuilderObj, def: Tools.ToolDef): BasePart
	local c1, c2, c3 = def.Colors[1], def.Colors[2], def.Colors[3]
	local tip = Vector3.new(0, -2.2, -4.4)
	b:Tube(Vector3.new(0, 0.3, 0.6), tip, 0.28, c1, M.SmoothPlastic, "Rod")
	b:Ball(0.5, CFrame.new(0, 0.3, 0.6), c3, M.Neon, "Pommel")
	local orb = b:Ball(0.9, CFrame.new(tip), c2, M.Neon, "Orb")
	local dir = (tip - Vector3.new(0, 0.3, 0.6)).Unit
	for i = 1, 3 do
		local p = tip - dir * (0.5 + i * 0.45)
		b:Part({ Name = "Ring", Shape = "Cylinder", Size = Vector3.new(0.12, 0.5 + i * 0.18, 0.5 + i * 0.18), CF = CFrame.lookAt(p, p + dir) * CFrame.Angles(0, math.rad(90), 0), Color = c3, Material = M.Neon, CastShadow = false })
	end
	-- the "head" for wands is an invisible marker on the ground in front of the orb
	local head = b:Part({ Name = "Head", Size = Vector3.new(0.4, 0.2, 0.4), CF = CFrame.new(HEAD + Vector3.new(0, 0.1, -1)), Transparency = 1, CanCollide = false })
	b:Light(orb, c2, 10, 2)
	local beam = Instance.new("Beam")
	local a0 = b:Attachment(orb, "BeamA")
	local a1 = b:Attachment(head, "BeamB")
	beam.Attachment0 = a0
	beam.Attachment1 = a1
	beam.Color = ColorSequence.new(c2, c3)
	beam.LightEmission = 1
	beam.Width0 = 0.5
	beam.Width1 = 2.5
	beam.Transparency = NumberSequence.new(0.4, 0.9)
	beam.FaceCamera = true
	beam.Enabled = false
	beam.Name = "SweepBeam"
	beam.Parent = orb
	return head
end

local function buildRake(b: Builder.BuilderObj, def: Tools.ToolDef): BasePart
	local c2, c3 = def.Colors[2], def.Colors[3]
	shaft(b, def, HEAD + Vector3.new(0, 0.9, 0.1), 0.3)
	local w = headWidth(def)
	local head = b:Box(Vector3.new(w, 0.3, 0.35), CFrame.new(HEAD + Vector3.new(0, 0.9, 0)), c2, M.Metal, "Head")
	local n = math.clamp(math.floor(w / 0.45), 4, 11)
	for i = 0, n - 1 do
		local x = -w / 2 + 0.2 + i * ((w - 0.4) / math.max(1, n - 1))
		b:Box(Vector3.new(0.12, 0.95, 0.12), CFrame.new(HEAD + Vector3.new(x, 0.35, -0.12)) * CFrame.Angles(math.rad(-15), 0, 0), c2, M.Metal, "Tine")
	end
	b:Neon(Vector3.new(w, 0.08, 0.38), CFrame.new(HEAD + Vector3.new(0, 1.07, 0)), c3, "Glow")
	return head
end

local function buildPlasma(b: Builder.BuilderObj, def: Tools.ToolDef): BasePart
	local c1, c2, c3 = def.Colors[1], def.Colors[2], def.Colors[3]
	b:Box(Vector3.new(1.0, 1.2, 2.2), CFrame.new(0, 0.2, -0.4), c1, M.Metal, "Body")
	b:Box(Vector3.new(0.4, 0.9, 0.4), CFrame.new(0, -0.55, 0.3), Color3.fromRGB(30, 30, 36), M.Fabric, "Grip")
	b:Ball(1.0, CFrame.new(0, 0.85, 0.2), c2, M.Neon, "Core")
	for i = 1, 3 do
		b:Part({ Name = "Coil", Shape = "Cylinder", Size = Vector3.new(0.18, 1.35, 1.35), CF = CFrame.new(0, 0.2, -0.2 - i * 0.45) * CFrame.Angles(0, math.rad(90), 0), Color = c3, Material = M.Neon, CastShadow = false })
	end
	local nozzleStart = Vector3.new(0, 0, -1.5)
	local nozzleEnd = HEAD + Vector3.new(0, 0.6, -0.1)
	b:Tube(nozzleStart, nozzleEnd, 0.5, c1, M.Metal, "Barrel")
	b:Tube(nozzleStart + (nozzleEnd - nozzleStart) * 0.3, nozzleStart + (nozzleEnd - nozzleStart) * 0.36, 0.62, c2, M.Neon, "BarrelRing")
	local w = headWidth(def)
	local head = b:Box(Vector3.new(w, 0.4, 1.1), CFrame.new(HEAD + Vector3.new(0, 0.3, -0.1)), c1, M.Metal, "Head")
	b:Neon(Vector3.new(w - 0.2, 0.1, 0.8), CFrame.new(HEAD + Vector3.new(0, 0.08, -0.1)), c2, "Intake")
	return head
end

local BUILDERS: { [string]: (Builder.BuilderObj, Tools.ToolDef) -> BasePart } = {
	brush = buildBrush,
	broom = buildBroom,
	pushbroom = buildPushBroom,
	vacuum = function(b, d)
		return buildVacuum(b, d, false)
	end,
	canister = function(b, d)
		return buildVacuum(b, d, true)
	end,
	wand = buildWand,
	rake = buildRake,
	plasma = buildPlasma,
}

-- Anchored display model (shop / viewport)
function ToolModels.Model(toolId: string): Model
	local def = Tools.ById[toolId] or Tools.ById.toothbrush
	local b = Builder.new(def.Name, false)
	local grip = b:ZCyl(0.6, 0.38, CFrame.new(), Color3.fromRGB(40, 40, 46), M.Fabric, "Handle")
	local buildFn: (Builder.BuilderObj, Tools.ToolDef) -> BasePart = BUILDERS[def.Kind] or buildBrush
	local head = buildFn(b, def)
	addHeadFx(b, head, def)
	b.Model:SetAttribute("ToolId", def.Id)
	return b:Finish(grip)
end

-- Equippable Tool instance (parts welded to Handle)
function ToolModels.Tool(toolId: string): Tool
	local def = Tools.ById[toolId] or Tools.ById.toothbrush
	local model = ToolModels.Model(def.Id)
	local tool = Instance.new("Tool")
	tool.Name = def.Name
	tool.CanBeDropped = false
	tool.RequiresHandle = true
	tool.ToolTip = def.Rarity .. " - width " .. def.Width
	tool.Grip = CFrame.new()
	tool:SetAttribute("ToolId", def.Id)
	tool:SetAttribute("CleaningTool", true)
	local handle = model.PrimaryPart :: BasePart
	for _, child in model:GetChildren() do
		child.Parent = tool
	end
	model:Destroy()
	Builder.WeldAll(tool, handle, true)
	Builder.SetCollide(tool, false, false)
	handle.Name = "Handle"
	return tool
end

return ToolModels
