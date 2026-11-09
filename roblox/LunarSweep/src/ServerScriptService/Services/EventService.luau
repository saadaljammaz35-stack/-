--!nonstrict
-- Seasonal events (by calendar month), random server events every 7-12 minutes
-- (Meteor Shower, Dust Storm, Solar Flare, Debris Frenzy), the server-wide
-- Community Clean-Up goal (fills -> 2x credits for everyone) and the event shop.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local Progression = require(Shared.Config.Progression)
local Zones = require(Shared.Config.Zones)
local Tools = require(Shared.Config.Tools)
local Containers = require(Shared.Config.Containers)
local Net = require(Shared.Net)
local Registry = require(script.Parent.Registry)

local EventService = {}

local active: { Kind: string, Zone: string?, EndsAt: number, Name: string }? = nil
local goal = { Progress = 0, Target = GameConfig.CommunityGoalPerPlayer, BoostEndsAt = 0, Completed = 0 }
local forcedSeason: string? = nil
local rng = Random.new()

local KINDS = {
	MeteorShower = { Name = "Meteor Shower", Duration = 150, Text = "Meteor shower over %s! Fresh meteorites are worth a fortune." },
	DustStorm = { Name = "Dust Storm", Duration = 180, Text = "A dust storm swept %s - extra dust everywhere (1.5x kg)!" },
	SolarFlare = { Name = "Solar Flare", Duration = 240, Text = "Solar flare! Base power output doubled." },
	DebrisFrenzy = { Name = "Debris Frenzy", Duration = 180, Text = "Debris frenzy! Twice the pickups, and they count double." },
}
EventService.Kinds = KINDS

------------------------------------------------------------------ seasonal

function EventService:Season(): any?
	if forcedSeason then
		return Progression.EventsById[forcedSeason]
	end
	local month = tonumber(os.date("!%m")) or 1
	for _, e in Progression.Events do
		for _, m in e.Months do
			if m == month then
				return e
			end
		end
	end
	return nil
end

function EventService:ForceSeason(id: string?)
	forcedSeason = id
	self:Broadcast()
end

function EventService:Tokens(profile): number
	local season = self:Season()
	if not season then
		return 0
	end
	return profile.EventTokens[season.Id] or 0
end

function EventService:SpendTokens(player: Player, profile, amount: number): boolean
	local season = self:Season()
	if not season then
		return false
	end
	local have = profile.EventTokens[season.Id] or 0
	if have < amount then
		return false
	end
	profile.EventTokens[season.Id] = have - amount
	Registry.DataService:Mark(player, "EventTokens")
	return true
end

function EventService:RollTokens(player: Player, profile, cells: number): number
	local season = self:Season()
	if not season or cells <= 0 then
		return 0
	end
	if rng:NextNumber() < season.DropChance then
		local n = rng:NextInteger(1, 3)
		profile.EventTokens[season.Id] = (profile.EventTokens[season.Id] or 0) + n
		Registry.DataService:Mark(player, "EventTokens")
		return n
	end
	return 0
end

------------------------------------------------------------------ server events

function EventService:IsActive(kind: string): boolean
	return active ~= nil and active.Kind == kind and os.time() < active.EndsAt
end

function EventService:KgMult(zoneId: string): number
	if active and active.Kind == "DustStorm" and active.Zone == zoneId and os.time() < active.EndsAt then
		return 1.5
	end
	return 1
end

function EventService:CommunityBoostActive(): boolean
	return os.time() < goal.BoostEndsAt
end

