--!nonstrict
-- 7-day login reward calendar.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Progression = require(Shared.Config.Progression)

local UI = script.Parent.Parent
local Lib = require(UI.Lib)
local Theme = require(UI.Theme)

local C = Theme.Colors

return function(ctx)
	local Data = ctx.Data
	local win = Lib.Window("Daily Rewards", UDim2.fromOffset(820, 420), C.Gem)
	local panel = { Window = win }
	local info = Lib.Label("", { Size = UDim2.new(1, 0, 0, 30), TextSize = 17, Parent = win.Body })
	local row = Lib.Frame({ Size = UDim2.new(1, 0, 0, 200), Position = UDim2.fromOffset(0, 40), BackgroundTransparency = 1, List = { Horizontal = true, Padding = 8, HAlign = Enum.HorizontalAlignment.Center }, Parent = win.Body })
	local claim = Lib.Button("Claim", { Size = UDim2.fromOffset(260, 50), Position = UDim2.new(0.5, -130, 1, -60), TextSize = 22, Parent = win.Body }, function()
		ctx.UI:Request("ClaimLogin", {})
	end)

	local ICONS = { Credits = "💰", Gems = "💎", Boost = "★", Crate = "🎁" }

	local function rebuild()
		local p = Data.Profile
		if not p then
			return
		end
		Lib.Clear(row)
		local login = p.Login
		info.Text = string.format("Login streak: %d day(s). Come back every day - missing a day resets the streak.", login.Streak)
		for i, r in Progression.LoginRewards do
			local isToday = i == login.DayIndex
			local done = i < login.DayIndex or (isToday and not login.Pending)
			local card = Lib.Frame({ Size = UDim2.fromOffset(104, 190), BackgroundColor3 = isToday and Color3.fromRGB(50, 70, 100) or C.PanelLight, Corner = 12, Stroke = { Color = isToday and C.Gem or C.Stroke, Thickness = isToday and 3 or 1 }, LayoutOrder = i, Parent = row })
			Lib.Label("DAY " .. i, { Size = UDim2.new(1, 0, 0, 26), Position = UDim2.fromOffset(0, 8), TextSize = 16, Font = Theme.FontBlack, TextXAlignment = Enum.TextXAlignment.Center, Parent = card })
			Lib.Label(ICONS[r.Type] or "🎁", { Size = UDim2.new(1, 0, 0, 60), Position = UDim2.fromOffset(0, 40), TextSize = 42, TextXAlignment = Enum.TextXAlignment.Center, Parent = card })
			Lib.Label(r.Label, { Size = UDim2.new(1, -8, 0, 50), Position = UDim2.fromOffset(4, 104), TextSize = 13, TextXAlignment = Enum.TextXAlignment.Center, Parent = card })
			if done then
				Lib.Label("✓", { Size = UDim2.new(1, 0, 0, 30), Position = UDim2.new(0, 0, 1, -34), TextSize = 26, TextColor3 = C.Good, TextXAlignment = Enum.TextXAlignment.Center, Parent = card })
			end
		end
		claim.Text = login.Pending and "Claim Day " .. login.DayIndex or "Come back tomorrow"
		Lib.StyleButton(claim, login.Pending and "Good" or "Disabled")
	end
	Data.Changed:Connect(function(key)
		if ctx.UI.Current == "Daily" and key == "Login" then
			rebuild()
		end
	end)
	function panel:Open()
		rebuild()
	end
	return panel
end
