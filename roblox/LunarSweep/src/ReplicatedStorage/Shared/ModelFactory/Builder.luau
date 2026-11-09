--!strict
-- Tiny declarative helper for assembling multi-part models from code.
-- All positions are given relative to the model origin; Finish() returns the Model.

export type PartSpec = {
	Name: string?,
	Size: Vector3,
	CF: CFrame?,
	Color: Color3?,
	Material: Enum.Material?,
	Shape: string?, -- "Block" | "Ball" | "Cylinder" | "Wedge" | "CornerWedge"
	Transparency: number?,
	Reflectance: number?,
	CanCollide: boolean?,
	CastShadow: boolean?,
}

local Builder = {}
Builder.__index = Builder

export type BuilderObj = typeof(setmetatable(
	{} :: { Model: Model, Origin: CFrame, Collide: boolean },
	Builder
))

function Builder.new(name: string, collide: boolean?): BuilderObj
	local m = Instance.new("Model")
	m.Name = name
	return setmetatable({ Model = m, Origin = CFrame.new(), Collide = collide ~= false }, Builder)
end

function Builder.Part(self: BuilderObj, spec: PartSpec): BasePart
	local p: BasePart
	local shape = spec.Shape or "Block"
	if shape == "Wedge" then
		p = Instance.new("WedgePart")
	elseif shape == "CornerWedge" then
		p = Instance.new("CornerWedgePart")
	else
		local part = Instance.new("Part")
		if shape == "Ball" then
			part.Shape = Enum.PartType.Ball
		elseif shape == "Cylinder" then
			part.Shape = Enum.PartType.Cylinder
		end
		p = part
	end
	p.Name = spec.Name or "Part"
	p.Size = spec.Size
	p.CFrame = self.Origin * (spec.CF or CFrame.new())
	p.Color = spec.Color or Color3.fromRGB(230, 230, 235)
	p.Material = spec.Material or Enum.Material.SmoothPlastic
	p.Transparency = spec.Transparency or 0
	p.Reflectance = spec.Reflectance or 0
	p.Anchored = true
	p.CanCollide = if spec.CanCollide ~= nil then spec.CanCollide else self.Collide
	p.CastShadow = if spec.CastShadow ~= nil then spec.CastShadow else true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = self.Model
	return p
end

-- block helper: (size, position offset, color, material)
function Builder.Box(self: BuilderObj, size: Vector3, cf: CFrame, color: Color3, material: Enum.Material?, name: string?): BasePart
	return self:Part({ Name = name, Size = size, CF = cf, Color = color, Material = material })
end

-- cylinder whose axis is vertical (Roblox cylinders run along local X)
function Builder.VCyl(self: BuilderObj, height: number, diameter: number, cf: CFrame, color: Color3, material: Enum.Material?, name: string?): BasePart
	return self:Part({
		Name = name,
		Shape = "Cylinder",
		Size = Vector3.new(height, diameter, diameter),
		CF = cf * CFrame.Angles(0, 0, math.rad(90)),
		Color = color,
		Material = material,
	})
end

-- cylinder along the local Z axis (forward)
function Builder.ZCyl(self: BuilderObj, length: number, diameter: number, cf: CFrame, color: Color3, material: Enum.Material?, name: string?): BasePart
	return self:Part({
		Name = name,
		Shape = "Cylinder",
		Size = Vector3.new(length, diameter, diameter),
		CF = cf * CFrame.Angles(0, math.rad(90), 0),
		Color = color,
		Material = material,
	})
end

-- cylinder along local X
function Builder.XCyl(self: BuilderObj, length: number, diameter: number, cf: CFrame, color: Color3, material: Enum.Material?, name: string?): BasePart
	return self:Part({ Name = name, Shape = "Cylinder", Size = Vector3.new(length, diameter, diameter), CF = cf, Color = color, Material = material })
end

function Builder.Ball(self: BuilderObj, diameter: number, cf: CFrame, color: Color3, material: Enum.Material?, name: string?): BasePart
	return self:Part({ Name = name, Shape = "Ball", Size = Vector3.new(diameter, diameter, diameter), CF = cf, Color = color, Material = material })
end

