--!strict
-- Global tuning constants. Server and client both read these.

return {
	GameName = "Lunar Sweep",
	Version = "1.0.0",
	DataStoreName = "LunarSweep_Profiles_v1",
	DataVersion = 1,

	-- saving
	AutosaveInterval = 90,
	SessionLockTimeout = 1800, -- seconds before a stale lock may be stolen
	LoadRetries = 6,

	-- cleaning
	StrokeInterval = 0.2, -- client sends one stroke every 0.2 s while sweeping
	MinStrokeGap = 0.12, -- server rejects strokes closer together than this
	StrokeTolerance = 10, -- extra studs allowed between character and footprint
	MaxStrokeSegment = 24, -- max studs between consecutive stroke points
	CoopRadius = 60,
	CoopBonusPer = 0.10,
	CoopBonusMax = 0.30,

	-- capsules
	MaxCapsules = 12,
	CapsuleLifetime = 900,
	CapsuleRecallFee = 0.2,

	-- movement
	BaseWalkSpeed = 18,
	BaseJumpPower = 42,
	CarrySpeedPenalty = 0.2,

	-- leveling
	MaxLevel = 100,

	-- fast travel
	TeleportCooldown = 8,

	-- robots
	RobotTick = 0.25,
	RobotHover = 3.5,
	RobotChargeRate = 6, -- % battery per second when docked with full power

	-- base
	BaseTick = 2,
	OfflineCapHours = 4,

	-- server events
	ServerEventMin = 420,
	ServerEventMax = 720,
	CommunityGoalPerPlayer = 3000, -- cleaned patches per online player to fill the meter
	CommunityBoostSeconds = 180,

	-- anti exploit
	MaxSpeedLeniency = 1.9,
	ViolationKickThreshold = 60,

	-- leaderboards
	LeaderboardRefresh = 150,
	LeaderboardSize = 50,

	-- UI colours (dark panels + orange like a space-agency HUD)
	Colors = {
		Panel = Color3.fromRGB(24, 27, 33),
		PanelLight = Color3.fromRGB(36, 40, 48),
		PanelLighter = Color3.fromRGB(50, 55, 66),
		Stroke = Color3.fromRGB(70, 76, 90),
		Accent = Color3.fromRGB(255, 122, 26),
		AccentDark = Color3.fromRGB(200, 84, 10),
		Text = Color3.fromRGB(240, 242, 246),
		SubText = Color3.fromRGB(160, 168, 182),
		Good = Color3.fromRGB(80, 220, 120),
		Bad = Color3.fromRGB(255, 80, 80),
		Gem = Color3.fromRGB(110, 210, 255),
		Credit = Color3.fromRGB(255, 200, 60),
		Star = Color3.fromRGB(255, 230, 120),
		Xp = Color3.fromRGB(120, 180, 255),
	},
}
