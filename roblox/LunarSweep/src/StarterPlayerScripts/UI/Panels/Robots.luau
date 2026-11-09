--!nonstrict
-- Robot Bay: your robots (zone assignment, power, battery, wear, repair, level up, recall,
-- sell) and the robot catalog.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Robots = require(Shared.Config.Robots)
local Zones = require(Shared.Config.Zones)
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local MapLayout = require(Shared.MapLayout)

local UI = script.Parent.Parent
local Lib = require(UI.Lib)
local Theme = require(UI.Theme)
local Viewport = require(UI.Viewport)
local Common = require(script.Parent.Common)

local C = Theme.Colors

local ROLE_TEXT = { cleaner = "Cleaner", collector = "Collector", hauler = "Hauler", helper = "Helper" }

return function(ctx)
	local Data = ctx.Data
	local win = Lib.Window("Robot Bay", nil, Color3.fromRGB(80, 220, 255))
	local panel = { Window = win }
	local tab = "My Robots"
	local content = Lib.Frame({ Size = UDim2.new(1, 0, 1, -44), Position = UDim2.fromOffset(0, 44), BackgroundTransparency = 1, Parent = win.Body })
	local slotsLabel = Lib.Label("", { Size = UDim2.fromOffset(320, 34), Position = UDim2.new(1, -320, 0, 0), TextXAlignment = Enum.TextXAlignment.Right, TextColor3 = C.SubText, Parent = win.Body })

	local function liveState(uid: number): any
		for _, m in Workspace:WaitForChild("Robots"):GetChildren() do
			if m:GetAttribute("Uid") == uid and m:GetAttribute("Owner") == game:GetService("Players").LocalPlayer.UserId then
				return m
			end
		end
		return nil
	end

	local MAX_SECTORS = 8

	-- hex-map picker: choose the sectors a robot works in (empty = whole zone)
	local function sectorPicker(r)
		local zone = Zones.ById[r.Zone]
		if not zone then
			return
		end
		local chosen = {}
		for _, k in (r.Sectors or {}) do
			chosen[k] = true
		end
		local overlay = Lib.Create("TextButton", { Text = "", AutoButtonColor = false, Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 0.35, ZIndex = 50, Parent = win.Frame })
		local box = Lib.Create("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.new(0.92, 0, 0.92, 0), BackgroundColor3 = C.Panel, Corner = 12, Stroke = { Color = zone.Accent, Thickness = 2 }, ZIndex = 51, Parent = overlay })
		local title = Lib.Label("", { Size = UDim2.new(1, -20, 0, 26), Position = UDim2.fromOffset(10, 6), TextSize = 17, Font = Theme.FontBlack, ZIndex = 52, Parent = box })
		local mapFrame = Lib.Create("Frame", { Size = UDim2.new(1, -20, 1, -90), Position = UDim2.fromOffset(10, 36), BackgroundColor3 = Color3.fromRGB(20, 22, 28), Corner = 8, ClipsDescendants = true, ZIndex = 52, Parent = box })
		local buttons = Lib.Frame({ Size = UDim2.new(1, -20, 0, 40), Position = UDim2.new(0, 10, 1, -48), BackgroundTransparency = 1, List = { Horizontal = true, Padding = 8, HAlign = Enum.HorizontalAlignment.Right }, Parent = box })
		buttons.ZIndex = 52
		-- sectors of this zone, laid out by their hex centres
		local list = {}
		local minX, maxX, minZ, maxZ = math.huge, -math.huge, math.huge, -math.huge
		for _, s in Data.Sectors do
			if s.Zone == zone.Index then
				local x, z = MapLayout.HexCenter(s.Q, s.R)
				table.insert(list, { S = s, X = x, Z = z, Key = MapLayout.SectorKey(s.Zone, s.Q, s.R) })
				minX, maxX = math.min(minX, x), math.max(maxX, x)
				minZ, maxZ = math.min(minZ, z), math.max(maxZ, z)
			end
		end
		local count = 0
		local function updateTitle()
			count = 0
			for _ in chosen do
				count += 1
			end
			title.Text = string.format("%s - pick up to %d sectors (%d chosen). None = whole zone.", zone.Name, MAX_SECTORS, count)
		end
		local cells = {}
		local function paint(entry, btn)
			local on = chosen[entry.Key]
			local clean = (entry.S.Permille or 0) / 1000
			btn.BackgroundColor3 = on and zone.Accent or Color3.fromRGB(150, 70, 60):Lerp(Color3.fromRGB(70, 170, 100), clean)
			btn.BackgroundTransparency = on and 0 or 0.2
			btn.TextColor3 = on and Color3.new(0, 0, 0) or C.Text
		end
		local spanX = math.max(1, maxX - minX)
		local spanZ = math.max(1, maxZ - minZ)
		for _, entry in list do
			local fx = (entry.X - minX) / spanX
			local fz = (entry.Z - minZ) / spanZ
			local btn = Lib.Create("TextButton", {
				Text = tostring(entry.S.Number % 100),
				Font = Theme.FontBlack,
				TextSize = 11,
				AutoButtonColor = false,
				AnchorPoint = Vector2.new(0.5, 0.5),
				Position = UDim2.new(0.04 + fx * 0.92, 0, 0.05 + fz * 0.9, 0),
				Size = UDim2.fromOffset(24, 24),
				Corner = 12,
				ZIndex = 53,
				Parent = mapFrame,
			})
			cells[entry.Key] = btn
			paint(entry, btn)
			btn.Activated:Connect(function()
				if chosen[entry.Key] then
					chosen[entry.Key] = nil
				elseif count < MAX_SECTORS then
					chosen[entry.Key] = true
				else
					ctx.Sound:Play("error")
					return
				end
				ctx.Sound:Play("click")
				paint(entry, btn)
				updateTitle()
			end)
		end
		updateTitle()
		local function close()
			overlay:Destroy()
		end
		Lib.Button("Whole zone", { Size = UDim2.fromOffset(130, 36), Style = "Secondary", Parent = buttons }, function()
			table.clear(chosen)
			for _, entry in list do
				paint(entry, cells[entry.Key])
			end
			updateTitle()
		end)
		Lib.Button("Cancel", { Size = UDim2.fromOffset(100, 36), Style = "Ghost", Parent = buttons }, close)
		Lib.Button("Save", { Size = UDim2.fromOffset(110, 36), Style = "Good", Parent = buttons }, function()
			local keys = {}
			for k in chosen do
				table.insert(keys, k)
			end
			local reply = ctx.UI:Request("RobotSetSectors", { Uid = r.Uid, Keys = keys })
			if reply.Ok then
				close()
			end
		end)
		for _, d in buttons:GetDescendants() do
			if d:IsA("GuiObject") then
				d.ZIndex = 53
			end
		end
	end

	local function myRobots()
		local p = Data.Profile
		local scroll = Lib.Scroll({ Parent = content }, { Padding = 8 })
		if #p.Robots == 0 then
			Lib.Label("You don't own any robots yet. Check the Catalog tab - the Dustbot Mk I costs only $250!", { TextSize = 18, TextColor3 = C.SubText, Size = UDim2.new(1, 0, 0, 60), Parent = scroll })
		end
		local unlocked = {}
		for _, z in Zones.List do
			if p.Zones[z.Id] then
				table.insert(unlocked, z.Id)
			end
		end
		for i, r in p.Robots do
			local def = Robots.ById[r.Id]
			if def then
				local stats = Formulas.RobotStats(r.Id, r.Level, p)
				local row = Lib.Frame({ Size = UDim2.new(1, -10, 0, 166), BackgroundColor3 = C.PanelLight, Corner = 10, LayoutOrder = i, Parent = scroll })
				local holder = Lib.Frame({ Size = UDim2.fromOffset(120, 120), Position = UDim2.fromOffset(5, 5), BackgroundColor3 = Color3.fromRGB(28, 31, 38), Corner = 8, Parent = row })
				Viewport.Render(holder, "Robot", r.Id)
				Lib.Label(string.format("%s  •  Lv %d", def.Name, r.Level), { Size = UDim2.new(0.4, 0, 0, 24), Position = UDim2.fromOffset(134, 6), TextSize = 18, Font = Theme.FontBlack, Parent = row })
				local live = liveState(r.Uid)
				local state = r.Active and (live and live:GetAttribute("State") or "Travelling") or "Stored"
				Lib.Label(string.format("%s  •  %s", ROLE_TEXT[def.Role] or def.Role, state), { Size = UDim2.new(0.4, 0, 0, 18), Position = UDim2.fromOffset(134, 30), TextSize = 14, TextColor3 = r.Active and C.Good or C.SubText, Parent = row })
				local battery = Lib.Bar({ Size = UDim2.new(0.32, 0, 0, 12), Position = UDim2.fromOffset(134, 56), Parent = row }, Color3.fromRGB(80, 220, 120))
				battery:Set((live and live:GetAttribute("Battery") or r.Battery) / 100, "🔋 " .. math.floor(live and live:GetAttribute("Battery") or r.Battery) .. "%")
				local wear = Lib.Bar({ Size = UDim2.new(0.32, 0, 0, 12), Position = UDim2.fromOffset(134, 74), Parent = row }, Color3.fromRGB(255, 180, 60))
				wear:Set(r.Durability / 100, "🔧 " .. math.floor(r.Durability) .. "%")
				local info = def.Role == "cleaner" and string.format("Width %.1f • Speed %.1f • Cap %s", stats.Width, stats.Speed, Format.Kg(stats.Capacity))
					or def.Role == "collector" and string.format("Magnet %.0f • Speed %.1f • Cap %s", stats.Magnet, stats.Speed, Format.Kg(stats.Capacity))
					or def.Description
				Lib.Label(info, { Size = UDim2.new(0.42, 0, 0, 30), Position = UDim2.fromOffset(134, 92), TextSize = 13, TextColor3 = C.SubText, Font = Theme.FontMedium, Parent = row })
				-- controls
				local controls = Lib.Frame({ Size = UDim2.new(0.42, 0, 1, -12), Position = UDim2.new(0.58, 0, 0, 6), BackgroundTransparency = 1, Grid = { Cell = UDim2.fromOffset(140, 32), Pad = UDim2.fromOffset(6, 6) }, Parent = row })
				Lib.Button(r.Active and "Deactivate" or "Activate", { Style = r.Active and "Secondary" or "Good", TextSize = 14, LayoutOrder = 1, Parent = controls }, function()
					ctx.UI:Request("RobotToggle", { Uid = r.Uid, Active = not r.Active })
				end)
				if def.Role == "cleaner" or def.Role == "collector" then
					local z = Zones.ById[r.Zone]
					Lib.Button("Zone: " .. (z and z.Name or "?"), { Style = "Ghost", TextSize = 13, LayoutOrder = 2, Parent = controls }, function()
						local idx = table.find(unlocked, r.Zone) or 0
						local nextZone = unlocked[(idx % #unlocked) + 1]
						ctx.UI:Request("RobotSetZone", { Uid = r.Uid, Zone = nextZone })
					end)
					local n = r.Sectors and #r.Sectors or 0
					Lib.Button(n > 0 and string.format("Sectors: %d", n) or "Sectors: all", { Style = "Ghost", TextSize = 13, LayoutOrder = 2, Parent = controls }, function()
						sectorPicker(r)
					end)
				end
				local repairCost = Formulas.RobotRepairCost(r.Id, r.Level, r.Durability)
				Lib.Button(r.Durability >= 99.5 and "Repaired" or ("Repair " .. Format.Credits(repairCost)), { Style = r.Durability >= 99.5 and "Disabled" or "Primary", TextSize = 13, LayoutOrder = 3, Parent = controls }, function()
					ctx.UI:Request("RobotRepair", { Uid = r.Uid })
				end)
				if r.Level < Robots.MaxLevel then
					local up = Formulas.RobotUpgradeCost(r.Id, r.Level)
					Lib.Button("Upgrade " .. Format.Credits(up), { Style = p.Credits >= up and "Primary" or "Disabled", TextSize = 13, LayoutOrder = 4, Parent = controls }, function()
						ctx.UI:Request("RobotUpgrade", { Uid = r.Uid })
					end)
				end
				if r.Active and def.Role ~= "helper" then
					Lib.Button("Recall", { Style = "Ghost", TextSize = 13, LayoutOrder = 5, Parent = controls }, function()
						ctx.UI:Request("RobotRecall", { Uid = r.Uid })
					end)
				end
				Lib.Button("Sell " .. Format.Credits(Formulas.RobotSellValue(r.Id, r.Level)), { Style = "Danger", TextSize = 13, LayoutOrder = 6, Parent = controls }, function()
					Lib.Confirm(ctx.Root, "Sell " .. def.Name .. "? This cannot be undone.", function()
						ctx.UI:Request("SellRobot", { Uid = r.Uid })
					end, "Sell")
				end)
			end
		end
	end

	local function catalog()
		local p = Data.Profile
		local left = Lib.Frame({ Size = UDim2.new(0.62, 0, 1, 0), BackgroundTransparency = 1, Parent = content })
		local grid = Lib.Scroll({ Parent = left }, { Grid = { Cell = UDim2.fromOffset(160, 200), Pad = UDim2.fromOffset(8, 8) } })
		local detail = Common.DetailPane(content)
		local function show(def)
			detail:Show("Robot", def.Id, def.Name, def.Rarity, def.Description)
			local stats = Formulas.RobotStats(def.Id, 1, p)
			Lib.StatRow(detail.Stats, "Role", ROLE_TEXT[def.Role], nil, 1)
			if def.Role == "cleaner" then
				Lib.StatRow(detail.Stats, "Clean width", string.format("%.1f", stats.Width), nil, 2)
			end
			if def.Role == "collector" then
				Lib.StatRow(detail.Stats, "Magnet", string.format("%.0f", stats.Magnet), nil, 2)
			end
			Lib.StatRow(detail.Stats, "Speed", string.format("%.1f", stats.Speed), nil, 3)
			if stats.Capacity > 0 then
				Lib.StatRow(detail.Stats, "Cargo", Format.Kg(stats.Capacity), nil, 4)
			end
			Lib.StatRow(detail.Stats, "Battery", Format.Duration(stats.Battery), nil, 5)
			if def.Source ~= "shop" then
				detail:SetAction("Robot Crate exclusive", "Disabled")
			elseif p.Level < def.Level then
				detail:SetAction("Locked - Level " .. def.Level, "Disabled")
			else
				local price = Formulas.ShopPrice(def.Price, p)
				detail:SetAction("Buy " .. Format.Credits(price), p.Credits >= price and "Primary" or "Disabled", function()
					ctx.UI:Request("BuyRobot", { Id = def.Id })
				end)
			end
		end
		for i, def in Robots.List do
			Common.Card(grid, {
				Kind = "Robot",
				Id = def.Id,
				Name = def.Name,
				Rarity = def.Rarity,
				Sub = ROLE_TEXT[def.Role] .. "\n" .. (def.Source == "shop" and Format.Credits(Formulas.ShopPrice(def.Price, p)) or "Crate"),
				Badge = p.Level < def.Level and ("LV " .. def.Level) or nil,
				BadgeColor = Color3.fromRGB(90, 90, 100),
				Order = i,
				Dim = p.Level < def.Level,
				OnSelect = function()
					show(def)
				end,
			})
		end
		show(Robots.List[1])
	end

	local function rebuild()
		local p = Data.Profile
		if not p then
			return
		end
		Lib.Clear(content)
		local active = 0
		for _, r in p.Robots do
			if r.Active then
				active += 1
			end
		end
		slotsLabel.Text = string.format("Active %d / %d slots  •  %d owned", active, Formulas.RobotSlots(p.Base.Buildings, p), #p.Robots)
		if tab == "My Robots" then
			myRobots()
		else
			catalog()
		end
	end
	local tabs = Lib.Tabs(win.Body, { "My Robots", "Catalog" }, function(name)
		tab = name
		rebuild()
	end)
	Data.Changed:Connect(function(key)
		if ctx.UI.Current == "Robots" and (key == "Robots" or (key == "Credits" and tab == "Catalog")) then
			rebuild()
		end
	end)
	function panel:Open()
		tabs:Select(tab)
	end
	return panel
end
