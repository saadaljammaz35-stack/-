--!nonstrict
-- Base build mode - build anywhere on the moon (no plots). Place mode shows a ghost of the
-- building snapped to the world's 4-stud grid (green = valid, red = blocked); R rotates;
-- click / PLACE confirms. 1x1 pieces (conveyors, foundation tiles) can be dragged in a
-- straight line. Edit mode lets you click your buildings to upgrade or remove them.
-- Esc / X exits. The server re-validates everything (BaseService:CanPlace).

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local MapLayout = require(Shared.MapLayout)
local Buildings = require(Shared.Config.Buildings)
local Zones = require(Shared.Config.Zones)
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local ModelFactory = require(Shared.ModelFactory)

local Lib = require(script.Parent.Parent.UI.Lib)
local Theme = require(script.Parent.Parent.UI.Theme)

local player = Players.LocalPlayer
local C = Theme.Colors
local N = MapLayout.N
local MAX_LINE = 40
local MAX_RANGE = 220 -- how far from your character you can place

local BuildController = {}
BuildController.Active = false

local ctx
local mode: string? = nil -- "place" | "edit"
local buildingId: string? = nil
local rotation = 0
local ghost: Model? = nil
local highlight: Highlight? = nil
local valid = false
local reason = ""
local cellX, cellZ, groundY = 0, 0, 0
local dragStart: { X: number, Z: number }? = nil
local lineGhosts: { BasePart } = {}
local bar: Frame
local infoLabel: TextLabel
local selectBox: SelectionBox
local selectedUid: number? = nil
local renderConn: RBXScriptConnection? = nil

local function footprint(def, r: number): (number, number)
	if r % 2 == 1 then
		return def.D, def.W
	end
	return def.W, def.D
end

local function isLine(id: string?): boolean
	local def = id and Buildings.ById[id]
	return def ~= nil and def.W == 1 and def.D == 1 and (def.Category == "Structures" or id == "conveyor")
end

-- linear world cell -> building uid, from the replicated profile
local function occupied(): { [number]: number }
	local occ = {}
	local profile = ctx.Data.Profile
	for _, b in profile.Base.Buildings do
		local def = Buildings.ById[b.Id]
		if def then
			local w, d = footprint(def, b.R or 0)
			for dx = 0, w - 1 do
				for dz = 0, d - 1 do
					occ[(b.Z + dz) * N + (b.X + dx)] = b.Uid
				end
			end
		end
	end
	return occ
end

local function aimRay(): Ray
	local cam = Workspace.CurrentCamera
	local pos
	local firstPerson = ctx.Camera and ctx.Camera.IsFirstPerson and ctx.Camera:IsFirstPerson()
	if firstPerson or (UserInputService.TouchEnabled and not UserInputService.MouseEnabled) then
		local v = cam.ViewportSize
		pos = Vector2.new(v.X / 2, v.Y / 2)
	else
		pos = UserInputService:GetMouseLocation()
	end
	return cam:ViewportPointToRay(pos.X, pos.Y)
end

local function aimPoint(): (Vector3?, Instance?)
	local ray = aimRay()
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	local ignore = { player.Character, ghost }
	for _, g in lineGhosts do
		table.insert(ignore, g)
	end
	for _, n in { "LocalFX", "SkyDome", "SectorLines", "Pickups", "Capsules", "Robots" } do
		local f = Workspace:FindFirstChild(n)
		if f then
			table.insert(ignore, f)
		end
	end
	params.FilterDescendantsInstances = ignore
	local hit = Workspace:Raycast(ray.Origin, ray.Direction * 700, params)
	return hit and hit.Position or nil, hit and hit.Instance or nil
end

local function clearLine()
	for _, g in lineGhosts do
		g:Destroy()
	end
	table.clear(lineGhosts)
end

local function clearGhost()
	if ghost then
		ghost:Destroy()
		ghost = nil
	end
	highlight = nil
	clearLine()
end

local function makeGhost(id: string)
	clearGhost()
	local m = ModelFactory.Building(id, 1)
	for _, d in m:GetDescendants() do
		if d:IsA("BasePart") then
			d.CanCollide = false
			d.CanQuery = false
			d.CanTouch = false
			d.CastShadow = false
			d.Anchored = true
			d.Transparency = math.max(d.Transparency, 0.45)
		elseif d:IsA("Light") or d:IsA("ParticleEmitter") or d:IsA("ProximityPrompt") then
			d:Destroy()
		end
	end
	local h = Instance.new("Highlight")
	h.FillTransparency = 0.6
	h.OutlineTransparency = 0
	h.Parent = m
	m.Parent = Workspace
	ghost = m
	highlight = h