function EventService:AddCommunityProgress(cells: number)
	goal.Progress += cells
	goal.Target = GameConfig.CommunityGoalPerPlayer * math.max(1, #Players:GetPlayers())
	if goal.Progress >= goal.Target then
		goal.Progress = 0
		goal.Completed += 1
		goal.BoostEndsAt = os.time() + GameConfig.CommunityBoostSeconds
		for _, p in Players:GetPlayers() do
			Net.Event("Notify"):FireClient(p, { Text = "COMMUNITY GOAL REACHED! 2x credits for everyone for 3 minutes!", Kind = "Event", Icon = "🌕" })
		end
		self:Broadcast()
	end
end

local function pickZone(): string
	-- prefer zones where players are
	local candidates = {}
	for _, p in Players:GetPlayers() do
		local z = Registry.ZoneService:ZoneOf(p)
		if z and z ~= "hub" and Zones.ById[z] then
			table.insert(candidates, z)
		end
	end
	if #candidates == 0 then
		return "dusty_flats"
	end
	return candidates[rng:NextInteger(1, #candidates)]
end

function EventService:Trigger(kind: string, zoneId: string?)
	local def = KINDS[kind]
	if not def then
		return false
	end
	local zone = zoneId or pickZone()
	active = { Kind = kind, Zone = zone, EndsAt = os.time() + def.Duration, Name = def.Name }
	local zoneName = Zones.ById[zone] and Zones.ById[zone].Name or "the moon"
	if kind == "MeteorShower" then
		local positions = Registry.PickupService:MeteorShower(zone, 28, def.Duration)
		Net.Unreliable("WorldFX"):FireAllClients({ Kind = "Meteors", Positions = positions })
	elseif kind == "DustStorm" then
		Registry.SectorService:DustStorm(zone, 0.3)
		Net.Unreliable("WorldFX"):FireAllClients({ Kind = "DustStorm", Zone = zone })
	end
	for _, p in Players:GetPlayers() do
		Net.Event("Notify"):FireClient(p, { Text = string.format(def.Text, zoneName), Kind = "Event", Icon = "☄" })
	end
	self:Broadcast()
	return true
end

function EventService:State(): any
	local season = self:Season()
	return {
		Season = season and season.Id or nil,
		Active = active and os.time() < active.EndsAt and { Kind = active.Kind, Zone = active.Zone, EndsAt = active.EndsAt, Name = active.Name } or nil,
		Goal = { Progress = goal.Progress, Target = goal.Target, BoostEndsAt = goal.BoostEndsAt, Completed = goal.Completed },
		ServerTime = os.time(),
	}
end

function EventService:Broadcast()
	Net.Event("ServerEvent"):FireAllClients(self:State())
end

local function updateHologram()
	local plaza = workspace:FindFirstChild("Hub") and workspace.Hub:FindFirstChild("Plaza")
	local holo = plaza and plaza:FindFirstChild("GoalHolo")
	local gui = holo and holo:FindFirstChild("GoalGui")
	local label = gui and gui:FindFirstChild("Text")
	if label then
		if EventService:CommunityBoostActive() then
			label.Text = string.format("2X CREDITS! %ds", goal.BoostEndsAt - os.time())
		else
			label.Text = string.format("COMMUNITY CLEAN-UP %d%%", math.floor(goal.Progress / math.max(1, goal.Target) * 100))
		end
	end
	local booth = workspace:FindFirstChild("Hub") and workspace.Hub.Plaza:FindFirstChild("BoothSign")
	local bgui = booth and booth:FindFirstChild("EventGui")
	local bl = bgui and bgui:FindFirstChildOfClass("TextLabel")
	local season = EventService:Season()
	if bl then
		bl.Text = season and string.upper(season.Name) or "NO EVENT"
	end
end

------------------------------------------------------------------ event shop

local function buyEventItem(player: Player, profile, payload)
	local season = EventService:Season()
	if not season then
		return false, "No event is running."
	end
	local index = tonumber(payload.Index)
	local item = index and season.Shop[index]
	if not item then
		return false, "Unknown item."
	end
	if item.Type == "Tool" and profile.Tools[item.Id] then
		return false, "You already own this."
	end
	if item.Type == "Container" and profile.Containers[item.Id] then
		return false, "You already own this."
	end
	if item.Type == "Crate" then
		return Registry.CrateService:Open(player, profile, item.Id, false)
	end
	if not EventService:SpendTokens(player, profile, item.Price) then
		return false, "Not enough " .. season.TokenName .. "."
	end
	if item.Type == "Tool" then
		profile.Tools[item.Id] = true
		Registry.DataService:Mark(player, "Tools")
		return true, (Tools.ById[item.Id] and Tools.ById[item.Id].Name or item.Id) .. " unlocked!"
	elseif item.Type == "Container" then
		profile.Containers[item.Id] = true
		Registry.DataService:Mark(player, "Containers")
		return true, (Containers.ById[item.Id] and Containers.ById[item.Id].Name or item.Id) .. " unlocked!"
	elseif item.Type == "Boost" then
		Registry.EconomyService:AddBoost(player, item.Id, item.Minutes or 30)
		return true, item.Label
	elseif item.Type == "Gems" then
		Registry.EconomyService:AddGems(player, item.Amount or 0)
		return true, item.Label
	end
	return false, "Unknown item."
end

function EventService:Init() end

function EventService:Start()
	Registry.Router.Register("EventShopBuy", buyEventItem, 2, 4)
	Registry.Router.Register("GetServerEvent", function()
		return true, nil, self:State()
	end, 2, 4)
	Players.PlayerAdded:Connect(function(player)
		task.delay(3, function()
			if player.Parent then
				Net.Event("ServerEvent"):FireClient(player, self:State())
			end
		end)
	end)
	task.spawn(function()
		Registry.WorldService:WaitReady()
		local nextAt = os.time() + rng:NextInteger(180, 300)
		local lastBroadcast = 0
		while true do
			task.wait(2)
			local now = os.time()
			if active and now >= active.EndsAt then
				active = nil
				self:Broadcast()
			end
			if not active and now >= nextAt and #Players:GetPlayers() > 0 then
				local kinds = { "MeteorShower", "DustStorm", "SolarFlare", "DebrisFrenzy" }
				self:Trigger(kinds[rng:NextInteger(1, #kinds)])
				nextAt = now + rng:NextInteger(GameConfig.ServerEventMin, GameConfig.ServerEventMax)
			end
			if now - lastBroadcast >= 10 then
				lastBroadcast = now
				self:Broadcast()
			end
			pcall(updateHologram)
		end
	end)
end

return EventService
