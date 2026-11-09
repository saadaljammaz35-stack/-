--!nonstrict
-- Inventory & equipment: owned gear with comparison, container contents with live market
-- value, capsule management.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Tools = require(Shared.Config.Tools)
local Containers = require(Shared.Config.Containers)
local Resources = require(Shared.Config.Resources)
local Rarity = require(Shared.Config.Rarity)
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)

local UI = script.Parent.Parent
local Lib = require(UI.Lib)
local Theme = require(UI.Theme)
local Common = require(script.Parent.Common)

local C = Theme.Colors

return function(ctx)
	local Data = ctx.Data
	local win = Lib.Window("Equipment & Inventory")
	local panel = { Window = win }
	local tab = "Equipment"

	local content = Lib.Frame({ Size = UDim2.new(1, 0, 1, -44), Position = UDim2.fromOffset(0, 44), BackgroundTransparency = 1, Parent = win.Body })

	local function equipmentView()
		local p = Data.Profile
		local left = Lib.Frame({ Size = UDim2.new(0.62, 0, 1, 0), BackgroundTransparency = 1, Parent = content })
		local scroll = Lib.Scroll({ Parent = left }, { Grid = { Cell = UDim2.fromOffset(160, 200), Pad = UDim2.fromOffset(8, 8) } })
		local detail = Common.DetailPane(content)
		local function show(kind, id)
			if kind == "Tool" then
				local def = Tools.ById[id]
				detail:Show("Tool", id, def.Name, def.Rarity, def.Description)
				local cur = Formulas.ToolStats(p, p.EquippedTool)
				local new = Formulas.ToolStats(p, id)
				local f = function(v)
					return string.format("%.1f", v)
				end
				Common.CompareRow(detail.Stats, "Cleaning width", new.Width, cur.Width, f, 1)
				Common.CompareRow(detail.Stats, "Reach", new.Reach, cur.Reach, f, 2)
				Common.CompareRow(detail.Stats, "Dust per patch", new.Depth, cur.Depth, f, 3)
				Common.CompareRow(detail.Stats, "Debris magnet", new.Magnet, cur.Magnet, f, 4)
				Lib.StatRow(detail.Stats, "Tradeable", def.Tradeable and "Yes" or "No", def.Tradeable and C.Good or C.SubText, 5)
				if p.EquippedTool == id then
					detail:SetAction("Equipped", "Disabled")
				else
					detail:SetAction("Equip", "Good", function()
						ctx.UI:Request("EquipTool", { Id = id })
					end)
				end
			else
				local def = Containers.ById[id]
				detail:Show("Container", id, def.Name, def.Rarity, def.Description)
				Common.CompareRow(detail.Stats, "Capacity", Formulas.Capacity(p, id), Formulas.Capacity(p), function(v)
					return Format.Kg(v)
				end, 1)
				Lib.StatRow(detail.Stats, "Tradeable", def.Tradeable and "Yes" or "No", def.Tradeable and C.Good or C.SubText, 2)
				if p.EquippedContainer == id then
					detail:SetAction("Equipped", "Disabled")
				else
					detail:SetAction("Equip", "Good", function()
						ctx.UI:Request("EquipContainer", { Id = id })
					end)
				end
			end
		end
		local order = 0
		for _, def in Tools.List do
			if p.Tools[def.Id] then
				order += 1
				Common.Card(scroll, { Kind = "Tool", Id = def.Id, Name = def.Name, Rarity = def.Rarity, Sub = string.format("Tool • W %d", def.Width), Badge = p.EquippedTool == def.Id and "EQUIPPED" or nil, BadgeColor = C.Good, Order = order, OnSelect = function()
					show("Tool", def.Id)
				end })
			end
		end
		for _, def in Containers.List do
			if p.Containers[def.Id] then
				order += 1
				Common.Card(scroll, { Kind = "Container", Id = def.Id, Name = def.Name, Rarity = def.Rarity, Sub = "Container • " .. Format.Kg(def.Capacity), Badge = p.EquippedContainer == def.Id and "EQUIPPED" or nil, BadgeColor = C.Good, Order = order, OnSelect = function()
					show("Container", def.Id)
				end })
			end
		end
		show("Tool", p.EquippedTool)
	end

	local function contentsView()
		local p = Data.Profile
		local now = Data:ServerTime()
		local scroll = Lib.Scroll({ Size = UDim2.new(1, 0, 1, -60), Parent = content }, { Padding = 4 })
		local total = 0
		local mult = Formulas.SellMultiplier(p)
		local rows = {}
		for res, kg in p.Contents do
			local def = Resources.ById[res]
			if def and kg > 0.0001 then
				local mod = Formulas.MarketMod(res, now)
				local value = kg * Formulas.ResourceValue(res, p) * mod * mult
				total += value
				table.insert(rows, { def = def, kg = kg, value = value, mod = mod })
			end
		end
		table.sort(rows, function(a, b)
			return a.value > b.value
		end)
		if #rows == 0 then
			Lib.Label("Your container is empty. Go sweep some moon dust!", { TextSize = 18, TextColor3 = C.SubText, Size = UDim2.new(1, 0, 0, 40), Parent = scroll })
		end
		for i, r in rows do
			local row = Lib.Frame({ Size = UDim2.new(1, -10, 0, 40), BackgroundColor3 = C.PanelLight, Corner = 8, LayoutOrder = i, Parent = scroll })
			Lib.Create("Frame", { Size = UDim2.fromOffset(8, 28), Position = UDim2.fromOffset(8, 6), BackgroundColor3 = r.def.Color, Corner = 4, Parent = row })
			Lib.Label(r.def.Name, { Size = UDim2.new(0.4, 0, 1, 0), Position = UDim2.fromOffset(24, 0), TextColor3 = Rarity.Get(r.def.Rarity).Color, Parent = row })
			Lib.Label(Format.Kg(r.kg), { Size = UDim2.new(0.2, 0, 1, 0), Position = UDim2.fromScale(0.42, 0), Parent = row })
			Lib.Label(string.format("%s%d%%", r.mod >= 1 and "▲ +" or "▼ ", math.floor((r.mod - 1) * 100 + 0.5)), { Size = UDim2.new(0.15, 0, 1, 0), Position = UDim2.fromScale(0.62, 0), TextColor3 = r.mod >= 1 and C.Good or C.Bad, Parent = row })
			Lib.Label(Format.Credits(r.value), { Size = UDim2.new(0.2, -10, 1, 0), Position = UDim2.fromScale(0.8, 0), TextXAlignment = Enum.TextXAlignment.Right, TextColor3 = C.Credit, Parent = row })
		end
		local footer = Lib.Frame({ Size = UDim2.new(1, 0, 0, 50), Position = UDim2.new(0, 0, 1, -50), BackgroundColor3 = C.PanelLight, Corner = 10, Parent = content })
		Lib.Label(string.format("Estimated value: %s  (x%.2f sell bonus)", Format.Credits(total), mult), { Size = UDim2.new(0.6, 0, 1, 0), Position = UDim2.fromOffset(14, 0), TextSize = 17, TextColor3 = C.Credit, Parent = footer })
		local canUplink = (p.Upgrades.uplink_deposit or 0) > 0 or (p.Perks.uplink_perk or 0) > 0
		Lib.Button(canUplink and "Uplink Sell" or "Sell at Exchange", { Size = UDim2.fromOffset(150, 36), Position = UDim2.new(1, -320, 0, 7), Style = canUplink and "Primary" or "Disabled" }, function()
			ctx.UI:Request("Deposit", { Remote = true })
		end).Parent = footer
		Lib.Button("Pack Capsule", { Size = UDim2.fromOffset(150, 36), Position = UDim2.new(1, -160, 0, 7), Style = "Secondary" }, function()
			require(Shared.Net).Event("PackCapsule"):FireServer()
		end).Parent = footer
	end

	local function capsulesView()
		local caps = Players.LocalPlayer:GetAttribute("Capsules") or 0
		local box = Lib.Frame({ Size = UDim2.new(1, 0, 0, 200), BackgroundColor3 = C.PanelLight, Corner = 12, Parent = content, Padding = 16, List = { Padding = 10 } })
		Lib.Label(string.format("You have %d capsule(s) out on the moon.", caps), { TextSize = 20, Size = UDim2.new(1, 0, 0, 28), Parent = box })
		Lib.Label("Capsules keep your dust safe while you keep cleaning. Carry them to the Dust Exchange or your base hopper, let a Capsule Hauler robot fetch them, build a Capsule Catcher, or recall them all now (fee reduced by Capsule Tether upgrades).", { TextSize = 15, TextColor3 = C.SubText, Size = UDim2.new(1, 0, 0, 70), Parent = box })
		Lib.Button("Recall all capsules to silo", { Size = UDim2.fromOffset(280, 40), Style = caps > 0 and "Primary" or "Disabled", Parent = box }, function()
			ctx.UI:Request("RecallCapsules", {})
		end)
	end

	local tabs
	local function rebuild()
		if not Data.Profile then
			return
		end
		Lib.Clear(content)
		if tab == "Equipment" then
			equipmentView()
		elseif tab == "Container" then
			contentsView()
		else
			capsulesView()
		end
	end
	tabs = Lib.Tabs(win.Body, { "Equipment", "Container", "Capsules" }, function(name)
		tab = name
		rebuild()
	end)
	Data.Changed:Connect(function(key)
		if ctx.UI.Current == "Inventory" and (key == "Contents" or key == "EquippedTool" or key == "EquippedContainer" or key == "Tools" or key == "Containers") then
			rebuild()
		end
	end)
	function panel:Open()
		tabs:Select(tab)
	end
	return panel
end
