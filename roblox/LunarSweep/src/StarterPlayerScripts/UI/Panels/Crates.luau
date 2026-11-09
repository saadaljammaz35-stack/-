--!nonstrict
-- Crate dispenser with full odds disclosure and an unboxing roll animation.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Crates = require(Shared.Config.Crates)
local Tools = require(Shared.Config.Tools)
local Containers = require(Shared.Config.Containers)
local Robots = require(Shared.Config.Robots)
local Rarity = require(Shared.Config.Rarity)
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)

local UI = script.Parent.Parent
local Lib = require(UI.Lib)
local Theme = require(UI.Theme)

local C = Theme.Colors

local function rewardText(r, tier: number): (string, string)
	if r.Type == "Credits" then
		return Format.Credits(r.Amount * Formulas.CrateCreditScale(tier)), "Common"
	elseif r.Type == "Gems" then
		return r.Amount .. " Gems", "Uncommon"
	elseif r.Type == "Boost" then
		local b = Crates.Boosts[r.Id]
		return string.format("%s (%dm)", b and b.Name or r.Id, r.Minutes or 10), "Uncommon"
	elseif r.Type == "Tool" then
		local d = Tools.ById[r.Id]
		return d.Name, d.Rarity
	elseif r.Type == "Container" then
		local d = Containers.ById[r.Id]
		return d.Name, d.Rarity
	elseif r.Type == "Robot" then
		local d = Robots.ById[r.Id]
		return d.Name .. " (robot)", d.Rarity
	elseif r.Type == "EventTool" then
		return "Event tool", "Epic"
	elseif r.Type == "EventContainer" then
		return "Event container", "Epic"
	end
	return r.Type, "Common"
end