-- a rod between two points (rectangular cross-section)
function Builder.Rod(self: BuilderObj, a: Vector3, b: Vector3, thickness: number, color: Color3, material: Enum.Material?, name: string?): BasePart
	local mid = (a + b) / 2
	local len = (b - a).Magnitude
	return self:Part({
		Name = name,
		Size = Vector3.new(thickness, thickness, math.max(len, 0.05)),
		CF = CFrame.lookAt(mid, b),
		Color = color,
		Material = material,
	})
end

-- a round tube between two points
function Builder.Tube(self: BuilderObj, a: Vector3, b: Vector3, diameter: number, color: Color3, material: Enum.Material?, name: string?): BasePart
	local mid = (a + b) / 2
	local len = (b - a).Magnitude
	return self:Part({
		Name = name,
		Shape = "Cylinder",
		Size = Vector3.new(math.max(len, 0.05), diameter, diameter),
		CF = CFrame.lookAt(mid, b) * CFrame.Angles(0, math.rad(90), 0),
		Color = color,
		Material = material,
	})
end

function Builder.Neon(self: BuilderObj, size: Vector3, cf: CFrame, color: Color3, name: string?): BasePart
	return self:Part({ Name = name or "Neon", Size = size, CF = cf, Color = color, Material = Enum.Material.Neon, CastShadow = false })
end

function Builder.Light(_self: BuilderObj, parent: Instance, color: Color3, range: number, brightness: number, kind: string?): Light
	local l: Light
	if kind == "Spot" then
		local s = Instance.new("SpotLight")
		s.Range = range
		s.Angle = 70
		s.Face = Enum.NormalId.Front
		l = s
	else
		local pl = Instance.new("PointLight")
		pl.Range = range
		l = pl
	end
	l.Color = color
	l.Brightness = brightness
	l.Shadows = false
	l.Parent = parent
	return l
end

function Builder.Sparkles(_self: BuilderObj, parent: Instance, color: Color3, rate: number?, size: number?): ParticleEmitter
	local e = Instance.new("ParticleEmitter")
	e.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	e.Color = ColorSequence.new(color)
	e.LightEmission = 1
	e.Rate = rate or 4
	e.Lifetime = NumberRange.new(0.8, 1.6)
	e.Speed = NumberRange.new(0.5, 1.5)
	e.SpreadAngle = Vector2.new(180, 180)
	e.Size = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0),
		NumberSequenceKeypoint.new(0.3, size or 0.5),
		NumberSequenceKeypoint.new(1, 0),
	})
	e.Transparency = NumberSequence.new(0.2)
	e.Parent = parent
	return e
end

function Builder.Attachment(_self: BuilderObj, parent: BasePart, name: string, cf: CFrame?): Attachment
	local a = Instance.new("Attachment")
	a.Name = name
	a.CFrame = cf or CFrame.new()
	a.Parent = parent
	return a
end

function Builder.Finish(self: BuilderObj, primary: BasePart?): Model
	if primary then
		self.Model.PrimaryPart = primary
	end
	return self.Model
end

------------------------------------------------------------------ assembly helpers

-- Unanchor every part and weld it to `root` (for tools, worn gear and physics robots)
function Builder.WeldAll(model: Instance, root: BasePart, massless: boolean?)
	for _, d in model:GetDescendants() do
		if d:IsA("BasePart") and d ~= root then
			local w = Instance.new("WeldConstraint")
			w.Part0 = root
			w.Part1 = d
			w.Parent = d
			d.Anchored = false
			if massless then
				d.Massless = true
			end
		end
	end
	root.Anchored = false
end

function Builder.SetCollide(model: Instance, collide: boolean, query: boolean?)
	for _, d in model:GetDescendants() do
		if d:IsA("BasePart") then
			d.CanCollide = collide
			d.CanTouch = collide
			if query ~= nil then
				d.CanQuery = query
			end
		end
	end
end

function Builder.SetShadows(model: Instance, cast: boolean)
	for _, d in model:GetDescendants() do
		if d:IsA("BasePart") then
			d.CastShadow = cast
		end
	end
end

-- Bounding box of a model in its own space, ignoring rotation (used to fit viewports)
function Builder.Extents(model: Model): (CFrame, Vector3)
	return model:GetBoundingBox()
end

return Builder
