--!nonstrict
-- Re-Launch (prestige) and the Cosmic Star perk shop.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local Progression = require(Shared.Config.Progression)

local UI = script.Parent.Parent
local Lib = require(UI.Lib)
local Theme = require(UI.Theme)

local C = Theme.Colors

return function(ctx)
	local Data = ctx.Data
	local win = Lib.Window("Re-Launch Portal", nil, Color3.fromRGB(180, 100, 255))
	local panel = { Window = win }
	local left = Lib.Frame({ Size = UDim2.new(0.45, -6, 1, 0), BackgroundColor3 = C.PanelLight, Corner = 12, Padding = 14, List = { Padding = 8 }, Parent = win.Body })
	local right = Lib.Frame({ Size = UDim2.new(0.55, -6, 1, 0), Position = UDim2.new(0.45, 6, 0, 0), BackgroundTransparency = 1, Parent = win.Body })
	local perks = Lib.Scroll({ Size = UDim2.new(1, 0, 1, -34), Position = UDim2.fromOffset(0, 34), Parent = right }, { Padding = 6 })
	local starsLabel = Lib.Label("", { Size = UDim2.new(1, 0, 0, 30), TextSize = 18, Font = Theme.FontBlack, TextColor3 = C.Star, Parent = right })

	local function rebuild()
		local p = Data.Profile
		if not p then
			return
		end
		Lib.Clear(left)
		local lvl, credits = Formulas.RebirthRequirement(p.Rebirths)
		local stars = Formulas.RebirthStars(p.Level, p.Rebirths)
		local R = Progression.Rebirth
		Lib.Label("RE-LAUNCH #" .. (p.Rebirths + 1), { TextSize = 22, Font = Theme.FontBlack, Size = UDim2.new(1, 0, 0, 30), Parent = left })
		Lib.Label("Reset your level, credits, shop gear and upgrades for Cosmic Stars and permanent bonuses. You keep robots, your base, gems, achievements and crate/event gear.", { TextSize = 14, TextColor3 = C.SubText, Font = Theme.FontMedium, Size = UDim2.new(1, 0, 0, 76), Parent = left })
		Lib.StatRow(left, "Level required", string.format("%d (you: %d)", lvl, p.Level), p.Level >= lvl and C.Good or C.Bad)
		Lib.StatRow(left, "Credits required", Format.Credits(credits), p.Credits >= credits and C.Good or C.Bad)
		Lib.StatRow(left, "Cosmic Stars reward", "+" .. stars .. " ✦", C.Star)
		Lib.StatRow(left, "Credits bonus after", string.format("+%d%%", math.floor((p.Rebirths + 1) * R.CreditsMultPer * 100)), C.Good)
		Lib.StatRow(left, "XP bonus after", string.format("+%d%%", math.floor((p.Rebirths + 1) * R.XpMultPer * 100)), C.Good)
		local ready = p.Level >= lvl and p.Credits >= credits
		Lib.Button(ready and "RE-LAUNCH" or "Requirements not met", { Size = UDim2.new(1, 0, 0, 48), TextSize = 20, Style = ready and "Primary" or "Disabled", Parent = left }, function()
			Lib.Confirm(ctx.Root, "Re-launch now? Your level, credits, shop gear and upgrades will reset.", function()
				ctx.UI:Request("Rebirth", {})
			end, "Re-Launch")
		end)
		starsLabel.Text = string.format("COSMIC STAR PERKS  •  %d ✦ available", p.Stars)
		Lib.Clear(perks)
		for i, def in Progression.Perks do
			local lv = p.Perks[def.Id] or 0
			local row = Lib.Frame({ Size = UDim2.new(1, -10, 0, 64), BackgroundColor3 = C.PanelLight, Corner = 10, LayoutOrder = i, Parent = perks })
			Lib.Label(def.Icon .. "  " .. def.Name, { Size = UDim2.new(0.6, 0, 0, 24), Position = UDim2.fromOffset(12, 6), TextSize = 16, Font = Theme.FontBlack, Parent = row })
			Lib.Label(def.Description, { Size = UDim2.new(0.62, 0, 0, 28), Position = UDim2.fromOffset(12, 30), TextSize = 12, TextColor3 = C.SubText, Font = Theme.FontMedium, Parent = row })
			local pips = Lib.Pips(row, lv, def.MaxLevel, C.Star)
			pips.Position = UDim2.new(0.62, 0, 0, 10)
			if lv >= def.MaxLevel then
				Lib.Button("MAX", { Size = UDim2.fromOffset(110, 34), Position = UDim2.new(1, -120, 0, 24), Style = "Disabled", Parent = row })
			else
				local cost = Formulas.PerkCost(def.Id, lv)
				Lib.Button(cost .. " ✦", { Size = UDim2.fromOffset(110, 34), Position = UDim2.new(1, -120, 0, 24), Style = p.Stars >= cost and "Primary" or "Disabled", Parent = row }, function()
					ctx.UI:Request("BuyPerk", { Id = def.Id })
				end)
			end
		end
	end
	Data.Changed:Connect(function(key)
		if ctx.UI.Current == "Rebirth" and (key == "Stars" or key == "Perks" or key == "Level" or key == "Credits" or key == "Rebirths") then
			rebuild()
		end
	end)
	function panel:Open()
		rebuild()
	end
	return panel
end
