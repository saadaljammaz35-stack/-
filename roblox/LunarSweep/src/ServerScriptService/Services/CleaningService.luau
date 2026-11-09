--!nonstrict
-- Server-authoritative sweeping. The client only sends where its tool head is; the server
-- validates tool, distance, rate, zone access and capacity, then cleans terrain cells,
-- collects nearby debris, grants XP, mission progress, event tokens and co-op bonuses.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local MapLayout = require(Shared.MapLayout)
local Zones = require(Shared.Config.Zones)
local Rarity = require(Shared.Config.Rarity)
local Resources = require(Shared.Config.Resources)
local Net = require(Shared.Net)
local Registry = require(script.Parent.Registry)

local CleaningService = {}

type StrokeState = { Last: number, LastPos: Vector3?, LastFullNotice: number, LastFx: number, LastShip: number, Rejects: number }
local states: { [Player]: StrokeState } = {}

local function stateOf(player: Player): StrokeState
	local s = states[player]
	if not s then
		s = { Last = 0, LastPos = nil, LastFullNotice = 0, LastFx = 0, LastShip = 0, Rejects = 0 }
		states[player] = s
	end
	return s
end

local function isFinite(v: Vector3): boolean
	return v.X == v.X and v.Y == v.Y and v.Z == v.Z and math.abs(v.X) < 1e5 and math.abs(v.Y) < 1e5 and math.abs(v.Z) < 1e5
end

local function equippedToolId(character: Model): string?
	local tool = character:FindFirstChildOfClass("Tool")
	if tool and tool:GetAttribute("CleaningTool") then
		return tool:GetAttribute("ToolId")
	end
	return nil
end

-- number of other players sweeping nearby (co-op bonus)
local function nearbySweepers(player: Player, pos: Vector3): number
	local n = 0
	local now = os.clock()
	for other, st in states do
		if other ~= player and other.Parent and now - st.Last < 3 and st.LastPos then
			if (st.LastPos - pos).Magnitude <= GameConfig.CoopRadius then
				n += 1
			end
		end
	end
	return n
end

function CleaningService:AddContents(player: Player, profile: any, byRes: { [string]: number })
	for res, kg in byRes do
		profile.Contents[res] = (profile.Contents[res] or 0) + kg
	end
	Registry.DataService:Mark(player, "Contents")
end

local function handleFull(player: Player, profile: any, st: StrokeState)
	local now = os.clock()
	-- Packer Drone helper: ship container to the silo
	local ship = Registry.PlayerService:HelperBonus(player, "AutoShip")
	if ship > 0 and now - st.LastShip > ship and Registry.BaseService:HasPlot(player) then
		st.LastShip = now
		local moved = Registry.BaseService:AddToSilo(player, profile.Contents)
		if moved > 0 then
			profile.Contents = {}
			Registry.DataService:Mark(player, "Contents")
			Registry.PlayerService:UpdateFill(player)
			Net.Event("Notify"):FireClient(player, { Text = string.format("Packer Drone shipped %s to your silo", Format.Kg(moved)), Kind = "Good", Icon = "📦" })
			return
		end
	end
	if (profile.Upgrades.auto_packer or 0) > 0 then
		local ok = Registry.CapsuleService:Pack(player, true)
		if ok then
			return
		end
	end
	if now - st.LastFullNotice > 6 then
		st.LastFullNotice = now
		Net.Event("Notify"):FireClient(player, { Text = "Container full! Deposit at the Dust Exchange or press Q to pack a capsule.", Kind = "Warning", Icon = "⚠" })
	end
end

