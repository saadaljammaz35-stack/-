--!nonstrict
-- Supply Wall: buy tools and containers, compare against what you have equipped.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Tools = require(Shared.Config.Tools)
local Containers = require(Shared.Config.Containers)
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)

local UI = script.Parent.Parent
local Lib = require(UI.Lib)
local Theme = require(UI.Theme)
local Common = require(script.Parent.Common)

local C = Theme.Colors

return function(ctx)
	local Data = ctx.Data
	local win = Lib.Window("Supply Wall")
	local panel = { Window = win }
	local tab = "Tools"
	local selected: string? = nil

	local left = Lib.Frame({ Size = UDim2.new(0.62, 0, 1, 0), BackgroundTransparency = 1, Parent = win.Body })
	local tabs
	local grid = Lib.Scroll({ Size = UDim2.new(1, 0, 1, -44), Position = UDim2.fromOffset(0, 44), Parent = left }, { Grid = { Cell = UDim2.fromOffset(160, 200), Pad = UDim2.fromOffset(8, 8) } })
	local detail = Common.DetailPane(win.Body)

	local function toolDetail(id: string)
		local p = Data.Profile
		local def = Tools.ById[id]
		detail:Show("Tool", id, def.Name, def.Rarity, def.Description)
		local cur = Formulas.ToolStats(p, p.EquippedTool)
		local new = Formulas.ToolStats(p, id)
		local oneDec = function(v)
			return string.format("%.1f", v)
		end
		Common.CompareRow(detail.Stats, "Cleaning width", new.Width, cur.Width, oneDec, 1)
		Common.CompareRow(detail.Stats, "Reach", new.Reach, cur.Reach, oneDec, 2)
		Common.CompareRow(detail.Stats, "Dust per patch", new.Depth, cur.Depth, function(v)
			return string.format("x%.2f", v)
		end, 3)
		Common.CompareRow(detail.Stats, "Debris magnet", new.Magnet, cur.Magnet, oneDec, 4)
		if new.Luck > 0 or cur.Luck > 0 then
			Common.CompareRow(detail.Stats, "Luck", new.Luck * 100, cur.Luck * 100, function(v)
				return string.format("%d%%", math.floor(v))
			end, 5)
		end
		Lib.StatRow(detail.Stats, "Level required", tostring(def.Level), p.Level >= def.Level and C.Text or C.Bad, 6)
		if p.Tools[id] then
			if p.EquippedTool == id then
				detail:SetAction("Equipped", "Disabled")
			else
				detail:SetAction("Equip", "Good", function()
					ctx.UI:Request("EquipTool", { Id = id })
				end)
			end
		elseif def.Source ~= "shop" then
			detail:SetAction(def.Source == "crate" and "Found in crates" or "Event exclusive", "Disabled")
		elseif p.Level < def.Level then
			detail:SetAction("Locked - Level " .. def.Level, "Disabled")
		else
			local price = Formulas.ShopPrice(def.Price, p)
			detail:SetAction("Buy " .. Format.Credits(price), p.Credits >= price and "Primary" or "Disabled", function()
				ctx.UI:Request("BuyTool", { Id = id })
			end)
		end
	end

	local function containerDetail(id: string)
		local p = Data.Profile
		local def = Containers.ById[id]
		detail:Show("Container", id, def.Name, def.Rarity, def.Description)
		local cur = Formulas.Capacity(p)
		local new = Formulas.Capacity(p, id)
		Common.CompareRow(detail.Stats, "Capacity", new, cur, function(v)
			return Format.Kg(v)
		end, 1)
		if def.SpeedBonus then
			Lib.StatRow(detail.Stats, "Speed bonus", "+" .. math.floor(def.SpeedBonus * 100) .. "%", C.Good, 2)
		end
		Lib.StatRow(detail.Stats, "Level required", tostring(def.Level), p.Level >= def.Level and C.Text or C.Bad, 3)
		if p.Containers[id] then
			if p.EquippedContainer == id then
				detail:SetAction("Equipped", "Disabled")
			else
				detail:SetAction("Equip", "Good", function()
					ctx.UI:Request("EquipContainer", { Id = id })
				end)
			end
		elseif def.Source ~= "shop" then
			detail:SetAction(def.Source == "crate" and "Found in crates" or "Event exclusive", "Disabled")
		elseif p.Level < def.Level then
			detail:SetAction("Locked - Level " .. def.Level, "Disabled")
		else
			local price = Formulas.ShopPrice(def.Price, p)
			detail:SetAction("Buy " .. Format.Credits(price), p.Credits >= price and "Primary" or "Disabled", function()
				ctx.UI:Request("BuyContainer", { Id = id })
			end)
		end
	end

	local function rebuild()
		local p = Data.Profile
		if not p then
			return
		end
		Lib.Clear(grid)
		local list = tab == "Tools" and Tools.List or Containers.List
		local owned = tab == "Tools" and p.Tools or p.Containers
		local equipped = tab == "Tools" and p.EquippedTool or p.EquippedContainer
		local firstUnowned = nil
		for i, def in list do
			local visible = def.Source == "shop" or def.Source == "starter" or owned[def.Id]
			if visible then
				local badge, badgeColor
				if def.Id == equipped then
					badge, badgeColor = "EQUIPPED", C.Good
				elseif owned[def.Id] then
					badge, badgeColor = "OWNED", Color3.fromRGB(70, 110, 200)
				elseif p.Level < def.Level then
					badge, badgeColor = "LV " .. def.Level, Color3.fromRGB(90, 90, 100)
				end
				local sub
				if tab == "Tools" then
					sub = string.format("W %d • R %.0f • x%.1f", def.Width, def.Reach, def.Depth)
				else
					sub = Format.Kg(def.Capacity)
				end
				if not owned[def.Id] and def.Source == "shop" then
					sub ..= "\n" .. Format.Credits(Formulas.ShopPrice(def.Price, p))
					firstUnowned = firstUnowned or def.Id
				end
				Common.Card(grid, {
					Kind = tab == "Tools" and "Tool" or "Container",
					Id = def.Id,
					Name = def.Name,
					Rarity = def.Rarity,
					Sub = sub,
					Badge = badge,
					BadgeColor = badgeColor,
					Order = i,
					Dim = p.Level < def.Level and not owned[def.Id],
					OnSelect = function()
						selected = def.Id
						if tab == "Tools" then
							toolDetail(def.Id)
						else
							containerDetail(def.Id)
						end
					end,
				})
			end
		end
		local pick = selected
		if not pick or not (tab == "Tools" and Tools.ById[pick] or Containers.ById[pick]) then
			pick = firstUnowned or equipped
		end
		selected = pick
		if tab == "Tools" then
			toolDetail(pick)
		else
			containerDetail(pick)
		end
	end

	tabs = Lib.Tabs(left, { "Tools", "Containers" }, function(name)
		tab = name
		selected = nil
		rebuild()
	end)

	Data:Watch({ "Tools", "Containers", "EquippedTool", "EquippedContainer", "Credits", "Level", "Upgrades" }, function()
		if ctx.UI.Current == "Shop" then
			if selected then
				if tab == "Tools" and Tools.ById[selected] then
					toolDetail(selected)
				elseif Containers.ById[selected] then
					containerDetail(selected)
				end
			end
		end
	end)

	function panel:Open()
		tabs:Select(tab)
	end
	function panel:Refresh()
		rebuild()
	end
	ctx.Data.Changed:Connect(function(key)
		if ctx.UI.Current == "Shop" and (key == "Tools" or key == "Containers" or key == "EquippedTool" or key == "EquippedContainer" or key == "Level") then
			rebuild()
		end
	end)
	return panel
end
