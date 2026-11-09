--!strict
-- Daily and weekly mission templates. Targets and credit rewards scale with the player's
-- progression tier (highest unlocked zone index, 1..9) so missions stay meaningful.
-- Scale: "flat" = Base * (1 + 0.45 * (tier - 1)); "kg" = Base * 1.85 ^ (tier - 1);
--        "credits" = Base * 3.3 ^ (tier - 1); "none" = Base.

export type MissionDef = {
	Id: string,
	Key: string,
	Text: string,
	Base: number,
	Scale: string,
	RewardCredits: number, -- scaled with 3.3 ^ (tier - 1)
	RewardGems: number,
	RewardXp: number, -- multiplied by player level
}

local daily: { MissionDef } = {
	{ Id = "d_clean", Key = "CellsCleaned", Text = "Clean %s dust patches", Base = 600, Scale = "flat", RewardCredits = 120, RewardGems = 2, RewardXp = 20 },
	{ Id = "d_kg", Key = "KgCollected", Text = "Collect %s kg of dust", Base = 6, Scale = "kg", RewardCredits = 150, RewardGems = 2, RewardXp = 20 },
	{ Id = "d_credits", Key = "CreditsEarned", Text = "Earn %s credits", Base = 300, Scale = "credits", RewardCredits = 100, RewardGems = 2, RewardXp = 20 },
	{ Id = "d_deposit", Key = "Deposits", Text = "Deposit dust %s times", Base = 6, Scale = "flat", RewardCredits = 120, RewardGems = 2, RewardXp = 15 },
	{ Id = "d_pickups", Key = "Pickups", Text = "Collect %s debris pickups", Base = 25, Scale = "flat", RewardCredits = 140, RewardGems = 2, RewardXp = 20 },
	{ Id = "d_rare", Key = "RarePickups", Text = "Find %s rare debris", Base = 3, Scale = "none", RewardCredits = 200, RewardGems = 3, RewardXp = 25 },
	{ Id = "d_sector", Key = "SectorsCleared", Text = "Help finish %s sectors", Base = 1, Scale = "none", RewardCredits = 250, RewardGems = 3, RewardXp = 30 },
	{ Id = "d_capsule", Key = "CapsulesPacked", Text = "Pack %s capsules", Base = 3, Scale = "none", RewardCredits = 120, RewardGems = 2, RewardXp = 15 },
	{ Id = "d_robot", Key = "RobotKg", Text = "Your robots collect %s kg", Base = 3, Scale = "kg", RewardCredits = 180, RewardGems = 2, RewardXp = 20 },
	{ Id = "d_play", Key = "PlayMinutes", Text = "Play for %s minutes", Base = 20, Scale = "none", RewardCredits = 150, RewardGems = 3, RewardXp = 20 },
	{ Id = "d_silo", Key = "SiloSales", Text = "Sell your base silo %s times", Base = 2, Scale = "none", RewardCredits = 160, RewardGems = 2, RewardXp = 20 },
	{ Id = "d_team", Key = "TeamCells", Text = "Clean %s patches next to other players", Base = 250, Scale = "flat", RewardCredits = 200, RewardGems = 3, RewardXp = 25 },
	{ Id = "d_upgrade", Key = "UpgradesBought", Text = "Buy %s upgrade levels", Base = 2, Scale = "none", RewardCredits = 150, RewardGems = 2, RewardXp = 20 },
	{ Id = "d_build", Key = "BuildingsPlaced", Text = "Place %s base buildings", Base = 3, Scale = "none", RewardCredits = 150, RewardGems = 2, RewardXp = 20 },
}

local weekly: { MissionDef } = {
	{ Id = "w_clean", Key = "CellsCleaned", Text = "Clean %s dust patches", Base = 12000, Scale = "flat", RewardCredits = 2500, RewardGems = 20, RewardXp = 200 },
	{ Id = "w_kg", Key = "KgCollected", Text = "Collect %s kg of dust", Base = 120, Scale = "kg", RewardCredits = 3000, RewardGems = 20, RewardXp = 200 },
	{ Id = "w_credits", Key = "CreditsEarned", Text = "Earn %s credits", Base = 8000, Scale = "credits", RewardCredits = 2000, RewardGems = 20, RewardXp = 200 },
	{ Id = "w_sector", Key = "SectorsCleared", Text = "Help finish %s sectors", Base = 15, Scale = "none", RewardCredits = 3500, RewardGems = 25, RewardXp = 250 },
	{ Id = "w_rare", Key = "RarePickups", Text = "Find %s rare debris", Base = 40, Scale = "none", RewardCredits = 3000, RewardGems = 25, RewardXp = 250 },
	{ Id = "w_crate", Key = "CratesOpened", Text = "Open %s crates", Base = 5, Scale = "none", RewardCredits = 2500, RewardGems = 20, RewardXp = 200 },
	{ Id = "w_robot", Key = "RobotKg", Text = "Your robots collect %s kg", Base = 80, Scale = "kg", RewardCredits = 3000, RewardGems = 25, RewardXp = 250 },
	{ Id = "w_play", Key = "PlayMinutes", Text = "Play for %s minutes", Base = 240, Scale = "none", RewardCredits = 3000, RewardGems = 30, RewardXp = 250 },
	{ Id = "w_team", Key = "TeamCells", Text = "Clean %s patches next to other players", Base = 4000, Scale = "flat", RewardCredits = 3500, RewardGems = 30, RewardXp = 250 },
}

local byId: { [string]: MissionDef } = {}
for _, m in daily do
	byId[m.Id] = m
end
for _, m in weekly do
	byId[m.Id] = m
end

return {
	Daily = daily,
	Weekly = weekly,
	ById = byId,
	DailyCount = 3,
	WeeklyCount = 3,
	Get = function(id: string): MissionDef?
		return byId[id]
	end,
}
