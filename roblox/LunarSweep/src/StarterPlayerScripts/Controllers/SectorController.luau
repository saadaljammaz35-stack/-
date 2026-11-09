--!nonstrict
-- Draws glowing hexagonal sector borders on the ground near you (local parts only),
-- coloured by how clean each sector is. Toggle in Settings.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local MapLayout = require(Shared.MapLayout)

local player = Players.LocalPlayer

local SectorController = {}

local ctx
local folder: Folder
local drawn: { [number]: { BasePart } } = {}
local RADIUS = 150
local MAX_SECTORS = 36
local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Include

local function colorFor(permille: number): Color3
	if permille >= 1000 then
		return Color3.fromRGB(90, 255, 160)
	end
	local t = permille / 1000
	return Color3.fromRGB(255, 110, 40):Lerp(Color3.fromRGB(255, 230, 120), t)
end

local function groundAt(x: number, z: number, refY: number): Vector3?
	local hit = Workspace:Raycast(Vector3.new(x, refY + 25, z), Vector3.new(0, -60, 0), rayParams)
	return hit and hit.Position or nil
end

local function draw(id: number, s)
	local corners = MapLayout.HexCorners(s.Q, s.R)
	local parts = {}
	local color = colorFor(s.Permille)
	for i = 1, 6 do
		local a = corners[i]
		local b = corners[(i % 6) + 1]
		-- 3 segments per edge to follow the terrain
		local prev = groundAt(a.X, a.Y, s.Y)
		for k = 1, 3 do
			local t = k / 3
			local px, pz = a.X + (b.X - a.X) * t, a.Y + (b.Y - a.Y) * t
			local cur = groundAt(px, pz, s.Y)
			if prev and cur then
				local mid = (prev + cur) / 2 + Vector3.new(0, 0.25, 0)
				local len = (cur - prev).Magnitude
				local p = Instance.new("Part")
				p.Anchored = true
				p.CanCollide = false
				p.CanQuery = false
				p.CanTouch = false
				p.CastShadow = false
				p.Material = Enum.Material.Neon
				p.Color = color
				p.Transparency = 0.25
				p.Size = Vector3.new(0.35, 0.12, len + 0.2)
				p.CFrame = CFrame.lookAt(mid, cur + Vector3.new(0, 0.25, 0))
				p.Parent = folder
				table.insert(parts, p)
			end
			prev = cur
		end
	end
	drawn[id] = parts
end

local function clear(id: number)
	local list: any = drawn[id] or {}
	for _, p in list do
		p:Destroy()
	end
	drawn[id] = nil
end

function SectorController:Init(c)
	ctx = c
	folder = Instance.new("Folder")
	folder.Name = "SectorLines"
	folder.Parent = Workspace
end

function SectorController:Start()
	ctx.Data.SectorChanged:Connect(function(id)
		if id and drawn[id] then
			local s = ctx.Data.Sectors[id]
			local color = colorFor(s.Permille)
			for _, p in drawn[id] do
				p.Color = color
			end
		elseif not id then
			for k in table.clone(drawn) do
				clear(k)
			end
		end
	end)
	task.spawn(function()
		while true do
			task.wait(1)
			rayParams.FilterDescendantsInstances = { Workspace.Terrain }
			local profile = ctx.Data.Profile
			local enabled = profile and profile.Settings.SectorLines ~= false
			local character = player.Character
			local hrp = character and character:FindFirstChild("HumanoidRootPart")
			if not enabled or not hrp then
				for k in table.clone(drawn) do
					clear(k)
				end
				continue
			end
			local pos = hrp.Position
			local wanted = {}
			local list = {}
			for id, s in ctx.Data.Sectors do
				local cx, cz = MapLayout.HexCenter(s.Q, s.R)
				local d = Vector2.new(cx - pos.X, cz - pos.Z).Magnitude
				if d < RADIUS and math.abs(s.Y - pos.Y) < 80 then
					table.insert(list, { id = id, d = d })
				end
			end
			table.sort(list, function(a, b)
				return a.d < b.d
			end)
			for i = 1, math.min(MAX_SECTORS, #list) do
				wanted[list[i].id] = true
			end
			for id in table.clone(drawn) do
				if not wanted[id] then
					clear(id)
				end
			end
			local added = 0
			for id in wanted do
				if not drawn[id] and added < 6 then
					draw(id, ctx.Data.Sectors[id])
					added += 1
				end
			end
		end
	end)
end

return SectorController
