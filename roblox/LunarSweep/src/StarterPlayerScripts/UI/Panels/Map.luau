--!nonstrict
-- Moon map: 3x3 zone layout with per-sector cleanliness heatmap, players, your robots,
-- zone unlocking and fast travel.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")
local RunService = game:GetService("RunService")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Zones = require(Shared.Config.Zones)
local MapLayout = require(Shared.MapLayout)
local Format = require(Shared.Util.Format)

local UI = script.Parent.Parent
local Lib = require(UI.Lib)
local Theme = require(UI.Theme)

local C = Theme.Colors
local MAP = 420

return function(ctx)
	local Data = ctx.Data
	local win = Lib.Window("Moon Map", UDim2.fromOffset(900, 560), Color3.fromRGB(90, 170, 255))
	local panel = { Window = win }
	local mapFrame = Lib.Frame({ Size = UDim2.fromOffset(MAP, MAP), Position = UDim2.fromOffset(0, 10), BackgroundColor3 = Color3.fromRGB(14, 16, 22), Corner = 8, ClipsDescendants = true, Parent = win.Body })
	local zoneLayer = Lib.Frame({ Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, ZIndex = 2, Parent = mapFrame })
	local sectorLayer = Lib.Frame({ Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, ZIndex = 3, Parent = mapFrame })
	local dotLayer = Lib.Frame({ Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, ZIndex = 6, Parent = mapFrame })
	local side = Lib.Scroll({ Size = UDim2.new(1, -MAP - 16, 1, 0), Position = UDim2.fromOffset(MAP + 16, 0), Parent = win.Body }, { Padding = 6 })
	local legend = Lib.Label("● you   ● players   ◆ your robots   ■ dirty → clean", { Size = UDim2.fromOffset(MAP, 22), Position = UDim2.fromOffset(0, MAP + 14), TextSize = 13, TextColor3 = C.SubText, Parent = win.Body })
	local _ = legend

	local function toMap(x: number, z: number): UDim2
		return UDim2.fromOffset((x + MapLayout.HALF) / (MapLayout.HALF * 2) * MAP, (z + MapLayout.HALF) / (MapLayout.HALF * 2) * MAP)
	end

	local function drawZones()
		local p = Data.Profile
		for gx = 0, 2 do
			for gz = 0, 2 do
				local id = MapLayout.ZoneGrid[gx .. "," .. gz]
				local z = Zones.ById[id]
				local unlocked = id == "hub" or (p and p.Zones[id])
				local cell = Lib.Frame({ Size = UDim2.fromOffset(MAP / 3 - 2, MAP / 3 - 2), Position = UDim2.fromOffset(gx * MAP / 3 + 1, gz * MAP / 3 + 1), BackgroundColor3 = id == "hub" and Color3.fromRGB(60, 50, 40) or (z and z.DirtyColor or C.PanelLight), BackgroundTransparency = unlocked and 0.35 or 0.75, ZIndex = 2, Parent = zoneLayer })
				Lib.Label((unlocked and "" or "🔒 ") .. (z and z.Name or "Colony"), { Size = UDim2.new(1, -6, 0, 18), Position = UDim2.fromOffset(4, 2), TextSize = 12, Font = Theme.FontBlack, TextColor3 = z and z.Accent or C.Accent, ZIndex = 4, TextStrokeTransparency = 0.5, Parent = cell })
			end
		end
	end

	local sectorDots: { [number]: Frame } = {}
	local function color(permille: number): Color3
		local t = permille / 1000
		if t >= 0.999 then
			return Color3.fromRGB(80, 230, 140)
		end
		return Color3.fromRGB(255, 70, 50):Lerp(Color3.fromRGB(255, 220, 70), t)
	end
	local function drawSectors()
		Lib.Clear(sectorLayer)
		table.clear(sectorDots)
		for id, s in Data.Sectors do
			if s.Zone ~= 9 then
				local x, z = MapLayout.HexCenter(s.Q, s.R)
				local dot = Lib.Frame({ Size = UDim2.fromOffset(10, 10), AnchorPoint = Vector2.new(0.5, 0.5), Position = toMap(x, z), BackgroundColor3 = color(s.Permille), BackgroundTransparency = 0.2, Corner = 3, ZIndex = 3, Parent = sectorLayer })
				sectorDots[id] = dot
			end
		end
	end
	Data.SectorChanged:Connect(function(id)
		if ctx.UI.Current ~= "Map" then
			return
		end
		if id and sectorDots[id] and Data.Sectors[id] then
			sectorDots[id].BackgroundColor3 = color(Data.Sectors[id].Permille)
		end
	end)

	local function zoneStats(zoneId: string): (number, number)
		local total, clean = 0, 0
		for _, s in Data.Sectors do
			local z = Zones.List[s.Zone]
			if z and z.Id == zoneId then
				total += s.Total
				clean += s.Total * s.Permille / 1000
			end
		end
		return total, clean
	end

	local sideGen = 0
	local function drawSide()
		sideGen += 1
		local myGen = sideGen
		local p = Data.Profile
		Lib.Clear(side)
		local allTotal, allClean = 0, 0
		for _, s in Data.Sectors do
			allTotal += s.Total
			allClean += s.Total * s.Permille / 1000
		end
		Lib.Label(string.format("MOON CLEANED: %s", Format.Percent(allClean / math.max(1, allTotal), 2)), { Size = UDim2.new(1, 0, 0, 30), TextSize = 20, Font = Theme.FontBlack, TextColor3 = C.Good, LayoutOrder = 0, Parent = side })
		Lib.Label(string.format("You helped finish %d sectors.", p.Stats.SectorsCleared or 0), { Size = UDim2.new(1, 0, 0, 20), TextSize = 14, TextColor3 = C.SubText, LayoutOrder = 1, Parent = side })
		local hubRow = Lib.Frame({ Size = UDim2.new(1, -10, 0, 46), BackgroundColor3 = C.PanelLight, Corner = 8, LayoutOrder = 2, Parent = side })
		Lib.Label("🏠 Tranquility Colony", { Size = UDim2.new(0.6, 0, 1, 0), Position = UDim2.fromOffset(10, 0), TextSize = 15, Parent = hubRow })
		Lib.Button("Travel", { Size = UDim2.fromOffset(90, 32), Position = UDim2.new(1, -100, 0, 7), TextSize = 14 }, function()
			ctx.UI:Close()
			ctx.UI:Request("FastTravel", { Zone = "hub" }, true)
		end).Parent = hubRow
		-- your base + beacons (fast travel anywhere you built one)
		if Players.LocalPlayer:GetAttribute("HasBase") then
			local homeRow = Lib.Frame({ Size = UDim2.new(1, -10, 0, 46), BackgroundColor3 = C.PanelLight, Corner = 8, LayoutOrder = 2, Parent = side })
			Lib.Label("🏗 Your base", { Size = UDim2.new(0.6, 0, 1, 0), Position = UDim2.fromOffset(10, 0), TextSize = 15, Parent = homeRow })
			Lib.Button("Travel", { Size = UDim2.fromOffset(90, 32), Position = UDim2.new(1, -100, 0, 7), TextSize = 14 }, function()
				ctx.UI:Close()
				ctx.UI:Request("TeleportBase", {}, true)
			end).Parent = homeRow
			task.spawn(function()
				local reply = ctx.UI:Request("GetBaseStatus", {})
				local beacons = reply and reply.Data and reply.Data.Beacons or {}
				for bi, bc in beacons do
					if sideGen ~= myGen then
						return
					end
					local row = Lib.Frame({ Size = UDim2.new(1, -10, 0, 46), BackgroundColor3 = C.PanelLight, Corner = 8, LayoutOrder = 2, Parent = side })
					Lib.Label(string.format("📡 Beacon %d  •  %s", bi, MapLayout.ZoneAt(bc.Pos) == "hub" and "Colony" or (Zones.ById[MapLayout.ZoneAt(bc.Pos)] and Zones.ById[MapLayout.ZoneAt(bc.Pos)].Name or "")), { Size = UDim2.new(0.62, 0, 1, 0), Position = UDim2.fromOffset(10, 0), TextSize = 14, Parent = row })
					Lib.Button("Travel", { Size = UDim2.fromOffset(90, 32), Position = UDim2.new(1, -100, 0, 7), TextSize = 14 }, function()
						ctx.UI:Close()
						ctx.UI:Request("BeaconTravel", { Uid = bc.Uid }, true)
					end).Parent = row
					Lib.Frame({ Size = UDim2.fromOffset(10, 10), AnchorPoint = Vector2.new(0.5, 0.5), Position = toMap(bc.Pos.X, bc.Pos.Z), BackgroundColor3 = Color3.fromRGB(255, 200, 60), Rotation = 45, ZIndex = 6, Parent = zoneLayer })
				end
			end)
		end
		for i, z in Zones.List do
			local unlocked = p.Zones[z.Id]
			local total, clean = zoneStats(z.Id)
			local row = Lib.Frame({ Size = UDim2.new(1, -10, 0, 58), BackgroundColor3 = C.PanelLight, Corner = 8, LayoutOrder = 2 + i, Stroke = { Color = z.Accent, Thickness = 1, Transparency = 0.4 }, Parent = side })
			Lib.Label(string.format("%d. %s", z.Index, z.Name), { Size = UDim2.new(0.62, 0, 0, 22), Position = UDim2.fromOffset(10, 4), TextSize = 15, Font = Theme.FontBlack, TextColor3 = z.Accent, Parent = row })
			Lib.Label(unlocked and string.format("%s clean • Lv %d", Format.Percent(clean / math.max(1, total), 1), z.Level) or string.format("Lv %d • %s", z.Level, Format.Credits(z.Cost)), { Size = UDim2.new(0.62, 0, 0, 20), Position = UDim2.fromOffset(10, 28), TextSize = 13, TextColor3 = C.SubText, Parent = row })
			if unlocked then
				Lib.Button("Travel", { Size = UDim2.fromOffset(90, 34), Position = UDim2.new(1, -100, 0, 12), TextSize = 14 }, function()
					ctx.UI:Close()
					ctx.UI:Request("FastTravel", { Zone = z.Id }, true)
				end).Parent = row
			else
				local can = p.Level >= z.Level and p.Credits >= z.Cost
				Lib.Button("Unlock", { Size = UDim2.fromOffset(90, 34), Position = UDim2.new(1, -100, 0, 12), TextSize = 14, Style = can and "Good" or "Disabled" }, function()
					ctx.UI:Request("UnlockZone", { Id = z.Id })
				end).Parent = row
			end
		end
	end

	-- live dots
	local conn
	local function startDots()
		if conn then
			return
		end
		local acc = 0
		conn = RunService.Heartbeat:Connect(function(dt)
			acc += dt
			if acc < 0.5 then
				return
			end
			acc = 0
			Lib.Clear(dotLayer)
			local me = Players.LocalPlayer
			for _, pl in Players:GetPlayers() do
				local hrp = pl.Character and pl.Character:FindFirstChild("HumanoidRootPart")
				if hrp then
					Lib.Frame({ Size = UDim2.fromOffset(pl == me and 12 or 9, pl == me and 12 or 9), AnchorPoint = Vector2.new(0.5, 0.5), Position = toMap(hrp.Position.X, hrp.Position.Z), BackgroundColor3 = pl == me and C.Accent or Color3.fromRGB(90, 200, 255), Corner = 6, ZIndex = 7, Stroke = { Color = Color3.new(1, 1, 1), Thickness = 1 }, Parent = dotLayer })
				end
			end
			for _, m in Workspace:WaitForChild("Robots"):GetChildren() do
				if m:GetAttribute("Owner") == me.UserId and m.PrimaryPart then
					local pos = m.PrimaryPart.Position
					local d = Lib.Frame({ Size = UDim2.fromOffset(7, 7), AnchorPoint = Vector2.new(0.5, 0.5), Position = toMap(pos.X, pos.Z), BackgroundColor3 = Color3.fromRGB(120, 255, 180), Rotation = 45, ZIndex = 7, Parent = dotLayer })
					local _ = d
				end
			end
		end)
	end

	function panel:Open()
		Lib.Clear(zoneLayer)
		drawZones()
		drawSectors()
		drawSide()
		startDots()
	end
	function panel:Close()
		if conn then
			conn:Disconnect()
			conn = nil
		end
	end
	Data.Changed:Connect(function(key)
		if ctx.UI.Current == "Map" and (key == "Zones" or key == "Credits") then
			drawSide()
		end
	end)
	return panel
end