end

-- client-side mirror of the server checks (for the ghost colour only)
local function checkFootprint(gx: number, gz: number, w: number, d: number, y: number, occ): (boolean, string)
	local profile = ctx.Data.Profile
	if gx < 1 or gz < 1 or gx + w > N - 1 or gz + d > N - 1 then
		return false, "Outside the map"
	end
	for dx = 0, w - 1 do
		for dz = 0, d - 1 do
			local cx, cz = MapLayout.CellCenter(gx + dx, gz + dz)
			if not MapLayout.CanBuildAt(cx, cz) then
				return false, "No building in the colony core or on roads"
			end
			local zoneId = MapLayout.ZoneAt(Vector3.new(cx, y, cz))
			if zoneId ~= "hub" and Zones.ById[zoneId] and not profile.Zones[zoneId] then
				return false, "Unlock this zone first"
			end
			if occ[(gz + dz) * N + gx + dx] then
				return false, "Something is in the way"
			end
		end
	end
	return true, ""
end

local function lineCells(x0: number, z0: number, x1: number, z1: number): { { number } }
	local cells = {}
	local dx, dz = x1 - x0, z1 - z0
	if math.abs(dx) >= math.abs(dz) then
		local s = dx >= 0 and 1 or -1
		for i = 0, math.min(math.abs(dx), MAX_LINE - 1) do
			table.insert(cells, { x0 + i * s, z0 })
		end
	else
		local s = dz >= 0 and 1 or -1
		for i = 0, math.min(math.abs(dz), MAX_LINE - 1) do
			table.insert(cells, { x0, z0 + i * s })
		end
	end
	return cells
end

local function updateInfo()
	local profile = ctx.Data.Profile
	if mode == "place" and buildingId then
		local def = Buildings.ById[buildingId]
		local hint = UserInputService.TouchEnabled and "PLACE to build" or (isLine(buildingId) and "Click or drag to build" or "Click to build")
		local text = string.format("%s %s  •  %s  •  R rotate  •  %s", def.Icon, def.Name, Format.Credits(Formulas.BuildingCost(buildingId, profile)), hint)
		if not valid and reason ~= "" then
			text ..= "  •  ⚠ " .. reason
		end
		infoLabel.Text = text
	elseif mode == "edit" then
		if selectedUid then
			infoLabel.Text = "Selected building - use Upgrade or Remove"
		else
			infoLabel.Text = "Edit mode: click one of your buildings"
		end
	end
end

local lastInfo = 0
local function step()
	if mode ~= "place" or not buildingId or not ghost then
		return
	end
	local def = Buildings.ById[buildingId]
	local w, d = footprint(def, rotation)
	local p = aimPoint()
	local hrp = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if not p then
		return
	end
	local gx, gz = MapLayout.FootprintCell(p.X, p.Z, w, d)
	cellX, cellZ, groundY = gx, gz, p.Y
	local occ = occupied()
	local ok, why = checkFootprint(gx, gz, w, d, p.Y, occ)
	if ok and hrp and (Vector3.new(p.X, 0, p.Z) - Vector3.new(hrp.Position.X, 0, hrp.Position.Z)).Magnitude > MAX_RANGE then
		ok, why = false, "Too far away"
	end
	valid, reason = ok, why
	local cx, cz = MapLayout.FootprintCenter(gx, gz, w, d)
	ghost:PivotTo(CFrame.new(cx, p.Y, cz) * CFrame.Angles(0, math.rad(90 * rotation), 0))
	if highlight then
		highlight.FillColor = valid and Color3.fromRGB(80, 255, 120) or Color3.fromRGB(255, 70, 70)
		highlight.OutlineColor = highlight.FillColor
	end
	-- drag preview for line pieces
	clearLine()
	if dragStart and isLine(buildingId) then
		for _, c in lineCells(dragStart.X, dragStart.Z, gx, gz) do
			local px, pz = MapLayout.CellCenter(c[1], c[2])
			local okCell = checkFootprint(c[1], c[2], 1, 1, p.Y, occ)
			local part = Instance.new("Part")
			part.Anchored = true
			part.CanCollide = false
			part.CanQuery = false
			part.CanTouch = false
			part.CastShadow = false
			part.Material = Enum.Material.Neon
			part.Transparency = 0.5
			part.Size = Vector3.new(3.6, 0.4, 3.6)
			part.Color = okCell and Color3.fromRGB(80, 255, 120) or Color3.fromRGB(255, 70, 70)
			part.Position = Vector3.new(px, p.Y + 0.3, pz)
			part.Parent = Workspace
			table.insert(lineGhosts, part)
		end
	end
	if os.clock() - lastInfo > 0.25 then
		lastInfo = os.clock()
		updateInfo()
	end
