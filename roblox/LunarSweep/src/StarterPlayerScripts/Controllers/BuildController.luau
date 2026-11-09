--!nonstrict
-- Base build mode. Place mode shows a ghost of the building snapped to your plot's 4-stud
-- grid (green = valid, red = blocked); R rotates; click / PLACE confirms; you stay in place
-- mode for quick conveyor chains. Edit mode lets you click your buildings to upgrade or
-- remove them. Esc / X exits.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local MapLayout = require(Shared.MapLayout)
local Buildings = require(Shared.Config.Buildings)
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local ModelFactory = require(Shared.ModelFactory)

local Lib = require(script.Parent.Parent.UI.Lib)
local Theme = require(script.Parent.Parent.UI.Theme)

local player = Players.LocalPlayer
local C = Theme.Colors
local GRID = MapLayout.PLOT_CELLS

local BuildController = {}
BuildController.Active = false

local ctx
local mode: string? = nil -- "place" | "edit"
local buildingId: string? = nil
local rotation = 0
local ghost: Model? = nil
local highlight: Highlight? = nil
local valid = false
local cellX, cellZ = 0, 0
local bar: Frame
local infoLabel: TextLabel
local selectBox: SelectionBox
local selectedUid: number? = nil
local renderConn: RBXScriptConnection? = nil

local function plotOrigin(): Vector3?
	local idx = player:GetAttribute("Plot")
	if not idx then
		return nil
	end
	return MapLayout.PlotOrigin(idx)
end

local function footprint(def, r: number): (number, number)
	if r % 2 == 1 then
		return def.D, def.W
	end
	return def.W, def.D
end

local function occupied(): { [number]: number }
	local occ = {}
	local profile = ctx.Data.Profile
	for _, b in profile.Base.Buildings do
		local def = Buildings.ById[b.Id]
		if def then
			local w, d = footprint(def, b.R or 0)
			for dx = 0, w - 1 do
				for dz = 0, d - 1 do
					occ[(b.Z + dz) * GRID + (b.X + dx)] = b.Uid
				end
			end
		end
	end
	return occ
end

local function aimPoint(): Vector3?
	local cam = Workspace.CurrentCamera
	local pos
	if UserInputService.TouchEnabled and not UserInputService.MouseEnabled then
		local v = cam.ViewportSize
		pos = Vector2.new(v.X / 2, v.Y / 2)
	else
		pos = UserInputService:GetMouseLocation()
	end
	local ray = cam:ViewportPointToRay(pos.X, pos.Y)
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	local ignore = { player.Character, ghost }
	for _, n in { "LocalFX", "SkyDome", "SectorLines" } do
		local f = Workspace:FindFirstChild(n)
		if f then
			table.insert(ignore, f)
		end
	end
	params.FilterDescendantsInstances = ignore
	local hit = Workspace:Raycast(ray.Origin, ray.Direction * 600, params)
	return hit and hit.Position or nil, hit and hit.Instance or nil
end

local function clearGhost()
	if ghost then
		ghost:Destroy()
		ghost = nil
	end
	highlight = nil
end

local function makeGhost(id: string)
	clearGhost()
	local m = ModelFactory.Building(id, 1)
	for _, d in m:GetDescendants() do
		if d:IsA("BasePart") then
			d.CanCollide = false
			d.CanQuery = false
			d.CastShadow = false
			d.Transparency = math.max(d.Transparency, 0.45)
		elseif d:IsA("Light") or d:IsA("ParticleEmitter") then
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

local function updateInfo()
	local profile = ctx.Data.Profile
	if mode == "place" and buildingId then
		local def = Buildings.ById[buildingId]
		infoLabel.Text = string.format("%s %s  •  %s  •  R rotate  •  %s", def.Icon, def.Name, Format.Credits(Formulas.BuildingCost(buildingId, profile)), (UserInputService.TouchEnabled and "PLACE to build" or "Click to build"))
	elseif mode == "edit" then
		if selectedUid then
			infoLabel.Text = "Selected building - use Upgrade or Remove"
		else
			infoLabel.Text = "Edit mode: click one of your buildings"
		end
	end
end

local function step()
	local origin = plotOrigin()
	if not origin then
		return
	end
	if mode == "place" and buildingId and ghost then
		local def = Buildings.ById[buildingId]
		local w, d = footprint(def, rotation)
		local p = aimPoint()
		if not p then
			return
		end
		local gx = math.floor((p.X - origin.X) / 4 - w / 2 + 0.5)
		local gz = math.floor((p.Z - origin.Z) / 4 - d / 2 + 0.5)
		cellX, cellZ = gx, gz
		local inBounds = gx >= 0 and gz >= 0 and gx + w <= GRID and gz + d <= GRID
		local free = inBounds
		if inBounds then
			local occ = occupied()
			for dx = 0, w - 1 do
				for dz = 0, d - 1 do
					if occ[(gz + dz) * GRID + gx + dx] then
						free = false
					end
				end
			end
		end
		valid = free
		local cx = origin.X + (gx + w / 2) * 4
		local cz = origin.Z + (gz + d / 2) * 4
		ghost:PivotTo(CFrame.new(cx, 1, cz) * CFrame.Angles(0, math.rad(90 * rotation), 0))
		if highlight then
			highlight.FillColor = valid and Color3.fromRGB(80, 255, 120) or Color3.fromRGB(255, 70, 70)
			highlight.OutlineColor = highlight.FillColor
		end
	end
end

local function place()
	if mode ~= "place" or not buildingId then
		return
	end
	if not valid then
		ctx.Sound:Play("error")
		return
	end
	local reply = ctx.UI:Request("PlaceBuilding", { Id = buildingId, X = cellX, Z = cellZ, R = rotation }, true)
	if reply.Ok then
		ctx.Sound:Play("build_place")
		ctx.FX.Puff(ghost and ghost:GetPivot().Position or Vector3.zero, Color3.fromRGB(200, 200, 200), 10, 1.5)
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
	infoLabel = Lib.Label("", { Size = UDim2.new(1, 0, 0, 24), TextXAlignment = Enum.TextXAlignment.Center, TextSize = 15, LayoutOrder = 0, Parent = bar })
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
	if not player:GetAttribute("Plot") then
		ctx.UI:Notify("Your plot is still being assigned...", "Warning", "🏗")
		return
	end
	self.Active = true
	buildingId = id
	mode = id and "place" or "edit"
	selectedUid = nil
	selectBox.Visible = false
	if id then
		makeGhost(id)
	else
		clearGhost()
	end
	bar.Visible = true
	self:RefreshBar()
	if not renderConn then
		renderConn = RunService.RenderStepped:Connect(step)
	end
end

function BuildController:Exit()
	self.Active = false
	mode = nil
	buildingId = nil
	clearGhost()
	selectBox.Visible = false
	bar.Visible = false
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
	selectBox.Parent = Workspace
end

function BuildController:Start()
	bar = Lib.Create("Frame", {
		Name = "BuildBar",
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -90),
		Size = UDim2.fromOffset(700, 84),
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
				place()
			elseif mode == "edit" then
				selectAt()
			end
		elseif input.UserInputType == Enum.UserInputType.Touch and mode == "edit" then
			selectAt()
		end
	end)
end

return BuildController
