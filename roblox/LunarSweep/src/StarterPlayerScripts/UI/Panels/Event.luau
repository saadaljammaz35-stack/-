--!nonstrict
-- Seasonal event info and event shop, plus the live server event.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Progression = require(Shared.Config.Progression)
local Format = require(Shared.Util.Format)

local UI = script.Parent.Parent
local Lib = require(UI.Lib)
local Theme = require(UI.Theme)
local Viewport = require(UI.Viewport)

local C = Theme.Colors

return function(ctx)
	local Data = ctx.Data
	local win = Lib.Window("Seasonal Event", nil, Color3.fromRGB(255, 170, 60))
	local panel = { Window = win }
	local content = Lib.Frame({ Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Parent = win.Body })

	local function rebuild()
		local p = Data.Profile
		if not p then
			return
		end
		Lib.Clear(content)
		local ev = Data.ServerEvent
		local season = ev and ev.Season and Progression.EventsById[ev.Season]
		local now = Data:ServerTime()
		local live = ev and ev.Active and ev.Active.EndsAt > now and string.format("Live now: %s (%s left)", ev.Active.Name, Format.Clock(ev.Active.EndsAt - now)) or "No server event right now - meteor showers, dust storms, solar flares and debris frenzies happen every few minutes."
		Lib.Label(live, { Size = UDim2.new(1, 0, 0, 40), TextSize = 15, TextColor3 = C.SubText, Parent = content })
		if not season then
			Lib.Label("No seasonal event this month. Events: Lantern Festival (Feb-Mar), Solar Summer (Jun-Aug), Eclipse Night (Oct), Harvest Moon (Nov), Frost Festival (Dec-Jan).", { Size = UDim2.new(1, 0, 0, 80), Position = UDim2.fromOffset(0, 44), TextSize = 17, Parent = content })
			return
		end
		local tokens = p.EventTokens[season.Id] or 0
		local head = Lib.Frame({ Size = UDim2.new(1, 0, 0, 90), Position = UDim2.fromOffset(0, 44), BackgroundColor3 = C.PanelLight, Corner = 12, Stroke = { Color = season.Color, Thickness = 2 }, Parent = content })
		Lib.Label(season.TokenIcon .. "  " .. string.upper(season.Name), { Size = UDim2.new(0.7, 0, 0, 34), Position = UDim2.fromOffset(14, 8), TextSize = 26, Font = Theme.FontBlack, TextColor3 = season.Color, Parent = head })
		Lib.Label(season.Description .. string.format("  +%d%% XP during the event.", math.floor(season.XpBonus * 100)), { Size = UDim2.new(0.7, 0, 0, 40), Position = UDim2.fromOffset(14, 44), TextSize = 14, TextColor3 = C.SubText, Parent = head })
		Lib.Label(string.format("%d %s", tokens, season.TokenName), { Size = UDim2.new(0.28, 0, 1, 0), Position = UDim2.fromScale(0.7, 0), TextSize = 22, Font = Theme.FontBlack, TextXAlignment = Enum.TextXAlignment.Right, TextColor3 = season.Color, Parent = head })
		local grid = Lib.Scroll({ Size = UDim2.new(1, 0, 1, -150), Position = UDim2.fromOffset(0, 146), Parent = content }, { Grid = { Cell = UDim2.fromOffset(200, 220), Pad = UDim2.fromOffset(8, 8) } })
		for i, item in season.Shop do
			local card = Lib.Frame({ BackgroundColor3 = C.PanelLight, Corner = 10, LayoutOrder = i, Parent = grid })
			local holder = Lib.Frame({ Size = UDim2.new(1, -8, 0, 110), Position = UDim2.fromOffset(4, 4), BackgroundColor3 = Color3.fromRGB(28, 31, 38), Corner = 8, Parent = card })
			if item.Type == "Tool" or item.Type == "Container" then
				task.defer(Viewport.Render, holder, item.Type, item.Id)
			else
				Lib.Label(item.Type == "Crate" and "🎁" or (item.Type == "Gems" and "💎" or "★"), { Size = UDim2.fromScale(1, 1), TextSize = 56, TextXAlignment = Enum.TextXAlignment.Center, Parent = holder })
			end
			Lib.Label(item.Label, { Size = UDim2.new(1, -10, 0, 40), Position = UDim2.fromOffset(6, 118), TextSize = 16, Font = Theme.FontBlack, Parent = card })
			local owned = (item.Type == "Tool" and p.Tools[item.Id]) or (item.Type == "Container" and p.Containers[item.Id])
			Lib.Button(owned and "Owned" or (item.Price .. " " .. season.TokenIcon), { Size = UDim2.new(1, -10, 0, 36), Position = UDim2.new(0, 5, 1, -42), Style = owned and "Disabled" or (tokens >= item.Price and "Primary" or "Disabled"), Parent = card }, function()
				ctx.UI:Request("EventShopBuy", { Index = i })
			end)
		end
	end
	Data.Changed:Connect(function(key)
		if ctx.UI.Current == "Event" and (key == "EventTokens" or key == "Tools" or key == "Containers") then
			rebuild()
		end
	end)
	function panel:Open()
		rebuild()
	end
	return panel
end
