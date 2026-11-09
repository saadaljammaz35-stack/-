--!nonstrict
-- Title screen with an orbiting camera over the colony: Play, How to Play, Settings,
-- Credits. Also hosts the How-to-Play guide.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local GameConfig = require(Shared.Config.GameConfig)

local Lib = require(script.Parent.Lib)
local Theme = require(script.Parent.Theme)

local C = Theme.Colors

local HELP = {
	{ "🧹 Sweep the moon", "Take out your tool (1) and hold the mouse / SWEEP button. Dirty ground turns clean and the dust goes into your container (kg)." },
	{ "💰 Sell dust", "Walk to the Dust Exchange in the colony and press E. Market prices drift up and down - check the board." },
	{ "⬢ Sectors", "The moon is split into hexagonal sectors. Help finish one to 100% for a big bounty and gems. Dust slowly regrows." },
	{ "🛢 Capsules", "Container full far from home? Press Q to pack it into a capsule, keep cleaning and fetch it later (or let robots do it)." },
	{ "🛒 Gear & upgrades", "Buy better tools and containers at the Supply Wall, and permanent upgrades at the Upgrade Terminal." },
	{ "🤖 Robots", "Robots clean assigned zones, collect debris, haul capsules or follow you. Keep them charged at Robot Docks and repaired." },
	{ "🏗 Your base", "Build silos, power, conveyors and production on your plot. Production buildings must touch storage or be linked by conveyors." },
	{ "🗺 Zones", "Nine zones from Dusty Flats to the Orbital Ring. Unlock them at the glowing gates. Dark zones need your helmet lamp!" },
	{ "🌀 Re-Launch", "At high level, re-launch for Cosmic Stars and permanent multipliers. Robots, base and rare gear are kept." },
	{ "🎉 Events & co-op", "Meteor showers, dust storms and seasonal events. Cleaning near friends gives a co-op bonus and fills the community goal." },
}

local MainMenu = {}

function MainMenu.new(ctx, onPlay: () -> ())
	local root = ctx.Root
	local self: any = {}
	local frame = Lib.Create("Frame", { Name = "MainMenu", Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, ZIndex = 20, Parent = root })
	local shade = Lib.Create("Frame", { Size = UDim2.fromScale(0.5, 1), BackgroundColor3 = Color3.fromRGB(6, 8, 14), BackgroundTransparency = 0.25, ZIndex = 20, Gradient = ColorSequence.new(Color3.new(1, 1, 1)), Parent = frame })
	local grad = shade:FindFirstChildOfClass("UIGradient")
	if grad then
		grad.Rotation = 0
		grad.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0), NumberSequenceKeypoint.new(0.7, 0.2), NumberSequenceKeypoint.new(1, 1) })
	end
	Lib.Label("LUNAR", { Size = UDim2.fromOffset(600, 90), Position = UDim2.fromOffset(70, 120), TextSize = 92, Font = Theme.FontBlack, TextColor3 = C.Text, ZIndex = 21, Parent = frame })
	Lib.Label("SWEEP", { Size = UDim2.fromOffset(600, 90), Position = UDim2.fromOffset(70, 200), TextSize = 92, Font = Theme.FontBlack, TextColor3 = C.Accent, ZIndex = 21, Parent = frame })
	Lib.Label("Clean the moon. One patch at a time.", { Size = UDim2.fromOffset(600, 30), Position = UDim2.fromOffset(74, 296), TextSize = 22, TextColor3 = C.SubText, ZIndex = 21, Parent = frame })
	local buttons = Lib.Frame({ Size = UDim2.fromOffset(300, 260), Position = UDim2.fromOffset(74, 360), BackgroundTransparency = 1, List = { Padding = 12 }, ZIndex = 21, Parent = frame })
	local play = Lib.Button("PLAY", { Size = UDim2.fromOffset(300, 60), TextSize = 28, Font = Theme.FontBlack, ZIndex = 22, LayoutOrder = 1, Parent = buttons }, function()
		self:Hide()
		onPlay()
	end)
	local _ = play
	Lib.Button("How to play", { Size = UDim2.fromOffset(300, 46), Style = "Secondary", ZIndex = 22, LayoutOrder = 2, Parent = buttons }, function()
		self:ShowHelp()
	end)
	Lib.Button("Settings", { Size = UDim2.fromOffset(300, 46), Style = "Secondary", ZIndex = 22, LayoutOrder = 3, Parent = buttons }, function()
		ctx.UI:Open("Settings")
	end)
	Lib.Button("Credits", { Size = UDim2.fromOffset(300, 46), Style = "Secondary", ZIndex = 22, LayoutOrder = 4, Parent = buttons }, function()
		ctx.UI:Notify(GameConfig.GameName .. " - an original Roblox cleaning adventure. Built with Luau & Rojo. All models are procedurally generated.", "Info", "🌙")
	end)
	Lib.Label("v" .. GameConfig.Version, { Size = UDim2.fromOffset(200, 20), Position = UDim2.new(0, 74, 1, -40), TextSize = 14, TextColor3 = C.SubText, ZIndex = 21, Parent = frame })

	-- help overlay
	local help = Lib.Window("How to Play", UDim2.fromOffset(820, 560), C.Gem)
	help.Frame.ZIndex = 30
	help.Frame.Parent = root
	local list = Lib.Scroll({ Parent = help.Body }, { Padding = 8 })
	for i, h in HELP do
		local row = Lib.Frame({ Size = UDim2.new(1, -10, 0, 76), BackgroundColor3 = C.PanelLight, Corner = 10, LayoutOrder = i, Parent = list })
		Lib.Label(h[1], { Size = UDim2.new(1, -20, 0, 26), Position = UDim2.fromOffset(12, 6), TextSize = 18, Font = Theme.FontBlack, Parent = row })
		Lib.Label(h[2], { Size = UDim2.new(1, -20, 0, 40), Position = UDim2.fromOffset(12, 32), TextSize = 14, TextColor3 = C.SubText, Font = Theme.FontMedium, Parent = row })
	end
	help.CloseButton.Activated:Connect(function()
		help.Frame.Visible = false
	end)

	function self:ShowHelp()
		help.Frame.Visible = true
	end
	function self:Show()
		frame.Visible = true
		if ctx.Camera then
			ctx.Camera:StartMenuOrbit()
		end
	end
	function self:Hide()
		frame.Visible = false
		if ctx.Camera then
			ctx.Camera:StopMenuOrbit()
		end
	end
	self.Frame = frame
	return self
end

return MainMenu
