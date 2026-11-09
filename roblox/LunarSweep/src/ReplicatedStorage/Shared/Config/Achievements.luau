--!strict
-- Achievements are checked against lifetime stats in profile.Stats (plus a few derived stats).
-- Rewards are granted automatically the moment the goal is reached.

export type AchievementDef = {
	Id: string,
	Name: string,
	Stat: string,
	Goal: number,
	Gems: number,
	Title: string?,
	Description: string,
}

local list: { AchievementDef } = {}

local function tiered(stat: string, names: { string }, goals: { number }, gems: { number }, desc: string)
	for i, name in names do
		table.insert(list, {
			Id = string.lower(stat) .. "_" .. i,
			Name = name,
			Stat = stat,
			Goal = goals[i],
			Gems = gems[i],
			Title = i == #names and name or nil,
			Description = string.format(desc, goals[i]),
		})
	end
end

tiered("CellsCleaned", { "First Sweep", "Dust Bunny", "Tidy Astronaut", "Lunar Janitor", "Moon Polisher", "Crater Saint" }, { 1, 500, 5000, 50000, 500000, 5000000 }, { 1, 3, 6, 12, 30, 80 }, "Clean %d dust patches.")
tiered("KgCollected", { "Handful", "Bucketful", "Truckload", "Mountain Mover", "Gravity Well" }, { 10, 250, 5000, 100000, 2500000 }, { 2, 5, 12, 30, 80 }, "Collect %d kg of dust.")
tiered("CreditsEarned", { "Pocket Money", "Payday", "Investor", "Tycoon", "Lunar Billionaire" }, { 100, 10000, 1000000, 100000000, 1000000000 }, { 2, 5, 15, 40, 100 }, "Earn %d credits in total.")
tiered("SectorsCleared", { "Sector Clear", "District Clear", "Region Clear", "Hemisphere Hero" }, { 1, 25, 250, 2500 }, { 3, 8, 25, 70 }, "Help finish cleaning %d sectors.")
tiered("Pickups", { "Collector", "Hoarder", "Treasure Hunter", "Museum Curator" }, { 25, 500, 10000, 100000 }, { 2, 6, 18, 50 }, "Collect %d debris pickups.")
tiered("RarePickups", { "Shiny!", "Sharp Eyes", "Jewel Thief" }, { 1, 100, 2000 }, { 3, 10, 40 }, "Find %d rare-or-better debris.")
tiered("CapsulesPacked", { "Packer", "Logistics Pro", "Shipping Magnate" }, { 1, 100, 2500 }, { 2, 8, 25 }, "Pack %d capsules.")
tiered("RobotKg", { "Robot Friend", "Automation", "Robot Overlord" }, { 10, 2000, 200000 }, { 3, 12, 40 }, "Your robots collect %d kg.")
tiered("BuildingsPlaced", { "Architect", "City Planner", "Megastructure" }, { 1, 50, 400 }, { 2, 10, 30 }, "Place %d base buildings.")
tiered("CratesOpened", { "Unboxer", "Crate Addict", "Gambler of the Stars" }, { 1, 50, 500 }, { 2, 10, 30 }, "Open %d crates.")
tiered("Level", { "Rookie", "Veteran", "Commander", "Legend" }, { 10, 30, 60, 90 }, { 5, 15, 40, 100 }, "Reach level %d.")
tiered("ZonesUnlocked", { "Explorer", "Pathfinder", "Cartographer" }, { 3, 6, 9 }, { 5, 20, 60 }, "Unlock %d zones.")
tiered("SecretsFound", { "Curious", "Archaeologist", "Keeper of Secrets" }, { 1, 5, 10 }, { 5, 20, 80 }, "Find %d hidden relics.")
tiered("Rebirths", { "Relaunch", "Second Wind", "Eternal Cleaner" }, { 1, 5, 20 }, { 20, 60, 200 }, "Re-launch (rebirth) %d times.")
tiered("PlayMinutes", { "Clocked In", "Overtime", "Lifer" }, { 60, 1200, 12000 }, { 5, 20, 60 }, "Play for %d minutes.")
tiered("TradesDone", { "Trader", "Merchant" }, { 1, 25 }, { 3, 15 }, "Complete %d trades.")
tiered("MeteorPickups", { "Stargazer", "Meteor Chaser" }, { 1, 100 }, { 3, 20 }, "Collect %d fresh meteorites during meteor showers.")
tiered("LoginStreak", { "Regular", "Dedicated" }, { 7, 30 }, { 10, 50 }, "Log in %d days in a row.")

local byId: { [string]: AchievementDef } = {}
for i, a in list do
	byId[a.Id] = a
	;(a :: any).Order = i
end

return {
	List = list,
	ById = byId,
	Get = function(id: string): AchievementDef?
		return byId[id]
	end,
}
