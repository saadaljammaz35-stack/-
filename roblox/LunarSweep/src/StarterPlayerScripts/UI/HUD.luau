--!nonstrict
-- Heads-up display: currencies, level, zone & sector banner, server events, community
-- goal, boosts, menu buttons, container gauge, tool slot, mobile controls, tutorial.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local SocialService = game:GetService("SocialService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local Zones = require(Shared.Config.Zones)
local Crates = require(Shared.Config.Crates)
local Progression = require(Shared.Config.Progression)
local Tools = require(Shared.Config.Tools)
local Missions = require(Shared.Config.Missions)
local Net = require(Shared.Net)
local Lib = require(script.Parent.Lib)
local Theme = require(script.Parent.Theme)

local C = Theme.Colors
local player = Players.LocalPlayer

local HUD = {}

local TUTORIAL = {
	"Press 1 (or tap the tool button) to take out your Toothbrush.",
	"Hold the left mouse button (or the SWEEP button) to clean the dust in front of you.",
	"Fill your container, then walk to the Dust Exchange in the colony and press E to sell.",
	"Spend your credits at the Supply Wall (new tools) or the Upgrade Terminal.",
	"Press Q to pack a full container into a capsule and keep cleaning.",
	"Open the Base menu (B) to build your own production base on your plot.",
	"Buy a robot at the Robot Bay - it cleans sectors for you!",
	"Unlock Pockmark Craters at the zone gate when you reach level 5.",
}

function HUD.new(ctx)
	local root = ctx.Root
	local Data = ctx.Data
	local UI = ctx.UI
	local self = {}
	local isTouch = UserInputService.TouchEnabled and not UserInputService.KeyboardEnabled

	local hud = Lib.Create("Frame", { Name = "HUD", Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Visible = false, Parent = root })
	self.Frame = hud

	------------------------------------------------------------ currencies
	local wallet = Lib.Create("Frame", { Position = UDim2.fromOffset(16, 56), Size = UDim2.fromOffset(250, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1, List = { Padding = 6 }, Parent = hud })
	local function pill(icon: string, color: Color3, order: number)
		local f = Lib.Create("Frame", { Size = UDim2.fromOffset(230, 38), BackgroundColor3 = C.Panel, BackgroundTransparency = 0.15, Corner = 19, Stroke = { Color = color, Thickness = 2, Transparency = 0.2 }, LayoutOrder = order, Parent = wallet })
		Lib.Label(icon, { Size = UDim2.fromOffset(34, 38), Position = UDim2.fromOffset(6, 0), TextSize = 22, TextXAlignment = Enum.TextXAlignment.Center, Parent = f })
		local value = Lib.Label("0", { Name = "Value", Size = UDim2.new(1, -48, 1, 0), Position = UDim2.fromOffset(42, 0), TextSize = 22, Font = Theme.FontBlack, TextColor3 = color, Parent = f })
		return f, value
	end
	local _, creditsLabel = pill("💰", C.Credit, 1)
	local _, gemsLabel = pill("💎", C.Gem, 2)
	local starsPill, starsLabel = pill("✦", C.Star, 3)
	local tokenPill, tokenLabel = pill("🎟", Color3.fromRGB(255, 170, 80), 4)

	-- level
	local levelBox = Lib.Create("Frame", { Size = UDim2.fromOffset(230, 46), BackgroundColor3 = C.Panel, BackgroundTransparency = 0.15, Corner = 12, LayoutOrder = 0, Parent = wallet })
	local levelLabel = Lib.Label("LV 1", { Size = UDim2.fromOffset(70, 24), Position = UDim2.fromOffset(10, 2), TextSize = 20, Font = Theme.FontBlack, TextColor3 = C.Xp, Parent = levelBox })
	local titleLabel = Lib.Label("", { Size = UDim2.new(1, -90, 0, 24), Position = UDim2.fromOffset(80, 2), TextSize = 14, TextColor3 = C.SubText, TextXAlignment = Enum.TextXAlignment.Right, Parent = levelBox })
	local xpBar = Lib.Bar({ Size = UDim2.new(1, -20, 0, 12), Position = UDim2.fromOffset(10, 28), Parent = levelBox }, C.Xp)

	-- tutorial
	local tutorial = Lib.Create("Frame", { Size = UDim2.fromOffset(300, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundColor3 = Color3.fromRGB(30, 40, 60), BackgroundTransparency = 0.1, Corner = 10, Stroke = { Color = C.Gem, Thickness = 1.5 }, LayoutOrder = 10, Visible = false, Parent = wallet })
	local tutText = Lib.Label("", { Size = UDim2.new(1, -20, 0, 0), Position = UDim2.fromOffset(10, 0), AutomaticSize = Enum.AutomaticSize.Y, TextSize = 15, Padding = { 0, 0, 8, 8 }, Parent = tutorial })
	local tutSkip = Lib.Button("Next ▸", { Size = UDim2.fromOffset(70, 24), Position = UDim2.new(1, -78, 0, 0), TextSize = 12, Style = "Secondary", Visible = true }, function()
		local step = (Data.Profile.Tutorial.Step or 0) + 1
		UI:Request("Tutorial", { Step = step, Done = step >= #TUTORIAL }, true)
	end)
	tutSkip.Parent = tutorial

	------------------------------------------------------------ zone banner + sector
	local banner = Lib.Create("Frame", { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 10), Size = UDim2.fromOffset(420, 64), BackgroundColor3 = C.Panel, BackgroundTransparency = 0.2, Corner = 14, Parent = hud })
	local zoneLabel = Lib.Label("TRANQUILITY COLONY", { Size = UDim2.new(1, -20, 0, 30), Position = UDim2.fromOffset(10, 4), Font = Theme.FontBlack, TextSize = 22, TextXAlignment = Enum.TextXAlignment.Center, Parent = banner })
	local sectorLabel = Lib.Label("", { Size = UDim2.new(1, -20, 0, 18), Position = UDim2.fromOffset(10, 32), TextSize = 14, TextColor3 = C.SubText, TextXAlignment = Enum.TextXAlignment.Center, Parent = banner })
	local sectorBar = Lib.Bar({ Size = UDim2.new(1, -40, 0, 6), Position = UDim2.fromOffset(20, 52), Parent = banner }, C.Good)
	local zoneAccent = Lib.Create("Frame", { Size = UDim2.new(1, -28, 0, 3), Position = UDim2.fromOffset(14, 0), BackgroundColor3 = C.Accent, Parent = banner })

	function self:SetZone(zoneId: string)
		local z = Zones.ById[zoneId]
		zoneLabel.Text = string.upper(z and z.Name or Zones.Hub.Name)
		zoneAccent.BackgroundColor3 = z and z.Accent or Zones.Hub.Accent
	end

	-- event banner + community goal
	local eventBanner = Lib.Create("Frame", { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 80), Size = UDim2.fromOffset(420, 30), BackgroundColor3 = Color3.fromRGB(70, 40, 120), BackgroundTransparency = 0.15, Corner = 10, Visible = false, Parent = hud })
	local eventLabel = Lib.Label("", { Size = UDim2.fromScale(1, 1), TextSize = 15, TextXAlignment = Enum.TextXAlignment.Center, Parent = eventBanner })
	local goalBox = Lib.Create("Frame", { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 114), Size = UDim2.fromOffset(300, 22), BackgroundTransparency = 1, Parent = hud })
	local goalBar = Lib.Bar({ Size = UDim2.fromScale(1, 1), Parent = goalBox }, Color3.fromRGB(90, 200, 255))

	------------------------------------------------------------ boosts
	local boosts = Lib.Create("Frame", { AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -16, 0, 56), Size = UDim2.fromOffset(300, 34), BackgroundTransparency = 1, List = { Horizontal = true, Padding = 6, HAlign = Enum.HorizontalAlignment.Right }, Parent = hud })

	------------------------------------------------------------ menu
	local menu = Lib.Create("Frame", { AnchorPoint = Vector2.new(1, 0.5), Position = UDim2.new(1, -12, 0.52, 0), Size = UDim2.fromOffset(isTouch and 140 or 72, 560), BackgroundTransparency = 1, Parent = hud })
	if isTouch then
		Lib.Create("UIGridLayout", { CellSize = UDim2.fromOffset(64, 64), CellPadding = UDim2.fromOffset(6, 6), SortOrder = Enum.SortOrder.LayoutOrder, HorizontalAlignment = Enum.HorizontalAlignment.Right, Parent = menu })
	else
		Lib.Create("UIListLayout", { Padding = UDim.new(0, 5), SortOrder = Enum.SortOrder.LayoutOrder, VerticalAlignment = Enum.VerticalAlignment.Center, Parent = menu })
	end
	local badges = {}
	local function menuButton(icon: string, label: string, panel: string, order: number)
		local b = Lib.Button("", { Size = UDim2.fromOffset(64, isTouch and 64 or 52), Style = "Ghost", LayoutOrder = order, Parent = menu }, function()
			UI:Toggle(panel)
		end)
		b.BackgroundTransparency = 0.15
		Lib.Label(icon, { Size = UDim2.new(1, 0, 0, 28), Position = UDim2.fromOffset(0, 3), TextSize = 22, TextXAlignment = Enum.TextXAlignment.Center, Parent = b })
		Lib.Label(label, { Size = UDim2.new(1, 0, 0, 14), Position = UDim2.new(0, 0, 1, -18), TextSize = 11, TextColor3 = C.SubText, TextXAlignment = Enum.TextXAlignment.Center, Parent = b })
		local badge = Lib.Create("Frame", { Size = UDim2.fromOffset(18, 18), Position = UDim2.new(1, -14, 0, -4), BackgroundColor3 = C.Bad, Corner = 9, Visible = false, ZIndex = 3, Parent = b })
		Lib.Label("!", { Size = UDim2.fromScale(1, 1), TextSize = 13, TextXAlignment = Enum.TextXAlignment.Center, ZIndex = 4, Parent = badge })
		badges[panel] = badge
		return b
	end
	menuButton("🛒", "Shop", "Shop", 1)
	menuButton("🎒", "Gear", "Inventory", 2)
	menuButton("⬆", "Upgrades", "Upgrades", 3)
	menuButton("🤖", "Robots", "Robots", 4)
	menuButton("🏗", "Base", "Base", 5)
	menuButton("📋", "Missions", "Missions", 6)
	menuButton("📅", "Daily", "Daily", 7)
	menuButton("🎁", "Crates", "Crates", 8)
	menuButton("🗺", "Map", "Map", 9)
	menuButton("🏆", "Awards", "Achievements", 10)
	menuButton("🏅", "Ranks", "Leaderboards", 11)
	menuButton("🎉", "Event", "Event", 12)
	menuButton("🌀", "Relaunch", "Rebirth", 13)
	menuButton("🤝", "Trade", "Trade", 14)
	menuButton("⚙", "Settings", "Settings", 15)
	local adminButton = menuButton("🛠", "Admin", "Admin", 16)
	adminButton.Visible = player:GetAttribute("IsAdmin") == true
	player:GetAttributeChangedSignal("IsAdmin"):Connect(function()
		adminButton.Visible = player:GetAttribute("IsAdmin") == true
	end)

	------------------------------------------------------------ container gauge
	local gauge = Lib.Create("Frame", { AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 16, 1, -16), Size = UDim2.fromOffset(300, 104), BackgroundColor3 = C.Panel, BackgroundTransparency = 0.12, Corner = 14, Parent = hud })
	local containerName = Lib.Label("POCKET POUCH", { Size = UDim2.new(1, -20, 0, 18), Position = UDim2.fromOffset(12, 6), TextSize = 13, TextColor3 = C.Accent, Font = Theme.FontBlack, Parent = gauge })
	local kgLabel = Lib.Label("0.00 / 0.50 kg", { Size = UDim2.new(1, -20, 0, 30), Position = UDim2.fromOffset(12, 22), TextSize = 26, Font = Theme.FontBlack, Parent = gauge })
	local fullTag = Lib.Create("TextLabel", { Text = "FULL", Font = Theme.FontBlack, TextSize = 14, TextColor3 = C.Text, BackgroundColor3 = C.Bad, Size = UDim2.fromOffset(46, 20), Position = UDim2.new(1, -58, 0, 28), Corner = 6, Visible = false, Parent = gauge })
	local kgBar = Lib.Bar({ Size = UDim2.new(1, -24, 0, 10), Position = UDim2.fromOffset(12, 56), Parent = gauge }, C.Accent)
	local packBtn = Lib.Button("Pack (Q)", { Size = UDim2.fromOffset(88, 26), Position = UDim2.fromOffset(12, 72), TextSize = 13, Style = "Secondary", Parent = gauge }, function()
		Net.Event("PackCapsule"):FireServer()
	end)
	local depositBtn = Lib.Button("Uplink Sell", { Size = UDim2.fromOffset(96, 26), Position = UDim2.fromOffset(106, 72), TextSize = 13, Style = "Secondary", Visible = false, Parent = gauge }, function()
		UI:Request("Deposit", { Remote = true })
	end)
	local capsLabel = Lib.Label("", { Size = UDim2.fromOffset(90, 26), Position = UDim2.new(1, -100, 0, 72), TextSize = 13, TextColor3 = C.SubText, TextXAlignment = Enum.TextXAlignment.Right, Parent = gauge })
	local _ = packBtn

	------------------------------------------------------------ tool slot
	local toolSlot = Lib.Button("", { AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -16), Size = UDim2.fromOffset(240, 58), Style = "Ghost", Parent = hud }, function()
		if ctx.Sweep then
			ctx.Sweep:ToggleEquip()
		end
	end)
	toolSlot.BackgroundTransparency = 0.1
	local toolKey = Lib.Label("1", { Size = UDim2.fromOffset(24, 24), Position = UDim2.fromOffset(8, 4), TextSize = 14, TextColor3 = C.SubText, Parent = toolSlot })
	local toolName = Lib.Label("Toothbrush", { Size = UDim2.new(1, -40, 0, 26), Position = UDim2.fromOffset(32, 6), TextSize = 18, Font = Theme.FontBlack, Parent = toolSlot })
	local toolHint = Lib.Label(isTouch and "Tap to equip" or "Hold LMB to sweep • G auto", { Size = UDim2.new(1, -40, 0, 18), Position = UDim2.fromOffset(32, 32), TextSize = 12, TextColor3 = C.SubText, Parent = toolSlot })
	local _ = toolKey

	------------------------------------------------------------ mobile controls
	local mobile = Lib.Create("Frame", { AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, -170, 1, -30), Size = UDim2.fromOffset(250, 200), BackgroundTransparency = 1, Visible = isTouch, Parent = hud })
	local sweepBtn = Lib.Create("TextButton", { Text = "SWEEP", Font = Theme.FontBlack, TextSize = 20, TextColor3 = C.Text, BackgroundColor3 = C.Accent, BackgroundTransparency = 0.1, Size = UDim2.fromOffset(110, 110), Position = UDim2.new(1, -110, 1, -110), Corner = 55, AutoButtonColor = false, Parent = mobile })
	sweepBtn.InputBegan:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1 then
			if ctx.Sweep then
				ctx.Sweep:SetHeld(true)
			end
			sweepBtn.BackgroundTransparency = 0.4
		end
	end)
	sweepBtn.InputEnded:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1 then
			if ctx.Sweep then
				ctx.Sweep:SetHeld(false)
			end
			sweepBtn.BackgroundTransparency = 0.1
		end
	end)
	local autoBtn = Lib.Button("AUTO", { Size = UDim2.fromOffset(70, 44), Position = UDim2.new(1, -190, 1, -60), TextSize = 15, Style = "Secondary", Parent = mobile }, function()
		if ctx.Sweep then
			ctx.Sweep:ToggleAuto()
		end
	end)
	Lib.Button("PACK", { Size = UDim2.fromOffset(70, 44), Position = UDim2.new(1, -190, 1, -110), TextSize = 15, Style = "Secondary", Parent = mobile }, function()
		Net.Event("PackCapsule"):FireServer()
	end)

	function self:SetAuto(on: boolean)
		Lib.StyleButton(autoBtn, on and "Primary" or "Secondary")
		toolHint.Text = on and "AUTO-SWEEP ON (G)" or (isTouch and "Hold SWEEP" or "Hold LMB to sweep • G auto")
	end

	------------------------------------------------------------ updates
	local function refreshWallet()
		local p = Data.Profile
		if not p then
			return
		end
		creditsLabel.Text = Format.Number(p.Credits)
		gemsLabel.Text = Format.Number(p.Gems)
		starsLabel.Text = Format.Number(p.Stars)
		starsPill.Visible = p.Stars > 0 or p.Rebirths > 0
		local season = ctx.Season and ctx.Season()
		tokenPill.Visible = season ~= nil
		if season then
			tokenLabel.Text = string.format("%s %s", Format.Number(p.EventTokens[season.Id] or 0), season.TokenIcon)
		end
		levelLabel.Text = "LV " .. p.Level
		titleLabel.Text = p.Title ~= "" and ("« " .. p.Title .. " »") or (p.Rebirths > 0 and ("Re-launch " .. p.Rebirths) or "")
		local need = Formulas.XpToNext(p.Level)
		xpBar:Set(p.XP / need, string.format("%s / %s XP", Format.Number(p.XP), Format.Number(need)))
	end

	local function refreshContainer()
		local p = Data.Profile
		if not p then
			return
		end
		local cap = player:GetAttribute("ContainerCap") or Formulas.Capacity(p)
		local kg = Formulas.ContentsKg(p.Contents)
		local kgText = string.gsub(Format.Kg(kg), " kg", "")
		kgLabel.Text = string.format("%s / %s", kgText, Format.Kg(cap))
		local frac = kg / math.max(cap, 1e-6)
		kgBar:Set(frac)
		kgBar:Color(frac >= 0.999 and C.Bad or (frac > 0.8 and Color3.fromRGB(255, 200, 60) or C.Accent))
		fullTag.Visible = frac >= 0.999
		local def = require(Shared.Config.Containers).ById[p.EquippedContainer]
		containerName.Text = string.upper(def and def.Name or "Container")
		depositBtn.Visible = (p.Upgrades.uplink_deposit or 0) > 0 or (p.Perks.uplink_perk or 0) > 0
		local caps = player:GetAttribute("Capsules") or 0
		capsLabel.Text = caps > 0 and ("🛢 " .. caps .. " out") or ""
	end

	local function refreshTool()
		local p = Data.Profile
		if not p then
			return
		end
		local t = Tools.ById[p.EquippedTool]
		toolName.Text = t and t.Name or "Tool"
	end

	local function refreshTutorial()
		local p = Data.Profile
		if not p then
			return
		end
		local step = (p.Tutorial.Step or 0) + 1
		local show = not p.Tutorial.Done and step <= #TUTORIAL and (p.Settings.ShowTutorial ~= false)
		tutorial.Visible = show
		if show then
			tutText.Text = string.format("TIP %d/%d\n%s", step, #TUTORIAL, TUTORIAL[step])
		end
	end

	local function refreshBadges()
		local p = Data.Profile
		if not p then
			return
		end
		local claimable = false
		for _, list in { p.Missions.Daily, p.Missions.Weekly } do
			for _, m in list do
				if not m.Claimed and m.Progress >= m.Target then
					claimable = true
				end
			end
		end
		badges.Missions.Visible = claimable
		badges.Daily.Visible = p.Login.Pending == true
		local free = false
		for _, n in p.Crates.Free or {} do
			if n > 0 then
				free = true
			end
		end
		badges.Crates.Visible = free
	end

	Data:Watch({ "Credits", "Gems", "Stars", "Level", "XP", "Title", "Rebirths", "EventTokens" }, refreshWallet)
	Data:Watch({ "Contents", "EquippedContainer", "Upgrades", "Perks", "Containers" }, refreshContainer)
	Data:Watch({ "EquippedTool" }, refreshTool)
	Data:Watch({ "Tutorial", "Settings" }, refreshTutorial)
	Data:Watch({ "Missions", "Login", "Crates" }, refreshBadges)
	player:GetAttributeChangedSignal("ContainerCap"):Connect(refreshContainer)
	player:GetAttributeChangedSignal("Capsules"):Connect(refreshContainer)
	ctx.Data.ServerEventChanged:Connect(refreshWallet)

	-- auto tutorial progress
	Data.Changed:Connect(function(key)
		local p = Data.Profile
		if not p or p.Tutorial.Done then
			return
		end
		local step = (p.Tutorial.Step or 0) + 1
		local advance = (step == 3 and (p.Stats.Deposits or 0) > 0) or (step == 4 and ((p.Stats.UpgradesBought or 0) > 0 or (p.Tools.nail_brush))) or (step == 5 and (p.Stats.CapsulesPacked or 0) > 0) or (step == 6 and (p.Stats.BuildingsPlaced or 0) > 0) or (step == 7 and #p.Robots > 0) or (step == 8 and p.Zones.pockmark_craters)
		if advance and key ~= "Tutorial" then
			UI:Request("Tutorial", { Step = step, Done = step >= #TUTORIAL }, true)
		end
	end)
	function self:TutorialEvent(kind: string)
		local p = Data.Profile
		if not p or p.Tutorial.Done then
			return
		end
		local step = (p.Tutorial.Step or 0) + 1
		if (kind == "Equip" and step == 1) or (kind == "Sweep" and step == 2) then
			UI:Request("Tutorial", { Step = step }, true)
		end
	end

	-- per-frame-ish updates: sector, events, boosts
	local accum = 0
	RunService.Heartbeat:Connect(function(dt)
		accum += dt
		if accum < 0.5 or not hud.Visible then
			return
		end
		accum = 0
		local character = player.Character
		local hrp = character and character:FindFirstChild("HumanoidRootPart")
		if hrp then
			local id, s = Data:SectorAt(hrp.Position)
			if s then
				sectorLabel.Text = string.format("SECTOR %d  •  %s CLEAN", s.Number, Format.Percent(s.Permille / 1000, 1))
				sectorBar.Frame.Visible = true
				sectorBar:Set(s.Permille / 1000)
			else
				sectorLabel.Text = id and "" or "No dust to clean here"
				sectorBar.Frame.Visible = false
			end
		end
		local ev = Data.ServerEvent
		local now = Data:ServerTime()
		if ev and ev.Active and ev.Active.EndsAt > now then
			eventBanner.Visible = true
			local z = ev.Active.Zone and Zones.ById[ev.Active.Zone]
			eventLabel.Text = string.format("☄ %s%s  •  %s", ev.Active.Name, (z and (ev.Active.Kind == "MeteorShower" or ev.Active.Kind == "DustStorm")) and (" in " .. z.Name) or "", Format.Clock(ev.Active.EndsAt - now))
		else
			eventBanner.Visible = false
		end
		if ev and ev.Goal then
			if ev.Goal.BoostEndsAt and ev.Goal.BoostEndsAt > now then
				goalBar:Set(1, "🌕 2x CREDITS FOR EVERYONE  " .. Format.Clock(ev.Goal.BoostEndsAt - now))
				goalBar:Color(C.Credit)
			else
				goalBar:Set(ev.Goal.Progress / math.max(1, ev.Goal.Target), string.format("Community clean-up %d%%", math.floor(ev.Goal.Progress / math.max(1, ev.Goal.Target) * 100)))
				goalBar:Color(Color3.fromRGB(90, 200, 255))
			end
		end
		-- boosts
		Lib.Clear(boosts)
		local p = Data.Profile
		if p then
			for id, t in p.Boosts do
				local left = t - now
				if left > 0 then
					local b = Crates.Boosts[id]
					local chip = Lib.Create("Frame", { Size = UDim2.fromOffset(96, 30), BackgroundColor3 = C.Panel, BackgroundTransparency = 0.1, Corner = 8, Stroke = { Color = b and b.Color or C.Accent }, Parent = boosts })
					Lib.Label(string.format("%s %s", b and b.Icon or "★", Format.Clock(left)), { Size = UDim2.fromScale(1, 1), TextSize = 14, TextXAlignment = Enum.TextXAlignment.Center, TextColor3 = b and b.Color or C.Text, Parent = chip })
				end
			end
		end
	end)

	-- invite friends button (top right)
	local invite = Lib.Button("👥 Invite", { AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -16, 0, 96), Size = UDim2.fromOffset(100, 30), TextSize = 14, Style = "Secondary", Parent = hud }, function()
		local ok = pcall(function()
			SocialService:PromptGameInvite(player)
		end)
		if not ok then
			UI:Notify("Invites are not available here.", "Warning")
		end
	end)
	local _ = invite
	local __ = Missions
	local ___ = Progression

	function self:Show(visible: boolean)
		hud.Visible = visible
	end

	return self
end

return HUD
