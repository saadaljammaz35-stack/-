--!strict
-- Base buildings placed on the personal plot (24 x 24 grid of 4-stud cells).
-- Power: positive = generates kW, negative = consumes kW.
-- Production rates are kg/s at level 1 (scaled by level and power satisfaction).
-- Production buildings only run when "connected": adjacent to a storage building
-- (Command Center or Dust Silo) or linked to one through a chain of conveyor tiles.

export type BuildingDef = {
	Id: string,
	Name: string,
	Category: string, -- "Core" | "Storage" | "Services" | "Logistics" | "Production" | "Power" | "Decor"
	W: number,
	D: number,
	Cost: number,
	Level: number, -- player level required
	CmdLevel: number, -- command center level required
	Power: number,
	MaxLevel: number,
	Storage: number?,
	RobotSlots: number?,
	MaxCount: number?,
	Input: { [string]: number }?, -- special keys: "AnyDust", "AnyDebris", "Crystal"
	Output: { [string]: number }?,
	Gems: number?, -- gems per kg of output
	Removable: boolean,
	Icon: string,
	Description: string,
}

local list: { BuildingDef } = {
	{ Id = "command_center", Name = "Command Center", Category = "Core", W = 4, D = 4, Cost = 0, Level = 1, CmdLevel = 0, Power = 6, MaxLevel = 5, Storage = 60, RobotSlots = 1, MaxCount = 1, Removable = false, Icon = "🏛", Description = "Heart of your base. Upgrade it to raise the building limit and unlock new structures." },
	-- storage
	{ Id = "dust_silo", Name = "Dust Silo", Category = "Storage", W = 3, D = 3, Cost = 800, Level = 4, CmdLevel = 1, Power = 0, MaxLevel = 5, Storage = 150, Removable = true, Icon = "🛢", Description = "Stores dust, debris and processed goods. Robots and production deliver here." },
	-- services
	{ Id = "deposit_hopper", Name = "Deposit Hopper", Category = "Services", W = 2, D = 2, Cost = 300, Level = 3, CmdLevel = 1, Power = 0, MaxLevel = 1, MaxCount = 2, Removable = true, Icon = "⏬", Description = "Empty your container or carried capsule straight into your silo." },
	{ Id = "robot_dock", Name = "Robot Dock", Category = "Services", W = 3, D = 3, Cost = 2000, Level = 6, CmdLevel = 1, Power = -6, MaxLevel = 3, RobotSlots = 2, Removable = true, Icon = "🔌", Description = "+2 robot slots (+1 per upgrade). Robots recharge and get repaired here." },
	{ Id = "capsule_catcher", Name = "Capsule Catcher", Category = "Services", W = 3, D = 3, Cost = 6000, Level = 12, CmdLevel = 2, Power = -8, MaxLevel = 1, MaxCount = 1, Removable = true, Icon = "🎯", Description = "Tractor beam that recalls all your dropped capsules every 45 seconds, free." },
	{ Id = "research_lab", Name = "Research Lab", Category = "Services", W = 3, D = 3, Cost = 15000, Level = 15, CmdLevel = 2, Power = -12, MaxLevel = 5, MaxCount = 1, Removable = true, Icon = "🧪", Description = "+3% XP and +2% sell value per level." },
	{ Id = "launch_pad", Name = "Market Launch Pad", Category = "Services", W = 4, D = 4, Cost = 25000, Level = 18, CmdLevel = 2, Power = -20, MaxLevel = 5, MaxCount = 1, Removable = true, Icon = "🚀", Description = "Launches your silo to market every 60s with +15% payout (+5% per level)." },
	-- logistics
	{ Id = "conveyor", Name = "Conveyor Belt", Category = "Logistics", W = 1, D = 1, Cost = 20, Level = 4, CmdLevel = 1, Power = 0, MaxLevel = 1, Removable = true, Icon = "➡", Description = "Links production buildings to storage. Chain tiles edge-to-edge." },
	-- production
	{ Id = "extractor_drill", Name = "Extractor Drill", Category = "Production", W = 2, D = 2, Cost = 1500, Level = 7, CmdLevel = 1, Power = -6, MaxLevel = 5, Output = { drilled_dust = 0.04 }, Removable = true, Icon = "⛏", Description = "Drills regolith out of the ground." },
	{ Id = "deep_drill", Name = "Deep Core Drill", Category = "Production", W = 3, D = 3, Cost = 40000, Level = 22, CmdLevel = 3, Power = -18, MaxLevel = 5, Output = { drilled_dust = 0.18 }, Removable = true, Icon = "🛠", Description = "A much bigger drill." },
	{ Id = "pressure_chamber", Name = "Pressure Chamber", Category = "Production", W = 3, D = 2, Cost = 5000, Level = 11, CmdLevel = 1, Power = -10, MaxLevel = 5, Input = { AnyDust = 0.2 }, Output = { dust_brick = 0.1 }, Removable = true, Icon = "🗜", Description = "Compresses 2 kg of dust into a 1 kg brick worth far more." },
	{ Id = "stone_press", Name = "Stone Press", Category = "Production", W = 3, D = 3, Cost = 30000, Level = 20, CmdLevel = 2, Power = -18, MaxLevel = 5, Input = { AnyDust = 0.3, AnyDebris = 0.05 }, Output = { moon_stone = 0.2 }, Removable = true, Icon = "🧱", Description = "Fuses dust and debris into moon stone blocks." },
	{ Id = "crystal_refinery", Name = "Crystal Refinery", Category = "Production", W = 3, D = 3, Cost = 150000, Level = 26, CmdLevel = 3, Power = -25, MaxLevel = 5, Input = { Crystal = 0.05 }, Output = { refined_crystal = 0.05 }, Gems = 0.2, Removable = true, Icon = "💎", Description = "Refines crystal debris. Produces 1 gem per 5 kg refined." },
	{ Id = "helium_extractor", Name = "Helium-3 Extractor", Category = "Production", W = 3, D = 3, Cost = 600000, Level = 30, CmdLevel = 4, Power = -35, MaxLevel = 5, Output = { helium3_cell = 0.03 }, Removable = true, Icon = "⚗", Description = "Harvests helium-3 from the regolith. Very valuable fuel cells." },
	-- power
	{ Id = "solar_post", Name = "Solar Post", Category = "Power", W = 1, D = 1, Cost = 150, Level = 5, CmdLevel = 1, Power = 4, MaxLevel = 1, Removable = true, Icon = "☀", Description = "+4 kW." },
	{ Id = "solar_panel", Name = "Solar Panel", Category = "Power", W = 2, D = 2, Cost = 900, Level = 8, CmdLevel = 1, Power = 12, MaxLevel = 1, Removable = true, Icon = "🔆", Description = "+12 kW." },
	{ Id = "solar_tracker", Name = "Solar Tracker", Category = "Power", W = 3, D = 3, Cost = 8000, Level = 16, CmdLevel = 2, Power = 32, MaxLevel = 1, Removable = true, Icon = "🌞", Description = "+32 kW. Follows the sun." },
	{ Id = "fusion_reactor", Name = "Fusion Reactor", Category = "Power", W = 4, D = 4, Cost = 750000, Level = 35, CmdLevel = 4, Power = 160, MaxLevel = 1, MaxCount = 2, Removable = true, Icon = "☢", Description = "+160 kW of clean fusion power." },
	{ Id = "battery_bank", Name = "Battery Bank", Category = "Power", W = 2, D = 2, Cost = 4000, Level = 12, CmdLevel = 1, Power = 0, MaxLevel = 1, MaxCount = 3, Removable = true, Icon = "🔋", Description = "+50% robot charging speed per bank." },
	-- decor
	{ Id = "foundation_tile", Name = "Foundation Tile", Category = "Decor", W = 1, D = 1, Cost = 5, Level = 1, CmdLevel = 1, Power = 0, MaxLevel = 1, Removable = true, Icon = "⬛", Description = "Decorative floor tile." },
	{ Id = "lamp_post", Name = "Lamp Post", Category = "Decor", W = 1, D = 1, Cost = 60, Level = 2, CmdLevel = 1, Power = 0, MaxLevel = 1, Removable = true, Icon = "💡", Description = "Lights up your base." },
	{ Id = "colony_flag", Name = "Colony Flag", Category = "Decor", W = 1, D = 1, Cost = 100, Level = 2, CmdLevel = 1, Power = 0, MaxLevel = 1, Removable = true, Icon = "🚩", Description = "Plant your flag." },
	{ Id = "antenna_mast", Name = "Antenna Mast", Category = "Decor", W = 1, D = 1, Cost = 400, Level = 6, CmdLevel = 1, Power = 0, MaxLevel = 1, Removable = true, Icon = "📡", Description = "Talk to Earth. Looks great at night." },
	{ Id = "hab_dome", Name = "Hab Dome", Category = "Decor", W = 3, D = 3, Cost = 2500, Level = 8, CmdLevel = 1, Power = 0, MaxLevel = 1, Removable = true, Icon = "⛺", Description = "Where your crew sleeps." },
	{ Id = "greenhouse_dome", Name = "Greenhouse", Category = "Decor", W = 3, D = 3, Cost = 12000, Level = 14, CmdLevel = 2, Power = 0, MaxLevel = 1, Removable = true, Icon = "🌱", Description = "The only plants on the moon." },
	{ Id = "astronaut_statue", Name = "Astronaut Statue", Category = "Decor", W = 2, D = 2, Cost = 50000, Level = 20, CmdLevel = 2, Power = 0, MaxLevel = 1, MaxCount = 1, Removable = true, Icon = "🗿", Description = "A monument to your cleaning career." },
}

local byId: { [string]: BuildingDef } = {}
for i, b in list do
	byId[b.Id] = b
	;(b :: any).Order = i
end

-- Command center progression
local COMMAND = {
	MaxBuildings = { 14, 26, 40, 60, 90 },
	UpgradeCost = { 4000, 60000, 900000, 12000000 },
	LevelReq = { 1, 8, 18, 30, 45 },
}

return {
	List = list,
	ById = byId,
	Categories = { "Storage", "Services", "Logistics", "Production", "Power", "Decor" },
	Command = COMMAND,
	Get = function(id: string): BuildingDef?
		return byId[id]
	end,
}
