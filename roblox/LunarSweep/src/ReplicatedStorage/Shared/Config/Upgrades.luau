--!strict
-- Permanent upgrades bought at the Upgrade Terminal. Effect is per level.
-- Cost of next level = BaseCost * Growth ^ currentLevel (then the Supplier Network discount).

export type UpgradeDef = {
	Id: string,
	Name: string,
	Category: string,
	MaxLevel: number,
	BaseCost: number,
	Growth: number,
	Effect: number,
	Level: number, -- player level required
	Icon: string,
	Description: string,
	Format: string, -- how to display the effect: "pct" | "studs" | "flat" | "toggle"
}

local list: { UpgradeDef } = {
	-- Tools
	{ Id = "wide_head", Name = "Wide Head", Category = "Tools", MaxLevel = 5, BaseCost = 30, Growth = 3.4, Effect = 0.08, Level = 1, Icon = "↔", Format = "pct", Description = "+8% cleaning width per level." },
	{ Id = "deep_head", Name = "Deep Head", Category = "Tools", MaxLevel = 5, BaseCost = 45, Growth = 3.4, Effect = 0.10, Level = 2, Icon = "⬇", Format = "pct", Description = "+10% dust per cleaned patch per level." },
	{ Id = "long_reach", Name = "Long Reach", Category = "Tools", MaxLevel = 5, BaseCost = 60, Growth = 3.3, Effect = 1.2, Level = 3, Icon = "➹", Format = "studs", Description = "+1.2 studs tool reach per level." },
	{ Id = "surge_head", Name = "Surge Head", Category = "Tools", MaxLevel = 5, BaseCost = 400, Growth = 3.6, Effect = 0.04, Level = 8, Icon = "⚡", Format = "pct", Description = "+4% chance per level for a patch to yield double dust." },
	{ Id = "magnet_coil", Name = "Magnet Coil", Category = "Tools", MaxLevel = 5, BaseCost = 120, Growth = 3.3, Effect = 2, Level = 4, Icon = "🧲", Format = "studs", Description = "+2 studs debris pickup radius per level." },
	-- Containers
	{ Id = "dust_compactor", Name = "Dust Compactor", Category = "Containers", MaxLevel = 5, BaseCost = 50, Growth = 3.5, Effect = 0.15, Level = 2, Icon = "▣", Format = "pct", Description = "+15% container capacity per level." },
	{ Id = "auto_packer", Name = "Auto-Packer", Category = "Containers", MaxLevel = 1, BaseCost = 2500, Growth = 1, Effect = 1, Level = 12, Icon = "📦", Format = "toggle", Description = "When your container is full, it packs itself into a capsule automatically." },
	{ Id = "uplink_deposit", Name = "Uplink Deposit", Category = "Containers", MaxLevel = 1, BaseCost = 25000, Growth = 1, Effect = 0.1, Level = 18, Icon = "📡", Format = "toggle", Description = "Deposit your container from anywhere (10% uplink fee)." },
	-- Market
	{ Id = "market_contracts", Name = "Market Contracts", Category = "Market", MaxLevel = 5, BaseCost = 200, Growth = 3.6, Effect = 0.08, Level = 5, Icon = "💰", Format = "pct", Description = "+8% sell price for everything per level." },
	{ Id = "supplier_network", Name = "Supplier Network", Category = "Market", MaxLevel = 5, BaseCost = 300, Growth = 3.6, Effect = 0.04, Level = 7, Icon = "🏷", Format = "pct", Description = "-4% tool, container and building prices per level." },
	{ Id = "region_bounty", Name = "Region Bounty", Category = "Market", MaxLevel = 5, BaseCost = 250, Growth = 3.5, Effect = 0.3, Level = 6, Icon = "⬢", Format = "pct", Description = "+30% bonus when a sector you helped clean reaches 100%." },
	{ Id = "lucky_finds", Name = "Lucky Finds", Category = "Market", MaxLevel = 5, BaseCost = 400, Growth = 3.6, Effect = 0.10, Level = 9, Icon = "🍀", Format = "pct", Description = "+10% rare debris chance per level." },
	-- Movement
	{ Id = "servo_stride", Name = "Servo Stride", Category = "Movement", MaxLevel = 5, BaseCost = 100, Growth = 3.3, Effect = 0.06, Level = 3, Icon = "👟", Format = "pct", Description = "+6% walk speed per level." },
	{ Id = "lunar_leap", Name = "Lunar Leap", Category = "Movement", MaxLevel = 5, BaseCost = 80, Growth = 3.2, Effect = 0.10, Level = 2, Icon = "⤒", Format = "pct", Description = "+10% jump power per level." },
	{ Id = "thrust_assist", Name = "Thrust Assist", Category = "Movement", MaxLevel = 2, BaseCost = 5000, Growth = 10, Effect = 1, Level = 14, Icon = "🚀", Format = "flat", Description = "+1 mid-air jetpack boost per level." },
	-- Logistics
	{ Id = "capsule_tether", Name = "Capsule Tether", Category = "Logistics", MaxLevel = 3, BaseCost = 1500, Growth = 4, Effect = 0.25, Level = 10, Icon = "⛓", Format = "pct", Description = "-25% capsule recall fee per level." },
	{ Id = "rapid_transfer", Name = "Rapid Transfer", Category = "Logistics", MaxLevel = 5, BaseCost = 2000, Growth = 3.5, Effect = 0.10, Level = 9, Icon = "⇄", Format = "pct", Description = "+10% value for everything sold from your base silo per level." },
	-- Robots
	{ Id = "robot_firmware", Name = "Robot Firmware", Category = "Robots", MaxLevel = 5, BaseCost = 3000, Growth = 3.5, Effect = 0.08, Level = 8, Icon = "🤖", Format = "pct", Description = "+8% robot speed and cleaning width per level." },
	{ Id = "battery_tech", Name = "Battery Tech", Category = "Robots", MaxLevel = 5, BaseCost = 2500, Growth = 3.4, Effect = 0.20, Level = 8, Icon = "🔋", Format = "pct", Description = "+20% robot battery life per level." },
	{ Id = "field_repair", Name = "Field Repair", Category = "Robots", MaxLevel = 5, BaseCost = 2000, Growth = 3.4, Effect = 0.15, Level = 9, Icon = "🔧", Format = "pct", Description = "-15% robot wear per level." },
	-- Base
	{ Id = "power_grid", Name = "Power Grid", Category = "Base", MaxLevel = 5, BaseCost = 4000, Growth = 3.5, Effect = 0.10, Level = 10, Icon = "⚡", Format = "pct", Description = "+10% base power generation per level." },
	{ Id = "xp_booster", Name = "Field Training", Category = "Base", MaxLevel = 5, BaseCost = 500, Growth = 3.5, Effect = 0.05, Level = 4, Icon = "★", Format = "pct", Description = "+5% XP from everything per level." },
}

local byId: { [string]: UpgradeDef } = {}
for i, u in list do
	byId[u.Id] = u
	;(u :: any).Order = i
end

local categories = { "Tools", "Containers", "Market", "Movement", "Logistics", "Robots", "Base" }

return {
	List = list,
	ById = byId,
	Categories = categories,
	Get = function(id: string): UpgradeDef?
		return byId[id]
	end,
}