end

local function place()
	if mode ~= "place" or not buildingId then
		return
	end
	if not valid then
		ctx.Sound:Play("error")
		if reason ~= "" then
			ctx.UI:Notify(reason, "Warning", "🏗")
		end
		return
	end
	local reply = ctx.UI:Request("PlaceBuilding", { Id = buildingId, X = cellX, Z = cellZ, R = rotation, Y = groundY }, true)
	if reply.Ok then
		ctx.Sound:Play("build_place")
		ctx.FX.Puff(ghost and ghost:GetPivot().Position or Vector3.zero, Color3.fromRGB(200, 200, 200), 10, 1.5)
	elseif reply.Msg then
		ctx.UI:Notify(reply.Msg, "Warning", "🏗")
	end
end

local function placeLine(x0: number, z0: number, x1: number, z1: number)
	local reply = ctx.UI:Request("PlaceLine", { Id = buildingId, X0 = x0, Z0 = z0, X1 = x1, Z1 = z1, Y = groundY }, true)
	if reply.Ok then
		ctx.Sound:Play("build_place")
	elseif reply.Msg then
		ctx.UI:Notify(reply.Msg, "Warning", "🏗")
	end
end

local function selectAt()
	local _, inst = aimPoint()
	local model = inst and inst:FindFirstAncestorOfClass("Model")
	while model and not model:GetAttribute("Uid") do
		model = model.Parent and model.Parent:FindFirstAncestorOfClass("Model")
	end
	if model and model:GetAttribute("Owner") == player.UserId then
		selectedUid = model:GetAttribute("Uid")
		selectBox.Adornee = model
		selectBox.Visible = true
	else
		selectedUid = nil
		selectBox.Visible = false
	end
	BuildController:RefreshBar()
end

function BuildController:RefreshBar()
	Lib.Clear(bar)
	infoLabel = Lib.Label("", { Size = UDim2.new(1, 0, 0, 24), TextXAlignment = Enum.TextXAlignment.Center, TextSize = 15, TextTruncate = Enum.TextTruncate.AtEnd, LayoutOrder = 0, Parent = bar })
	local buttons = Lib.Frame({ Size = UDim2.new(1, 0, 0, 44), BackgroundTransparency = 1, LayoutOrder = 1, List = { Horizontal = true, Padding = 8, HAlign = Enum.HorizontalAlignment.Center }, Parent = bar })
	local profile = ctx.Data.Profile
	if mode == "place" then
		Lib.Button("PLACE", { Size = UDim2.fromOffset(120, 40), Style = "Good", Parent = buttons }, place)
		Lib.Button("Rotate (R)", { Size = UDim2.fromOffset(120, 40), Style = "Secondary", Parent = buttons }, function()
			rotation = (rotation + 1) % 4
		end)
	elseif mode == "edit" and selectedUid then
		local b
		for _, x in profile.Base.Buildings do
			if x.Uid == selectedUid then
				b = x
			end
		end
		if b then
			local def = Buildings.ById[b.Id]
			if (b.Level or 1) < def.MaxLevel then
				local cost = Formulas.BuildingUpgradeCost(b.Id, b.Level or 1, profile)
				Lib.Button(string.format("Upgrade Lv%d → %d  %s", b.Level or 1, (b.Level or 1) + 1, Format.Credits(cost)), { Size = UDim2.fromOffset(260, 40), Style = profile.Credits >= cost and "Primary" or "Disabled", Parent = buttons }, function()
					ctx.UI:Request("UpgradeBuilding", { Uid = b.Uid })
					task.wait(0.3)
					self:RefreshBar()
				end)
			end
			if def.Removable then
				Lib.Button("Remove (50% refund)", { Size = UDim2.fromOffset(190, 40), Style = "Danger", Parent = buttons }, function()
					local reply = ctx.UI:Request("RemoveBuilding", { Uid = b.Uid })
					if reply.Ok then
						ctx.Sound:Play("build_remove")
						selectedUid = nil
						selectBox.Visible = false
						self:RefreshBar()
					end
				end)
			end
		end
	end
	Lib.Button(mode == "edit" and "Place mode" or "Edit mode", { Size = UDim2.fromOffset(120, 40), Style = "Secondary", Parent = buttons }, function()
		if mode == "edit" then
			ctx.UI:Open("Base")
		else
			self:Enter(nil)
		end
	end)
	Lib.Button("Exit (X)", { Size = UDim2.fromOffset(110, 40), Style = "Danger", Parent = buttons }, function()
		self:Exit()
	end)
	updateInfo()
