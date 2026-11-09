--!strict
-- Visual tokens for the whole UI.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local GameConfig = require(ReplicatedStorage:WaitForChild("Shared").Config.GameConfig)

local C = GameConfig.Colors

return {
	Colors = C,
	Font = Enum.Font.BuilderSans,
	FontBold = Enum.Font.BuilderSansBold,
	FontBlack = Enum.Font.BuilderSansExtraBold,
	FontMedium = Enum.Font.BuilderSansMedium,
	Corner = 10,
	CornerSmall = 6,
	PanelSize = UDim2.fromOffset(880, 560),
	StatusColors = {
		Working = Color3.fromRGB(80, 220, 120),
		LowPower = Color3.fromRGB(255, 210, 60),
		NoPower = Color3.fromRGB(255, 70, 70),
		Disconnected = Color3.fromRGB(255, 140, 40),
		NoInput = Color3.fromRGB(90, 170, 255),
		SiloFull = Color3.fromRGB(190, 110, 255),
		Idle = Color3.fromRGB(150, 156, 168),
	},
	StatusText = {
		Working = "Working",
		LowPower = "Low power",
		NoPower = "No power",
		Disconnected = "Not connected to storage",
		NoInput = "Waiting for input",
		SiloFull = "Silo full",
		Idle = "Idle",
	},
}
