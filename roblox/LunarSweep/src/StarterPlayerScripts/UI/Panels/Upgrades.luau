--!nonstrict
-- Upgrade Terminal: 22 multi-level upgrades in 7 categories.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Upgrades = require(Shared.Config.Upgrades)
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)

local UI = script.Parent.Parent
local Lib = require(UI.Lib)
local Theme = require(UI.Theme)

local C = Theme.Colors

local function effectText(def, level: number): string
	local v = def.Effect * level
	if def.Format == "pct" then
		return string.format("%+d%%", math.floor(v * 100 + 0.5) * (def.Id == "supplier_network" and -1 or 1))
	elseif def.Format == "studs" then
		return string.format("+%.1f studs", v)
	elseif def.Format == "toggle" then
		return level > 0 and "Active" or "Inactive"
	end
	return "+" .. tostring(v)
end

return function(ctx)
	local Data = ctx.Data
	local win = Lib.Window("Upgrade Terminal", nil, Color3.fromRGB(70, 140, 255))
	local panel = { Window = win }
	local category = "Tools"
	local list = Lib.Scroll({ Size = UDim2.new(1, 0, 1, -48), Position = UDim2.fromOffset(0, 48), Parent = win.Body }, { Padding = 8 })
	local summary = Lib.Label("", { Size = UDim2.fromOffset(300, 36), Position = UDim2.new(1, -300, 0, 0), TextXAlignment = Enum.TextXAlignment.Right, TextColor3 = C.SubText, Parent = win.Body })

	local function rebuild()
		local p = Data.Profile
		if not p then
			return
		end
		Lib.Clear(list)
		local total, owned = 0, 0
		for _, def in Upgrades.List do
			total += def.MaxLevel
			owned += p.Upgrades[def.Id] or 0
		end
		summary.Text = string.format("%d / %d upgrade levels installed", owned, total)
		for i, def in Upgrades.List do
			if def.Category == category then
				local level = p.Upgrades[def.Id] or 0
				local row = Lib.Frame({ Size = UDim2.new(1, -10, 0, 78), BackgroundColor3 = C.PanelLight, Corner = 10, LayoutOrder = i, Parent = list })
				Lib.Label(def.Icon, { Size = UDim2.fromOffset(56, 78), TextSize = 30, TextXAlignment = Enum.TextXAlignment.Center, Parent = row })
				Lib.Label(def.Name, { Size = UDim2.new(0.4, 0, 0, 26), Position = UDim2.fromOffset(60, 8), TextSize = 19, Font = Theme.FontBlack, Parent = row })
				Lib.Label(def.Description, { Size = UDim2.new(0.5, 0, 0, 36), Position = UDim2.fromOffset(60, 34), TextSize = 14, TextColor3 = C.SubText, Font = Theme.FontMedium, Parent = row })
				local pips = Lib.Pips(row, level, def.MaxLevel)
				pips.Position = UDim2.new(0.55, 0, 0, 14)
				Lib.Label("Now: " .. effectText(def, level) .. (level < def.MaxLevel and ("  →  " .. effectText(def, level + 1)) or ""), { Size = UDim2.new(0.25, 0, 0, 22), Position = UDim2.new(0.55, 0, 0, 34), TextSize = 14, TextColor3 = C.Good, Parent = row })
				local btn
				if level >= def.MaxLevel then
					btn = Lib.Button("MAXED", { Style = "Disabled" })
				elseif p.Level < def.Level then
					btn = Lib.Button("Level " .. def.Level, { Style = "Disabled" })
				else
					local cost = Formulas.UpgradeCost(def.Id, level, p)
					btn = Lib.Button("Install " .. Format.Credits(cost), { Style = p.Credits >= cost and "Primary" or "Disabled" }, function()
						ctx.UI:Request("BuyUpgrade", { Id = def.Id })
					end)
				end
				btn.Size = UDim2.fromOffset(170, 44)
				btn.Position = UDim2.new(1, -184, 0.5, -22)
				btn.Parent = row
			end
		end
	end

	local tabs = Lib.Tabs(win.Body, Upgrades.Categories, function(name)
		category = name
		rebuild()
	end)
	tabs.Bar.Size = UDim2.new(1, -310, 0, 36)
	for _, b in tabs.Buttons do
		b.Size = UDim2.fromOffset(80, 34)
		b.TextSize = 13
	end
	Data.Changed:Connect(function(key)
		if ctx.UI.Current == "Upgrades" and (key == "Upgrades" or key == "Credits" or key == "Level") then
			rebuild()
		end
	end)
	function panel:Open()
		tabs:Select(category)
	end
	return panel
end
