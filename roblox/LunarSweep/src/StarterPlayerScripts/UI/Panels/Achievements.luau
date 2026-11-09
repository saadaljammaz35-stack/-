--!nonstrict
-- Achievements with progress, earned titles you can wear.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Achievements = require(Shared.Config.Achievements)
local Format = require(Shared.Util.Format)

local UI = script.Parent.Parent
local Lib = require(UI.Lib)
local Theme = require(UI.Theme)

local C = Theme.Colors

return function(ctx)
	local Data = ctx.Data
	local win = Lib.Window("Achievements", nil, C.Credit)
	local panel = { Window = win }
	local header = Lib.Label("", { Size = UDim2.new(1, 0, 0, 28), TextSize = 16, TextColor3 = C.SubText, Parent = win.Body })
	local scroll = Lib.Scroll({ Size = UDim2.new(1, 0, 1, -34), Position = UDim2.fromOffset(0, 34), Parent = win.Body }, { Grid = { Cell = UDim2.fromOffset(268, 104), Pad = UDim2.fromOffset(8, 8) } })

	local function statValue(p, stat: string): number
		if stat == "Level" then
			return math.max(p.Level, p.Stats.Level or 0)
		elseif stat == "Rebirths" then
			return p.Rebirths
		end
		return p.Stats[stat] or 0
	end

	local function rebuild()
		local p = Data.Profile
		if not p then
			return
		end
		Lib.Clear(scroll)
		local earned = 0
		for _ in p.Achievements do
			earned += 1
		end
		header.Text = string.format("%d / %d achievements earned. Titles can be worn above your HUD level.", earned, #Achievements.List)
		for i, a in Achievements.List do
			local got = p.Achievements[a.Id] ~= nil
			local card = Lib.Frame({ BackgroundColor3 = got and Color3.fromRGB(40, 56, 44) or C.PanelLight, Corner = 10, LayoutOrder = (got and 0 or 1000) + i, Stroke = { Color = got and C.Good or C.Stroke, Thickness = 1.5 }, Parent = scroll })
			Lib.Label((got and "✅ " or "🔒 ") .. a.Name, { Size = UDim2.new(1, -16, 0, 22), Position = UDim2.fromOffset(10, 6), TextSize = 16, Font = Theme.FontBlack, Parent = card })
			Lib.Label(a.Description, { Size = UDim2.new(1, -16, 0, 34), Position = UDim2.fromOffset(10, 28), TextSize = 13, TextColor3 = C.SubText, Font = Theme.FontMedium, Parent = card })
			local v = statValue(p, a.Stat)
			local bar = Lib.Bar({ Size = UDim2.new(1, -110, 0, 12), Position = UDim2.fromOffset(10, 80), Parent = card }, got and C.Good or C.Accent)
			bar:Set(got and 1 or v / a.Goal, got and "" or (Format.Number(v) .. " / " .. Format.Number(a.Goal)))
			Lib.Label("+" .. a.Gems .. " 💎", { Size = UDim2.fromOffset(60, 20), Position = UDim2.new(1, -96, 0, 76), TextSize = 14, TextColor3 = C.Gem, Parent = card })
			if got and a.Title then
				local wearing = p.Title == a.Title
				Lib.Button(wearing and "Worn" or "Wear", { Size = UDim2.fromOffset(56, 22), Position = UDim2.new(1, -64, 0, 6), TextSize = 12, Style = wearing and "Disabled" or "Secondary", Parent = card }, function()
					ctx.UI:Request("SetTitle", { Title = a.Title }, true)
				end)
			end
		end
	end
	Data.Changed:Connect(function(key)
		if ctx.UI.Current == "Achievements" and (key == "Achievements" or key == "Title") then
			rebuild()
		end
	end)
	function panel:Open()
		rebuild()
	end
	return panel
end
