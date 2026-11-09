--!nonstrict
-- Global and in-server leaderboards.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Format = require(Shared.Util.Format)
local Net = require(Shared.Net)

local UI = script.Parent.Parent
local Lib = require(UI.Lib)
local Theme = require(UI.Theme)

local C = Theme.Colors

return function(ctx)
	local win = Lib.Window("Leaderboards")
	local panel = { Window = win }
	local key = "Kg"
	local scope = "Global"
	local data = nil
	local list = Lib.Scroll({ Size = UDim2.new(1, 0, 1, -90), Position = UDim2.fromOffset(0, 90), Parent = win.Body }, { Padding = 4 })
	local scopeBar = Lib.Frame({ Size = UDim2.new(1, 0, 0, 36), Position = UDim2.fromOffset(0, 46), BackgroundTransparency = 1, Parent = win.Body })

	local function render()
		Lib.Clear(list)
		if not data then
			Lib.Label("Loading...", { Parent = list })
			return
		end
		local rows = (scope == "Global" and data.Global or data.Server)[key] or {}
		if #rows == 0 then
			Lib.Label(scope == "Global" and "Global boards need a published place with DataStores enabled. Showing nothing yet." or "No data yet.", { Size = UDim2.new(1, 0, 0, 40), TextColor3 = C.SubText, Parent = list })
		end
		local me = Players.LocalPlayer.UserId
		for i, e in rows do
			local row = Lib.Frame({ Size = UDim2.new(1, -10, 0, 40), BackgroundColor3 = e.UserId == me and Color3.fromRGB(60, 50, 30) or C.PanelLight, Corner = 8, LayoutOrder = i, Parent = list })
			local medal = i == 1 and "🥇" or (i == 2 and "🥈" or (i == 3 and "🥉" or ("#" .. i)))
			Lib.Label(medal, { Size = UDim2.fromOffset(60, 40), Position = UDim2.fromOffset(10, 0), TextSize = i <= 3 and 24 or 16, Parent = row })
			Lib.Label(e.Name, { Size = UDim2.new(0.6, 0, 1, 0), Position = UDim2.fromOffset(70, 0), TextSize = 17, Parent = row })
			Lib.Label(Format.Number(e.Value) .. (key == "Kg" and " kg" or ""), { Size = UDim2.new(0.3, 0, 1, 0), Position = UDim2.new(0.7, -14, 0, 0), TextXAlignment = Enum.TextXAlignment.Right, TextSize = 17, TextColor3 = C.Credit, Parent = row })
		end
	end
	local tabs = Lib.Tabs(win.Body, { "Kg", "Earned", "Sectors", "Rebirths" }, function(name)
		key = name
		render()
	end)
	local scopeTabs = Lib.Tabs(scopeBar, { "Global", "This Server" }, function(name)
		scope = name == "Global" and "Global" or "Server"
		render()
	end)
	function panel:Open()
		task.spawn(function()
			local r = Net.Request("GetLeaderboards", {})
			if r.Ok then
				data = r.Data
			end
			render()
		end)
		tabs:Select(key)
		scopeTabs:Select(scope == "Global" and "Global" or "This Server")
	end
	return panel
end
