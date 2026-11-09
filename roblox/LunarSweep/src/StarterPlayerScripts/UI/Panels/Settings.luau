--!nonstrict
-- Settings (saved to your profile): audio, interface, gameplay helpers, graphics.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local SocialService = game:GetService("SocialService")
local Players = game:GetService("Players")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local GameConfig = require(Shared.Config.GameConfig)

local UI = script.Parent.Parent
local Lib = require(UI.Lib)
local Theme = require(UI.Theme)

local C = Theme.Colors

return function(ctx)
	local Data = ctx.Data
	local win = Lib.Window("Settings", UDim2.fromOffset(640, 560))
	local panel = { Window = win }
	local scroll = Lib.Scroll({ Parent = win.Body }, { Padding = 8 })
	local pending = {}
	local saveScheduled = false

	local function save(key: string, value: any)
		pending[key] = value
		Data.Profile.Settings[key] = value
		Data.Changed:Fire("Settings")
		if not saveScheduled then
			saveScheduled = true
			task.delay(0.6, function()
				saveScheduled = false
				local batch = pending
				pending = {}
				ctx.UI:Request("SaveSettings", { Settings = batch }, true)
			end)
		end
	end

	local function toggleRow(label: string, key: string, order: number)
		local row = Lib.Frame({ Size = UDim2.new(1, -10, 0, 48), BackgroundColor3 = C.PanelLight, Corner = 8, LayoutOrder = order, Parent = scroll })
		Lib.Label(label, { Size = UDim2.new(0.7, 0, 1, 0), Position = UDim2.fromOffset(14, 0), Parent = row })
		local btn
		btn = Lib.Button("", { Size = UDim2.fromOffset(90, 32), Position = UDim2.new(1, -104, 0, 8), Parent = row }, function()
			local v = not Data.Profile.Settings[key]
			save(key, v)
			btn.Text = v and "ON" or "OFF"
			Lib.StyleButton(btn, v and "Good" or "Secondary")
		end)
		local v = Data.Profile.Settings[key]
		btn.Text = v and "ON" or "OFF"
		Lib.StyleButton(btn, v and "Good" or "Secondary")
	end

	local function sliderRow(label: string, key: string, order: number, min: number, max: number)
		local row = Lib.Frame({ Size = UDim2.new(1, -10, 0, 48), BackgroundColor3 = C.PanelLight, Corner = 8, LayoutOrder = order, Parent = scroll })
		Lib.Label(label, { Size = UDim2.new(0.35, 0, 1, 0), Position = UDim2.fromOffset(14, 0), Parent = row })
		local value = Lib.Label("", { Size = UDim2.fromOffset(60, 48), Position = UDim2.new(1, -70, 0, 0), TextXAlignment = Enum.TextXAlignment.Right, Parent = row })
		local holder = Lib.Frame({ Size = UDim2.new(0.5, -40, 0, 32), Position = UDim2.new(0.38, 0, 0, 8), BackgroundTransparency = 1, List = { Horizontal = true, Padding = 4 }, Parent = row })
		local steps = 10
		local function draw()
			Lib.Clear(holder)
			local v = Data.Profile.Settings[key] or 0
			value.Text = string.format("%d%%", math.floor(v * 100 + 0.5))
			for i = 1, steps do
				local stepValue = min + (max - min) * i / steps
				local on = v >= stepValue - 1e-3
				Lib.Button("", { Size = UDim2.fromOffset(22, 32), Style = on and "Primary" or "Ghost", LayoutOrder = i, Parent = holder }, function()
					save(key, stepValue)
					draw()
				end)
			end
		end
		draw()
	end

	local function rebuild()
		if not Data.Profile then
			return
		end
		Lib.Clear(scroll)
		Lib.Label("AUDIO", { TextColor3 = C.Accent, Font = Theme.FontBlack, LayoutOrder = 0, Parent = scroll })
		sliderRow("Music", "Music", 1, 0, 1)
		sliderRow("Sound effects", "Sfx", 2, 0, 1)
		Lib.Label("INTERFACE", { TextColor3 = C.Accent, Font = Theme.FontBlack, LayoutOrder = 10, Parent = scroll })
		sliderRow("UI size", "UiScale", 11, 0.6, 1.4)
		toggleRow("Show tutorial tips", "ShowTutorial", 12)
		Lib.Label("GAMEPLAY", { TextColor3 = C.Accent, Font = Theme.FontBlack, LayoutOrder = 20, Parent = scroll })
		toggleRow("Auto-sweep (keep cleaning while the tool is out)", "AutoSweep", 21)
		toggleRow("Show sector borders on the ground", "SectorLines", 22)
		toggleRow("Show robots", "ShowRobots", 23)
		toggleRow("First-person view (V)", "FirstPerson", 24)
		Lib.Label("GRAPHICS", { TextColor3 = C.Accent, Font = Theme.FontBlack, LayoutOrder = 30, Parent = scroll })
		toggleRow("Particles & effects", "Particles", 31)
		toggleRow("Camera shake", "CameraShake", 32)
		Lib.Label("SOCIAL", { TextColor3 = C.Accent, Font = Theme.FontBlack, LayoutOrder = 40, Parent = scroll })
		local row = Lib.Frame({ Size = UDim2.new(1, -10, 0, 52), BackgroundTransparency = 1, LayoutOrder = 41, List = { Horizontal = true, Padding = 8 }, Parent = scroll })
		Lib.Button("👥 Invite Friends", { Size = UDim2.fromOffset(200, 44), Parent = row }, function()
			pcall(function()
				SocialService:PromptGameInvite(Players.LocalPlayer)
			end)
		end)
		Lib.Button("❓ How to play", { Size = UDim2.fromOffset(200, 44), Style = "Secondary", Parent = row }, function()
			if ctx.Menu then
				ctx.UI:Close()
				ctx.Menu:ShowHelp()
			end
		end)
		Lib.Label(string.format("%s v%s", GameConfig.GameName, GameConfig.Version) .. (Data.UsingMemory and "  •  Studio mode: progress is not saved" or ""), { TextColor3 = C.SubText, TextSize = 13, LayoutOrder = 50, Parent = scroll })
	end
	function panel:Open()
		if Data.Profile and Data.Profile.Settings.ShowTutorial == nil then
			Data.Profile.Settings.ShowTutorial = true
		end
		rebuild()
	end
	return panel
end