end

function BuildController:Enter(id: string?)
	if not player:GetAttribute("HasBase") then
		ctx.UI:Notify("Your base is still being set up...", "Warning", "🏗")
		return
	end
	self.Active = true
	buildingId = id
	mode = id and "place" or "edit"
	selectedUid = nil
	dragStart = nil
	selectBox.Visible = false
	if id then
		makeGhost(id)
	else
		clearGhost()
	end
	bar.Visible = true
	self:RefreshBar()
	if ctx.Camera and ctx.Camera.SetCursorFree then
		ctx.Camera:SetCursorFree("build", not (ctx.Camera.IsFirstPerson and ctx.Camera:IsFirstPerson()))
	end
	if not renderConn then
		renderConn = RunService.RenderStepped:Connect(step)
	end
end

function BuildController:Exit()
	self.Active = false
	mode = nil
	buildingId = nil
	dragStart = nil
	clearGhost()
	selectBox.Visible = false
	bar.Visible = false
	if ctx.Camera and ctx.Camera.SetCursorFree then
		ctx.Camera:SetCursorFree("build", false)
	end
	if renderConn then
		renderConn:Disconnect()
		renderConn = nil
	end
end

function BuildController:Init(c)
	ctx = c
	selectBox = Instance.new("SelectionBox")
	selectBox.Color3 = C.Accent
	selectBox.LineThickness = 0.15
	selectBox.Visible = false
	selectBox.Parent = Workspace
end

function BuildController:Start()
	bar = Lib.Create("Frame", {
		Name = "BuildBar",
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -90),
		Size = UDim2.new(0, 720, 0, 84),
		BackgroundColor3 = C.Panel,
		BackgroundTransparency = 0.1,
		Corner = 12,
		Stroke = { Color = C.Accent, Thickness = 2 },
		Padding = 6,
		List = { Padding = 4 },
		Visible = false,
		ZIndex = 10,
		Parent = ctx.Root,
	})
	local sizeLimit = Instance.new("UISizeConstraint")
	sizeLimit.MaxSize = Vector2.new(720, 84)
	sizeLimit.Parent = bar
	local function fit()
		local cam = Workspace.CurrentCamera
		if cam then
			bar.Size = UDim2.new(0, math.min(720, cam.ViewportSize.X - 24), 0, 84)
		end
	end
	fit()
	if Workspace.CurrentCamera then
		Workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(fit)
	end
	UserInputService.InputBegan:Connect(function(input, processed)
		if not self.Active then
			return
		end
		if input.KeyCode == Enum.KeyCode.Escape or input.KeyCode == Enum.KeyCode.X or input.KeyCode == Enum.KeyCode.ButtonB then
			self:Exit()
			return
		end
		if processed then
			return
		end
		if input.KeyCode == Enum.KeyCode.R or input.KeyCode == Enum.KeyCode.ButtonX then
			rotation = (rotation + 1) % 4
		elseif input.UserInputType == Enum.UserInputType.MouseButton1 or input.KeyCode == Enum.KeyCode.ButtonR2 then
			if mode == "place" then
				if isLine(buildingId) then
					dragStart = { X = cellX, Z = cellZ }
				else
					place()
				end
			elseif mode == "edit" then
				selectAt()
			end
		elseif input.UserInputType == Enum.UserInputType.Touch and mode == "edit" then
			selectAt()
		end
	end)
	UserInputService.InputEnded:Connect(function(input)
		if not self.Active or mode ~= "place" or not dragStart then
			return
		end
		if input.UserInputType == Enum.UserInputType.MouseButton1 or input.KeyCode == Enum.KeyCode.ButtonR2 then
			local s = dragStart
			dragStart = nil
			clearLine()
			if s.X == cellX and s.Z == cellZ then
				place()
			else
				placeLine(s.X, s.Z, cellX, cellZ)
			end
		end
	end)
end

return BuildController