return function(ctx)
	local Data = ctx.Data
	local win = Lib.Window("Cosmic Crates", nil, Color3.fromRGB(200, 120, 255))
	local panel = { Window = win }
	local selected = "supply_crate"
	local leftCol = Lib.Frame({ Size = UDim2.new(0.38, 0, 1, 0), BackgroundTransparency = 1, List = { Padding = 8 }, Parent = win.Body })
	local right = Lib.Frame({ Size = UDim2.new(0.62, -10, 1, 0), Position = UDim2.new(0.38, 10, 0, 0), BackgroundColor3 = C.PanelLight, Corner = 12, Parent = win.Body })
	local oddsList = Lib.Scroll({ Size = UDim2.new(1, -20, 1, -170), Position = UDim2.fromOffset(10, 44), Parent = right }, { Padding = 3 })
	local title = Lib.Label("", { Size = UDim2.new(1, -20, 0, 30), Position = UDim2.fromOffset(10, 8), TextSize = 20, Font = Theme.FontBlack, Parent = right })
	local roll = Lib.Frame({ Size = UDim2.new(1, -20, 0, 60), Position = UDim2.new(0, 10, 1, -120), BackgroundColor3 = Color3.fromRGB(20, 22, 28), Corner = 8, ClipsDescendants = true, Parent = right })
	local rollLabel = Lib.Label("", { Size = UDim2.fromScale(1, 1), TextSize = 22, Font = Theme.FontBlack, TextXAlignment = Enum.TextXAlignment.Center, Parent = roll })
	local openBtn = Lib.Button("Open", { Size = UDim2.new(0.5, -15, 0, 46), Position = UDim2.new(0, 10, 1, -54), TextSize = 18, Parent = right })
	local freeBtn = Lib.Button("Open free", { Size = UDim2.new(0.5, -15, 0, 46), Position = UDim2.new(0.5, 5, 1, -54), TextSize = 18, Style = "Good", Parent = right })
	local rolling = false

	local function price(crate)
		local p = Data.Profile
		if crate.ScalePrice then
			return math.floor(crate.Price * Formulas.CrateCreditScale(Formulas.Tier(p)))
		end
		return crate.Price
	end

	local function currencyIcon(crate): string
		return crate.Currency == "Credits" and "💰" or (crate.Currency == "Gems" and "💎" or "🎟")
	end

	local function showCrate()
		local p = Data.Profile
		local crate = Crates.ById[selected]
		title.Text = crate.Name .. " — " .. crate.Description
		title.TextColor3 = crate.Color
		Lib.Clear(oddsList)
		local total = 0
		for _, r in crate.Pool do
			total += r.Weight
		end
		local tier = Formulas.Tier(p)
		for i, r in crate.Pool do
			local text, rar = rewardText(r, tier)
			local row = Lib.Frame({ Size = UDim2.new(1, -8, 0, 26), BackgroundTransparency = 1, LayoutOrder = i, Parent = oddsList })
			Lib.Label(text, { Size = UDim2.new(0.7, 0, 1, 0), TextSize = 15, TextColor3 = Rarity.Get(rar).Color, Parent = row })
			Lib.Label(string.format("%.2f%%", r.Weight / total * 100), { Size = UDim2.new(0.3, 0, 1, 0), Position = UDim2.fromScale(0.7, 0), TextXAlignment = Enum.TextXAlignment.Right, TextSize = 15, Parent = row })
		end
		if crate.PityEvery then
			Lib.Label(string.format("Pity: guaranteed %s in %d opens (%d/%d)", table.concat(crate.PityRarities, "/"), crate.PityEvery, p.Crates.Pity[crate.Id] or 0, crate.PityEvery), { Size = UDim2.new(1, -8, 0, 24), TextSize = 13, TextColor3 = C.Gem, LayoutOrder = 100, Parent = oddsList })
		end
		local cost = price(crate)
		openBtn.Text = string.format("Open %s %s", currencyIcon(crate), Format.Number(cost))
		local free = p.Crates.Free and p.Crates.Free[crate.Id] or 0
		freeBtn.Visible = free > 0
		freeBtn.Text = string.format("Open free (%d)", free)
	end

	local function doOpen(free: boolean)
		if rolling then
			return
		end
		rolling = true
		local crate = Crates.ById[selected]
		local tier = Formulas.Tier(Data.Profile)
		-- start rolling visuals while the request is in flight
		local spinning = true
		task.spawn(function()
			local i = 0
			while spinning do
				i += 1
				local r = crate.Pool[(i % #crate.Pool) + 1]
				local text, rar = rewardText(r, tier)
				rollLabel.Text = text
				rollLabel.TextColor3 = Rarity.Get(rar).Color
				if ctx.Sound then
					ctx.Sound:Play("crate_roll")
				end
				task.wait(0.07 + i * 0.004)
			end
		end)
		local reply = ctx.UI:Request("OpenCrate", { Id = selected, Free = free }, true)
		task.wait(0.9)
		spinning = false
		if reply.Ok and reply.Data then
			local rar = Rarity.Get(reply.Data.Rarity or "Common")
			rollLabel.Text = "★ " .. (reply.Data.Label or "") .. " ★"
			rollLabel.TextColor3 = rar.Color
		else
			rollLabel.Text = reply.Msg or "Could not open"
			rollLabel.TextColor3 = C.Bad
		end
		rolling = false
		showCrate()
	end
	openBtn.Activated:Connect(function()
		doOpen(false)
	end)
	freeBtn.Activated:Connect(function()
		doOpen(true)
	end)

	local function buildLeft()
		Lib.Clear(leftCol)
		local season = Data.ServerEvent and Data.ServerEvent.Season
		for i, crate in Crates.List do
			if crate.Currency ~= "EventTokens" or season then
				local b = Lib.Button("", { Size = UDim2.new(1, 0, 0, 92), Style = selected == crate.Id and "Primary" or "Ghost", LayoutOrder = i, Parent = leftCol }, function()
					selected = crate.Id
					buildLeft()
					showCrate()
				end)
				Lib.Label("🎁", { Size = UDim2.fromOffset(70, 92), TextSize = 44, TextXAlignment = Enum.TextXAlignment.Center, Parent = b })
				Lib.Label(crate.Name, { Size = UDim2.new(1, -80, 0, 30), Position = UDim2.fromOffset(76, 14), TextSize = 19, Font = Theme.FontBlack, TextColor3 = crate.Color, Parent = b })
				Lib.Label(string.format("%s %s", currencyIcon(crate), Format.Number(price(crate))), { Size = UDim2.new(1, -80, 0, 24), Position = UDim2.fromOffset(76, 48), TextSize = 16, Parent = b })
			end
		end
	end

	Data.Changed:Connect(function(key)
		if ctx.UI.Current == "Crates" and not rolling and (key == "Crates" or key == "Credits" or key == "Gems") then
			showCrate()
		end
	end)
	function panel:Open()
		rollLabel.Text = ""
		buildLeft()
		showCrate()
	end
	return panel
end
