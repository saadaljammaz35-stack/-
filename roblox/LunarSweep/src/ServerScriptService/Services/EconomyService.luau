--!nonstrict
-- Currencies, XP/levels, selling (deposits), boosts and the market board.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local Resources = require(Shared.Config.Resources)
local Zones = require(Shared.Config.Zones)
local Crates = require(Shared.Config.Crates)
local Net = require(Shared.Net)
local Registry = require(script.Parent.Registry)

local EconomyService = {}

local function notify(player: Player, text: string, kind: string?, icon: string?)
	Net.Event("Notify"):FireClient(player, { Text = text, Kind = kind or "Info", Icon = icon })
end
EconomyService.Notify = notify

------------------------------------------------------------------ boosts

function EconomyService:BoostActive(profile: any, id: string): boolean
	local t = profile.Boosts and profile.Boosts[id]
	return t ~= nil and t > os.time()
end

function EconomyService:AddBoost(player: Player, id: string, minutes: number)
	local profile = Registry.DataService:Get(player)
	if not profile then
		return
	end
	local now = os.time()
	local current = profile.Boosts[id] or 0
	profile.Boosts[id] = math.max(current, now) + minutes * 60
	Registry.DataService:Mark(player, "Boosts")
	local b = Crates.Boosts[id]
	notify(player, string.format("%s boost active for %d minutes!", b and b.Name or id, minutes), "Good", b and b.Icon)
end

------------------------------------------------------------------ currencies

function EconomyService:AddCredits(player: Player, amount: number, earned: boolean?)
	local profile = Registry.DataService:Get(player)
	if not profile or amount <= 0 or amount ~= amount then
		return
	end
	amount = math.floor(amount * 100) / 100
	profile.Credits += amount
	Registry.DataService:Mark(player, "Credits")
	if earned ~= false then
		Registry.DataService:AddStat(player, "CreditsEarned", amount)
	end
end

function EconomyService:Spend(player: Player, amount: number): boolean
	local profile = Registry.DataService:Get(player)
	if not profile or amount ~= amount or amount < 0 then
		return false
	end
	if profile.Credits + 1e-6 < amount then
		return false
	end
	profile.Credits = math.max(0, profile.Credits - amount)
	Registry.DataService:Mark(player, "Credits")
	return true
end

function EconomyService:AddGems(player: Player, amount: number)
	local profile = Registry.DataService:Get(player)
	if not profile or amount <= 0 then
		return
	end
	profile.Gems += math.floor(amount)
	Registry.DataService:Mark(player, "Gems")
end

function EconomyService:SpendGems(player: Player, amount: number): boolean
	local profile = Registry.DataService:Get(player)
	if not profile or profile.Gems < amount then
		return false
	end
	profile.Gems -= amount
	Registry.DataService:Mark(player, "Gems")
	return true
end

function EconomyService:LabLevel(player: Player): number
	local base = Registry.BaseService
	return base and base:BuildingLevelSum(player, "research_lab") or 0
end

function EconomyService:AddXP(player: Player, amount: number)
	local profile = Registry.DataService:Get(player)
	if not profile or amount <= 0 then
		return
	end
	local mult = Formulas.XpMultiplier(profile, self:LabLevel(player))
	if self:BoostActive(profile, "xp2x") then
		mult *= 2
	end
	local season = Registry.EventService and Registry.EventService:Season()
	if season then
		mult *= 1 + season.XpBonus
	end
	mult *= 1 + Registry.PlayerService:HelperBonus(player, "Xp")
	profile.XP += amount * mult
	local leveled = false
	while profile.Level < GameConfig.MaxLevel and profile.XP >= Formulas.XpToNext(profile.Level) do
		profile.XP -= Formulas.XpToNext(profile.Level)
		profile.Level += 1
		leveled = true
		local gems = 1 + math.floor(profile.Level / 10)
		profile.Gems += gems
		Net.Event("Reward"):FireClient(player, { Kind = "LevelUp", Level = profile.Level, Gems = gems })
	end
	if profile.Level >= GameConfig.MaxLevel then
		profile.XP = math.min(profile.XP, Formulas.XpToNext(profile.Level))
	end
	Registry.DataService:Mark(player, "XP")
	if leveled then
		Registry.DataService:Mark(player, "Level")
		Registry.DataService:Mark(player, "Gems")
		Registry.DataService:MaxStat(player, "Level", profile.Level)
	end
end

------------------------------------------------------------------ selling

-- Credits multiplier applied to every sale (upgrades, rebirths, boosts, community bonus)
function EconomyService:SaleMultiplier(player: Player, profile: any, fromSilo: boolean?): number
	local m = Formulas.SellMultiplier(profile, fromSilo, self:LabLevel(player))
	if self:BoostActive(profile, "credits2x") then
		m *= 2
	end
	if Registry.EventService and Registry.EventService:CommunityBoostActive() then
		m *= 2
	end
	return m