function CleaningService:OnStroke(player: Player, pos: any)
	if typeof(pos) ~= "Vector3" or not isFinite(pos) then
		return
	end
	local st = stateOf(player)
	local now = os.clock()
	if now - st.Last < GameConfig.MinStrokeGap then
		return
	end
	local profile = Registry.DataService:Get(player)
	local character = player.Character
	if not profile or not character then
		return
	end
	local hrp = character:FindFirstChild("HumanoidRootPart") :: BasePart?
	local hum = character:FindFirstChildOfClass("Humanoid")
	if not hrp or not hum or hum.Health <= 0 then
		return
	end
	local toolId = equippedToolId(character)
	if not toolId or toolId ~= profile.EquippedTool then
		return
	end
	local stats = Formulas.ToolStats(profile, toolId)
	local flat = Vector3.new(pos.X - hrp.Position.X, 0, pos.Z - hrp.Position.Z)
	if flat.Magnitude > stats.Reach + stats.Radius + GameConfig.StrokeTolerance or math.abs(pos.Y - hrp.Position.Y) > 30 then
		st.Rejects += 1
		return
	end
	local zoneId = MapLayout.ZoneAt(pos)
	if zoneId ~= "hub" and not profile.Zones[zoneId] then
		return
	end
	local cap = Registry.PlayerService:Capacity(player, profile)
	local have = Formulas.ContentsKg(profile.Contents)
	local remaining = cap - have
	st.Last = now
	character:SetAttribute("Sweeping", now)
	if remaining <= 1e-4 then
		handleFull(player, profile, st)
		return
	end
	local p0 = pos
	if st.LastPos and now - (st.PrevTime or 0) < 0.7 and (pos - st.LastPos).Magnitude <= GameConfig.MaxStrokeSegment then
		p0 = st.LastPos
	end
	st.LastPos = pos
	st.PrevTime = now

	local coop = nearbySweepers(player, pos)
	local coopMult = 1 + math.min(GameConfig.CoopBonusMax, coop * GameConfig.CoopBonusPer)
	local events = Registry.EventService
	local result = Registry.SectorService:CleanSegment(p0, pos, stats.Radius, {
		Depth = stats.Depth * coopMult,
		Surge = stats.Surge,
		MaxKg = remaining,
		UserId = player.UserId,
		Unlocked = profile.Zones,
		KgMult = function(z)
			return events and events:KgMult(z) or 1
		end,
	})
	local collected = {}
	local addRes = result.ByRes
	local kgTotal = result.Kg
	remaining -= result.Kg
	-- debris pickups around the tool head
	local luck = stats.Luck + Registry.PlayerService:HelperBonus(player, "Luck")
	if Registry.EconomyService:BoostActive(profile, "luck2x") then
		luck = luck * 2 + 0.1
	end
	local picks = Registry.PickupService:CollectNear(pos, stats.Radius + stats.Magnet, math.max(0, remaining), luck, profile.Zones, events and events:IsActive("DebrisFrenzy") and 2 or 1)
	local rare = 0
	local meteors = 0
	for _, p in picks do
		addRes[p.Res] = (addRes[p.Res] or 0) + p.Kg
		kgTotal += p.Kg
		table.insert(collected, { p.Res, p.Pos })
		if Rarity.Get(p.Rarity).Order >= 3 then
			rare += 1
		end
		if p.Special == "Meteor" then
			meteors += 1
		end
	end
	if kgTotal <= 0 then
		return
	end
	self:AddContents(player, profile, addRes)
	Registry.PlayerService:UpdateFill(player)

	-- progression
	local zone = result.Zone and Zones.ById[result.Zone] or Zones.ById[zoneId]
	local xpPerCell = zone and zone.XpPerCell or 1
	Registry.EconomyService:AddXP(player, result.Cells * xpPerCell + #picks * 3 * xpPerCell + rare * 10 * xpPerCell)
	local ds = Registry.DataService
	if result.Cells > 0 then
		ds:AddStat(player, "CellsCleaned", result.Cells)
		if coop > 0 then
			ds:AddStat(player, "TeamCells", result.Cells)
		end
	end
	ds:AddStat(player, "KgCollected", kgTotal, { Zone = zoneId })
	if #picks > 0 then
		ds:AddStat(player, "Pickups", #picks)
	end
	if rare > 0 then
		ds:AddStat(player, "RarePickups", rare)
	end
	if meteors > 0 then
		ds:AddStat(player, "MeteorPickups", meteors)
	end
	-- seasonal tokens
	local tokens = 0
	if events then
		tokens = events:RollTokens(player, profile, result.Cells)
		events:AddCommunityProgress(result.Cells)
	end

	Net.Unreliable("CleanFX"):FireClient(player, {
		Kg = kgTotal,
		Cells = result.Cells,
		Picks = collected,
		Coop = coop,
		Tokens = tokens,
		Full = remaining - (kgTotal - result.Kg) <= 1e-4,
	})
	if now - st.LastFx > 0.35 then
		st.LastFx = now
		Net.Unreliable("WorldFX"):FireAllClients({ Kind = "Sweep", UserId = player.UserId, Pos = pos })
	end
end

local function sectorReward(sector, contrib: { [number]: number })
	local zone = Zones.ById[sector.ZoneId]
	if not zone then
		return
	end
	local res = Resources.ById[zone.DustResource]
	for userId, cells in contrib do
		local player = Players:GetPlayerByUserId(userId)
		local profile = player and Registry.DataService:Get(player)
		if player and profile then
			local share = cells / math.max(1, sector.Total)
			if share >= 0.08 then
				local bounty = 1 + 0.3 * (profile.Upgrades.region_bounty or 0)
				local credits = sector.Total * zone.DustPerCell * (res and res.Value or 1) * 2.5 * math.min(1, share * 1.5) * bounty
				credits *= Registry.EconomyService:SaleMultiplier(player, profile, false)
				Registry.EconomyService:AddCredits(player, credits, true)
				local gems = share >= 0.25 and 1 or 0
				if gems > 0 then
					Registry.EconomyService:AddGems(player, gems)
				end
				Registry.EconomyService:AddXP(player, sector.Total * zone.XpPerCell * 0.25 * share)
				Registry.DataService:AddStat(player, "SectorsCleared", 1)
				Net.Event("Reward"):FireClient(player, {
					Kind = "Sector",
					Number = sector.Number,
					Zone = zone.Name,
					Credits = credits,
					Gems = gems,
					Share = share,
				})
			end
		end
	end
	Net.Unreliable("WorldFX"):FireAllClients({ Kind = "SectorClear", Pos = sector.Center, Zone = sector.ZoneId })
end

function CleaningService:Init() end

function CleaningService:Start()
	Net.Event("Stroke").OnServerEvent:Connect(function(player, pos)
		local ok, err = pcall(self.OnStroke, self, player, pos)
		if not ok then
			warn("[CleaningService] stroke error: " .. tostring(err))
		end
	end)
	Registry.SectorService.SectorCleared:Connect(sectorReward)
	Players.PlayerRemoving:Connect(function(player)
		states[player] = nil
	end)
end

return CleaningService
