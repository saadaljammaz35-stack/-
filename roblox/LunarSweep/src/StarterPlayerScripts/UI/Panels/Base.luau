--!nonstrict
-- Base management: overview (power, storage, command center), build catalog (enters
-- build mode), building list with upgrade/remove, silo contents and selling.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Buildings = require(Shared.Config.Buildings)
local Resources = require(Shared.Config.Resources)
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)

local UI = script.Parent.Parent
local Lib = require(UI.Lib)
local Theme = require(UI.Theme)
local Viewport = require(UI.Viewport)

local C = Theme.Colors

return function(ctx)
	local Data = ctx.Data
	local win = Lib.Window("Base Command")
	local panel = { Window = win }
	local tab = "Overview"
	local buildCategory = "Storage"
	local content = Lib.Frame({ Size = UDim2.new(1, 0, 1, -44), Position = UDim2.fromOffset(0, 44), BackgroundTransparency = 1, Parent = win.Body })

	local function cc(p)
		for _, b in p.Base.Buildings do
			if b.Id == "command_center" then
				return b
			end
		end
		return nil
	end

	local function limitedCount(p)
		local n = 0
		for _, b in p.Base.Buildings do
			if b.Id ~= "conveyor" and b.Id ~= "foundation_tile" then
				n += 1
			end
		end
		return n
	end

	local function overview()
		local p = Data.Profile
		local st = Data.BaseStatus
		local col = Lib.Frame({ Size = UDim2.new(0.5, -6, 1, 0), BackgroundColor3 = C.PanelLight, Corner = 12, Padding = 14, List = { Padding = 10 }, Parent = content })
		local center = cc(p)
		local ccLevel = center and center.Level or 1
		Lib.Label("COMMAND CENTER  •  LEVEL " .. ccLevel, { TextSize = 20, Font = Theme.FontBlack, Size = UDim2.new(1, 0, 0, 26), Parent = col })
		Lib.StatRow(col, "Buildings", string.format("%d / %d", limitedCount(p), Formulas.MaxBuildings(ccLevel)))
		Lib.StatRow(col, "Robot slots", tostring(Formulas.RobotSlots(p.Base.Buildings, p)))
		local gen = st and st.PowerGen or 0
		local use = st and st.PowerUse or 0
		Lib.Label("POWER", { TextSize = 14, TextColor3 = C.SubText, Size = UDim2.new(1, 0, 0, 16), Parent = col })
		local power = Lib.Bar({ Size = UDim2.new(1, 0, 0, 20), Parent = col }, use > gen and C.Bad or C.Good)
		power:Set(use > 0 and math.min(1, gen / use) or 1, string.format("%.0f kW generated / %.0f kW used", gen, use))
		Lib.Label("STORAGE", { TextSize = 14, TextColor3 = C.SubText, Size = UDim2.new(1, 0, 0, 16), Parent = col })
		local storage = Lib.Bar({ Size = UDim2.new(1, 0, 0, 20), Parent = col }, C.Accent)
		local siloKg = st and Formulas.ContentsKg(st.Silo) or 0
		local cap = st and st.SiloCap or Formulas.StorageCapacity(p.Base.Buildings)
		storage:Set(siloKg / math.max(cap, 1), string.format("%s / %s", Format.Kg(siloKg), Format.Kg(cap)))
		if center and ccLevel < Buildings.ById.command_center.MaxLevel then
			local cost = Formulas.BuildingUpgradeCost("command_center", ccLevel, p)
			local req = Buildings.Command.LevelReq[ccLevel + 1] or 1
			Lib.Button(p.Level < req and ("Upgrade needs level " .. req) or ("Upgrade Command Center " .. Format.Credits(cost)), { Size = UDim2.new(1, 0, 0, 40), Style = (p.Level >= req and p.Credits >= cost) and "Primary" or "Disabled", Parent = col }, function()
				ctx.UI:Request("UpgradeBuilding", { Uid = center.Uid })
			end)
		end
		Lib.Button("Teleport to my base", { Size = UDim2.new(1, 0, 0, 40), Style = "Secondary", Parent = col }, function()
			ctx.UI:Close()
			ctx.UI:Request("TeleportBase", {}, true)
		end)
		-- right column: status list
		local right = Lib.Frame({ Size = UDim2.new(0.5, -6, 1, 0), Position = UDim2.new(0.5, 6, 0, 0), BackgroundColor3 = C.PanelLight, Corner = 12, Parent = content })
		Lib.Label("BUILDING STATUS", { TextSize = 16, Font = Theme.FontBlack, Size = UDim2.new(1, -20, 0, 30), Position = UDim2.fromOffset(12, 6), Parent = right })
		local scroll = Lib.Scroll({ Size = UDim2.new(1, -16, 1, -44), Position = UDim2.fromOffset(8, 38), Parent = right }, { Padding = 4 })
		for i, b in p.Base.Buildings do
			local def = Buildings.ById[b.Id]
			if def and def.Category ~= "Decor" and b.Id ~= "conveyor" then
				local status = st and st.Status and (st.Status[b.Uid] or st.Status[tostring(b.Uid)]) or "Idle"
				local row = Lib.Frame({ Size = UDim2.new(1, -8, 0, 34), BackgroundColor3 = C.Panel, Corner = 6, LayoutOrder = i, Parent = scroll })
				Lib.Create("Frame", { Size = UDim2.fromOffset(10, 10), Position = UDim2.fromOffset(10, 12), BackgroundColor3 = Theme.StatusColors[status] or C.SubText, Corner = 5, Parent = row })
				Lib.Label(string.format("%s %s  Lv%d", def.Icon, def.Name, b.Level or 1), { Size = UDim2.new(0.6, 0, 1, 0), Position = UDim2.fromOffset(28, 0), TextSize = 14, Parent = row })
				Lib.Label(Theme.StatusText[status] or status, { Size = UDim2.new(0.4, -10, 1, 0), Position = UDim2.fromScale(0.6, 0), TextSize = 13, TextXAlignment = Enum.TextXAlignment.Right, TextColor3 = Theme.StatusColors[status] or C.SubText, Parent = row })
			end
		end
	end

	local function build()
		local p = Data.Profile
		local cats = Lib.Frame({ Size = UDim2.new(1, 0, 0, 36), BackgroundTransparency = 1, Parent = content })
		local grid = Lib.Scroll({ Size = UDim2.new(1, 0, 1, -44), Position = UDim2.fromOffset(0, 44), Parent = content }, { Grid = { Cell = UDim2.fromOffset(200, 196), Pad = UDim2.fromOffset(8, 8) } })
		local center = cc(p)
		local ccLevel = center and center.Level or 1
		local function fill()
			Lib.Clear(grid)
			for i, def in Buildings.List do
				if def.Category == buildCategory then
					local card = Lib.Frame({ BackgroundColor3 = C.PanelLight, Corner = 10, LayoutOrder = i, Parent = grid })
					local holder = Lib.Frame({ Size = UDim2.new(1, -8, 0, 90), Position = UDim2.fromOffset(4, 4), BackgroundColor3 = Color3.fromRGB(28, 31, 38), Corner = 8, Parent = card })
					task.defer(Viewport.Render, holder, "Building", def.Id)
					Lib.Label(def.Icon .. " " .. def.Name, { Size = UDim2.new(1, -10, 0, 20), Position = UDim2.fromOffset(6, 96), TextSize = 15, Font = Theme.FontBlack, Parent = card })
					local power = def.Power > 0 and string.format("+%d kW", def.Power) or (def.Power < 0 and string.format("%d kW", def.Power) or "")
					Lib.Label(string.format("%dx%d  %s", def.W, def.D, power), { Size = UDim2.new(1, -10, 0, 16), Position = UDim2.fromOffset(6, 116), TextSize = 12, TextColor3 = C.SubText, Parent = card })
					Lib.Label(def.Description, { Size = UDim2.new(1, -10, 0, 30), Position = UDim2.fromOffset(6, 132), TextSize = 11, TextColor3 = C.SubText, Font = Theme.FontMedium, TextYAlignment = Enum.TextYAlignment.Top, Parent = card })
					local cost = Formulas.BuildingCost(def.Id, p)
					local locked = p.Level < def.Level and ("Level " .. def.Level) or (ccLevel < def.CmdLevel and ("Command Lv " .. def.CmdLevel) or nil)
					Lib.Button(locked or ("Build " .. Format.Credits(cost)), { Size = UDim2.new(1, -10, 0, 28), Position = UDim2.new(0, 5, 1, -32), TextSize = 13, Style = locked and "Disabled" or (p.Credits >= cost and "Primary" or "Disabled"), Parent = card }, function()
						ctx.UI:Close()
						if ctx.Build then
							ctx.Build:Enter(def.Id)
						end
					end)
				end
			end
		end
		local t = Lib.Tabs(cats, Buildings.Categories, function(name)
			buildCategory = name
			fill()
		end)
		t:Select(buildCategory)
		Lib.Button("✎ Edit mode", { Size = UDim2.fromOffset(110, 34), Position = UDim2.new(1, -110, 0, 0), Style = "Secondary", TextSize = 14, Parent = cats }, function()
			ctx.UI:Close()
			if ctx.Build then
				ctx.Build:Enter(nil)
			end
		end)
	end

	local function silo()
		local p = Data.Profile
		local st = Data.BaseStatus
		local contents = st and st.Silo or p.Base.Silo
		local scroll = Lib.Scroll({ Size = UDim2.new(1, 0, 1, -60), Parent = content }, { Padding = 4 })
		local now = Data:ServerTime()
		local total = 0
		local mult = Formulas.SellMultiplier(p, true)
		local rows = {}
		for res, kg in contents do
			local def = Resources.ById[res]
			if def and kg > 0.0001 then
				local value = kg * Formulas.ResourceValue(res, p) * Formulas.MarketMod(res, now) * mult
				total += value
				table.insert(rows, { def = def, kg = kg, value = value })
			end
		end
		table.sort(rows, function(a, b)
			return a.value > b.value
		end)
		if #rows == 0 then
			Lib.Label("Your silo is empty. Store dust at your Command Center / Deposit Hopper, or let robots and production fill it.", { TextSize = 16, TextColor3 = C.SubText, Size = UDim2.new(1, 0, 0, 50), Parent = scroll })
		end
		for i, r in rows do
			local row = Lib.Frame({ Size = UDim2.new(1, -10, 0, 36), BackgroundColor3 = C.PanelLight, Corner = 8, LayoutOrder = i, Parent = scroll })
			Lib.Create("Frame", { Size = UDim2.fromOffset(8, 24), Position = UDim2.fromOffset(8, 6), BackgroundColor3 = r.def.Color, Corner = 4, Parent = row })
			Lib.Label(r.def.Name, { Size = UDim2.new(0.5, 0, 1, 0), Position = UDim2.fromOffset(24, 0), Parent = row })
			Lib.Label(Format.Kg(r.kg), { Size = UDim2.new(0.2, 0, 1, 0), Position = UDim2.fromScale(0.5, 0), Parent = row })
			Lib.Label(Format.Credits(r.value), { Size = UDim2.new(0.28, 0, 1, 0), Position = UDim2.fromScale(0.7, 0), TextXAlignment = Enum.TextXAlignment.Right, TextColor3 = C.Credit, Parent = row })
		end
		local footer = Lib.Frame({ Size = UDim2.new(1, 0, 0, 50), Position = UDim2.new(0, 0, 1, -50), BackgroundColor3 = C.PanelLight, Corner = 10, Parent = content })
		local launch = st and st.NextLaunch and string.format("  •  next launch in %ds", math.floor(st.NextLaunch)) or ""
		Lib.Label(string.format("Silo value: %s%s", Format.Credits(total), launch), { Size = UDim2.new(0.65, 0, 1, 0), Position = UDim2.fromOffset(14, 0), TextSize = 17, TextColor3 = C.Credit, Parent = footer })
		Lib.Button("Sell Silo", { Size = UDim2.fromOffset(150, 36), Position = UDim2.new(1, -160, 0, 7), Style = total > 0 and "Primary" or "Disabled" }, function()
			ctx.UI:Request("SellSilo", {})
		end).Parent = footer
	end

	local function rebuild()
		if not Data.Profile then
			return
		end
		Lib.Clear(content)
		if tab == "Overview" then
			overview()
		elseif tab == "Build" then
			build()
		else
			silo()
		end
	end
	local tabs = Lib.Tabs(win.Body, { "Overview", "Build", "Silo" }, function(name)
		tab = name
		rebuild()
	end)
	Data.Changed:Connect(function(key)
		if ctx.UI.Current == "Base" and tab ~= "Build" and (key == "Base" or key == "Credits") then
			rebuild()
		end
	end)
	local last = 0
	Data.BaseChanged:Connect(function()
		if ctx.UI.Current == "Base" and tab ~= "Build" and os.clock() - last > 4 then
			last = os.clock()
			rebuild()
		end
	end)
	function panel:Open()
		require(Shared.Net).Request("GetBaseStatus", {})
		tabs:Select(tab)
	end
	return panel
end