end

-- Sells a contents table. Returns credits earned.
function EconomyService:SellContents(player: Player, contents: { [string]: number }, fromSilo: boolean?, extraMult: number?): number
	local profile = Registry.DataService:Get(player)
	if not profile then
		return 0
	end
	local mods = Formulas.MarketMods(contents, os.time())
	local value = Formulas.ContentsValue(contents, profile, mods)
	value *= self:SaleMultiplier(player, profile, fromSilo) * (extraMult or 1)
	if value <= 0 then
		return 0
	end
	self:AddCredits(player, value, true)
	local kg = Formulas.ContentsKg(contents)
	self:AddXP(player, math.max(1, kg * 2 * Formulas.Tier(profile)))
	return value
end

-- Deposit the player's container (and carried capsule) at the Dust Exchange.
-- `remote` = deposit via Uplink from anywhere (fee unless the prestige perk is owned).
function EconomyService:Deposit(player: Player, remote: boolean?): (boolean, string?)
	local profile = Registry.DataService:Get(player)
	if not profile then
		return false, "Loading..."
	end
	local contents = profile.Contents
	local carried = Registry.CapsuleService and Registry.CapsuleService:TakeCarried(player)
	if carried then
		for res, kg in carried do
			contents[res] = (contents[res] or 0) + kg
		end
	end
	-- a vehicle parked (or driven) next to the exchange unloads its hopper too
	local cargo = not remote and Registry.VehicleService and Registry.VehicleService:TakeCargoNear(player, 45)
	if cargo then
		for res, kg in cargo do
			contents[res] = (contents[res] or 0) + kg
		end
	end
	if Formulas.ContentsKg(contents) <= 0.0001 then
		return false, "Your container is empty. Go clean some dust!"
	end
	local fee = 1
	if remote then
		local perk = (profile.Perks.uplink_perk or 0) > 0
		local up = (profile.Upgrades.uplink_deposit or 0) > 0
		if not perk and not up then
			return false, "You need the Uplink Deposit upgrade."
		end
		fee = perk and 1 or 0.9
	end
	local kg = Formulas.ContentsKg(contents)
	local value = self:SellContents(player, contents, false, fee)
	profile.Contents = {}
	Registry.DataService:Mark(player, "Contents")
	Registry.DataService:AddStat(player, "Deposits", 1)
	Registry.PlayerService:UpdateFill(player)
	Net.Event("Reward"):FireClient(player, { Kind = "Deposit", Credits = value, Kg = kg })
	return true, string.format("Sold %s for %s", Format.Kg(kg), Format.Credits(value))
end

------------------------------------------------------------------ market board

local function updateMarketBoard()
	local exchange = Registry.HubBuilder and Registry.HubBuilder.Stations.Exchange
	if not exchange then
		return
	end
	local board = exchange:FindFirstChild("MarketBoard", true)
	local gui = board and board:FindFirstChild("MarketGui")
	local label = gui and gui:FindFirstChildOfClass("TextLabel")
	if not label then
		return
	end
	local now = os.time()
	local lines = { "MARKET TODAY" }
	for _, zone in Zones.List do
		local res = Resources.ById[zone.DustResource]
		if res then
			local mod = Formulas.MarketMod(res.Id, now)
			local arrow = mod >= 1 and "▲" or "▼"
			table.insert(lines, string.format("%s %s %+d%%", res.Name, arrow, math.floor((mod - 1) * 100 + 0.5)))
		end
	end
	label.TextScaled = true
	label.Text = table.concat(lines, "\n")
end

function EconomyService:Init() end

function EconomyService:Start()
	Registry.Router.Register("Deposit", function(player, profile, payload)
		local remote = payload.Remote == true
		if not remote and not Registry.ZoneService:NearStation(player, "Exchange", 24) and not Registry.BaseService:NearOwnDeposit(player, 18) then
			return false, "Walk to the Dust Exchange or your base hopper to deposit."
		end
		local ok, msg = self:Deposit(player, remote)
		return ok, msg
	end, 2, 4)

	task.spawn(function()
		Registry.WorldService:WaitReady()
		while true do
			pcall(updateMarketBoard)
			task.wait(30)
		end
	end)

	-- expire boosts cleanly for UI
	task.spawn(function()
		while true do
			task.wait(15)
			local now = os.time()
			for _, player in Players:GetPlayers() do
				local profile = Registry.DataService:Get(player)
				if profile then
					local changed = false
					for id, t in profile.Boosts do
						if t <= now then
							profile.Boosts[id] = nil
							changed = true
						end
					end
					if changed then
						Registry.DataService:Mark(player, "Boosts")
					end
				end
			end
		end
	end)
end

return EconomyService
