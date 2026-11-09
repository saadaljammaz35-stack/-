--!nonstrict
-- Daily and weekly missions with progress bars, rewards and reset timers.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Missions = require(Shared.Config.Missions)
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local Net = require(Shared.Net)

local UI = script.Parent.Parent
local Lib = require(UI.Lib)
local Theme = require(UI.Theme)

local C = Theme.Colors

return function(ctx)
	local Data = ctx.Data
	local win = Lib.Window("Missions", nil, Color3.fromRGB(120, 220, 120))
	local panel = { Window = win }
	local scroll = Lib.Scroll({ Parent = win.Body }, { Padding = 8 })
	local timers = { Daily = 0, Weekly = 0, At = os.clock() }

	local function section(title: string, list, order: number, key: string)
		local left = math.max(0, (timers[key] or 0) - (os.clock() - timers.At))
		Lib.Label(string.format("%s  •  resets in %s", title, Format.Duration(left)), { Size = UDim2.new(1, 0, 0, 30), TextSize = 20, Font = Theme.FontBlack, LayoutOrder = order, Parent = scroll })
		for i, m in list do
			local def = Missions.ById[m.Id]
			if def then
				local row = Lib.Frame({ Size = UDim2.new(1, -10, 0, 74), BackgroundColor3 = C.PanelLight, Corner = 10, LayoutOrder = order + i, Parent = scroll })
				local target = def.Scale == "kg" and Format.Kg(m.Target) or Format.Number(m.Target)
				Lib.Label(string.format(def.Text, target), { Size = UDim2.new(0.6, 0, 0, 26), Position = UDim2.fromOffset(14, 8), TextSize = 17, Parent = row })
				local bar = Lib.Bar({ Size = UDim2.new(0.55, 0, 0, 16), Position = UDim2.fromOffset(14, 42), Parent = row }, m.Progress >= m.Target and C.Good or C.Accent)
				local prog = def.Scale == "kg" and string.format("%.1f / %.1f", m.Progress, m.Target) or string.format("%s / %s", Format.Number(m.Progress), Format.Number(m.Target))
				bar:Set(m.Progress / math.max(1e-6, m.Target), prog)
				local credits = math.floor(def.RewardCredits * Formulas.TierScale("credits", m.Tier or 1))
				Lib.Label(string.format("%s  +%d💎  +XP", Format.Credits(credits), def.RewardGems), { Size = UDim2.new(0.22, 0, 1, 0), Position = UDim2.fromScale(0.6, 0), TextSize = 14, TextColor3 = C.Credit, Parent = row })
				local done = m.Progress >= m.Target
				local btn = Lib.Button(m.Claimed and "Claimed ✓" or (done and "Claim" or "In progress"), { Size = UDim2.fromOffset(130, 40), Position = UDim2.new(1, -144, 0.5, -20), Style = m.Claimed and "Disabled" or (done and "Good" or "Disabled"), Parent = row }, function()
					ctx.UI:Request("ClaimMission", { Id = m.Id })
				end)
				local _ = btn
			end
		end
	end

	local function rebuild()
		local p = Data.Profile
		if not p then
			return
		end
		Lib.Clear(scroll)
		section("DAILY MISSIONS", p.Missions.Daily, 0, "Daily")
		section("WEEKLY MISSIONS", p.Missions.Weekly, 100, "Weekly")
	end
	Data.Changed:Connect(function(key)
		if ctx.UI.Current == "Missions" and key == "Missions" then
			rebuild()
		end
	end)
	function panel:Open()
		local r = Net.Request("GetMissionTimers", {})
		if r.Ok and r.Data then
			timers = { Daily = r.Data.Daily, Weekly = r.Data.Weekly, At = os.clock() }
		end
		rebuild()
	end
	return panel
end
