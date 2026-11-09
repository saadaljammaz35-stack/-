--!nonstrict
-- Zone unlocking, fast travel, orbital launch, zone-lock enforcement and movement sanity
-- checks (anti-exploit): speed/teleport detection with rubber-banding and kick threshold.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local Format = require(Shared.Util.Format)
local MapLayout = require(Shared.MapLayout)
local Zones = require(Shared.Config.Zones)
local Net = require(Shared.Net)
local Registry = require(script.Parent.Registry)

local ZoneService = {}

type Track = { Pos: Vector3, Time: number, SafePos: Vector3, Violations: number, WindowStart: number, TeleportGrace: number, Zone: string, LastTp: number }
local tracks: { [Player]: Track } = {}

local function notify(player: Player, text: string, kind: string?)
	Net.Event("Notify"):FireClient(player, { Text = text, Kind = kind or "Info", Icon = "🗺" })
end

function ZoneService:ZoneOf(player: Player): string?
	local t = tracks[player]
	return t and t.Zone
end

function ZoneService:NearStation(player: Player, station: string, dist: number): boolean
	local character = player.Character
	local hrp = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not hrp then
		return false
	end
	local pos = MapLayout.StationPosition(station)
	return (Vector3.new(hrp.Position.X, 0, hrp.Position.Z) - Vector3.new(pos.X, 0, pos.Z)).Magnitude <= dist
end

function ZoneService:TeleportPlayer(player: Player, pos: Vector3): (boolean, string?)
	local character = player.Character
	local hrp = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not hrp or not character then
		return false, "No character."
	end
	if Registry.CapsuleService then
		Registry.CapsuleService:Drop(player)
	end
	if Registry.VehicleService then
		Registry.VehicleService:Exit(player)
	end
	local t = tracks[player]
	if t then
		t.TeleportGrace = os.clock() + 3
		t.SafePos = pos
		t.Pos = pos
	end
	character:PivotTo(CFrame.new(pos + Vector3.new(0, 3, 0)))
	hrp.AssemblyLinearVelocity = Vector3.zero
	Net.Unreliable("WorldFX"):FireAllClients({ Kind = "Warp", Pos = pos })
	return true
end

function ZoneService:Unlock(player: Player, profile, zoneId: string): (boolean, string?)
	local zone = Zones.ById[zoneId]
	if not zone then
		return false, "Unknown zone."
	end
	if profile.Zones[zoneId] then
		return false, "Already unlocked."
	end
	-- linear progression: previous zone required
	local prev = Zones.List[zone.Index - 1]
	if prev and not profile.Zones[prev.Id] then
		return false, "Unlock " .. prev.Name .. " first."
	end
	if profile.Level < zone.Level then
		return false, string.format("Requires level %d.", zone.Level)
	end
	if not Registry.EconomyService:Spend(player, zone.Cost) then
		return false, "You need " .. Format.Credits(zone.Cost) .. "."
	end
	profile.Zones[zoneId] = true
	Registry.DataService:Mark(player, "Zones")
	local count = 0
	for _, v in profile.Zones do
		if v then
			count += 1
		end
	end
	Registry.DataService:MaxStat(player, "ZonesUnlocked", count)
	Net.Event("Reward"):FireClient(player, { Kind = "Zone", Zone = zoneId, Name = zone.Name })
	return true, zone.Name .. " unlocked!"
end

function ZoneService:FastTravel(player: Player, profile, zoneId: string): (boolean, string?)
	local t = tracks[player]
	if t and os.clock() - t.LastTp < GameConfig.TeleportCooldown then
		return false, "Fast travel is recharging..."
	end
	if zoneId ~= "hub" then
		local zone = Zones.ById[zoneId]
		if not zone then
			return false, "Unknown zone."
		end
		if not profile.Zones[zoneId] then
			return false, "Unlock " .. zone.Name .. " first."
		end
	end
	if t then
		t.LastTp = os.clock()
	end
	return self:TeleportPlayer(player, Registry.WorldService:GetSpawn(zoneId))
end

------------------------------------------------------------------ enforcement

local function check(player: Player, t: Track, dt: number)
	local character = player.Character
	local hrp = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
	local hum = character and character:FindFirstChildOfClass("Humanoid")
	if not hrp or not hum or hum.Health <= 0 then
		return
	end
	local pos = hrp.Position
	local now = os.clock()
	local zone = MapLayout.ZoneAt(pos)
	local profile = Registry.DataService:Get(player)
	if t.Zone ~= zone then
		t.Zone = zone
		player:SetAttribute("Zone", zone)
		Registry.PlayerService:ApplyMovement(player)
	end
	-- locked zone
	if profile and zone ~= "hub" and Zones.ById[zone] and not profile.Zones[zone] then
		notify(player, Zones.ById[zone].Name .. " is locked. Unlock it at the zone gate.", "Warning")
		if Registry.VehicleService and Registry.VehicleService:IsDriving(player) then
			Registry.VehicleService:Recall(player, "Your vehicle was towed back to the garage.")
		end
		ZoneService:TeleportPlayer(player, Registry.WorldService.HubSpawn)
		return
	end
	-- fell out of the world
	if pos.Y < -160 then
		if Registry.VehicleService and Registry.VehicleService:IsDriving(player) then
			Registry.VehicleService:Recall(player, "Your vehicle was towed back to the garage.")
		end
		ZoneService:TeleportPlayer(player, Registry.WorldService.HubSpawn)
		return
	end
	if now < t.TeleportGrace then
		t.Pos = pos
		t.Time = now
		return
	end
	-- horizontal speed sanity check
	local flat = Vector3.new(pos.X - t.Pos.X, 0, pos.Z - t.Pos.Z).Magnitude
	local speed = math.max(hum.WalkSpeed, character:GetAttribute("VehicleSpeed") or 0)
	local allowed = (speed * GameConfig.MaxSpeedLeniency + 14 + (character:GetAttribute("AirJumps") or 0) * 10) * dt + 6
	if flat > allowed then
		t.Violations += 1
		if now - t.WindowStart > 120 then
			t.WindowStart = now
			t.Violations = 1
		end
		if t.Violations >= GameConfig.ViolationKickThreshold then
			player:Kick("Unusual movement detected.")
			return
		end
		if t.Violations % 3 == 0 then
			-- rubber band to the last safe position
			if Registry.VehicleService then
				Registry.VehicleService:Exit(player)
			end
			character:PivotTo(CFrame.new(t.SafePos + Vector3.new(0, 3, 0)))
			hrp.AssemblyLinearVelocity = Vector3.zero
			t.Pos = t.SafePos
			t.Time = now
			return
		end
	else
		t.SafePos = pos
	end
	t.Pos = pos
	t.Time = now
end

function ZoneService:Init() end

function ZoneService:Start()
	local R = Registry.Router
	R.Register("UnlockZone", function(player, profile, payload)
		if type(payload.Id) ~= "string" then
			return false, "Bad zone"
		end
		return self:Unlock(player, profile, payload.Id)
	end, 2, 4)
	R.Register("FastTravel", function(player, profile, payload)
		if type(payload.Zone) ~= "string" then
			return false, "Bad zone"
		end
		return self:FastTravel(player, profile, payload.Zone)
	end, 1, 2)

	game:GetService("ProximityPromptService").PromptTriggered:Connect(function(prompt, player)
		local action = prompt:GetAttribute("Action")
		local profile = Registry.DataService:Get(player)
		if not profile then
			return
		end
		if action == "UnlockZone" then
			local ok, msg = self:Unlock(player, profile, prompt:GetAttribute("ZoneId"))
			if msg then
				notify(player, msg, ok and "Good" or "Warning")
			end
		elseif action == "OrbitalLaunch" then
			if not profile.Zones.orbital_ring then
				local z = Zones.ById.orbital_ring
				local ok, msg = self:Unlock(player, profile, "orbital_ring")
				if not ok then
					notify(player, string.format("%s (Orbital Ring: level %d, %s)", msg or "Locked", z.Level, Format.Credits(z.Cost)), "Warning")
					return
				end
			end
			Net.Unreliable("WorldFX"):FireAllClients({ Kind = "Launch", Pos = prompt.Parent and prompt.Parent:IsA("BasePart") and prompt.Parent.Position or Vector3.zero })
			self:TeleportPlayer(player, Registry.WorldService:GetSpawn("orbital_ring"))
		elseif action == "ReturnToHub" then
			self:TeleportPlayer(player, Registry.WorldService.HubSpawn)
		elseif action == "Deposit" then
			local ok, msg = Registry.EconomyService:Deposit(player, false)
			if msg then
				notify(player, msg, ok and "Good" or "Warning")
			end
		end
	end)

	local function onCharacter(player: Player, character: Model)
		local hrp = character:WaitForChild("HumanoidRootPart", 10)
		if hrp then
			local p = (hrp :: BasePart).Position
			local old = tracks[player]
			tracks[player] = { Pos = p, Time = os.clock(), SafePos = p, Violations = old and old.Violations or 0, WindowStart = os.clock(), TeleportGrace = os.clock() + 4, Zone = "hub", LastTp = old and old.LastTp or 0 }
		end
	end
	local function watch(player: Player)
		player.CharacterAdded:Connect(function(character)
			onCharacter(player, character)
		end)
		if player.Character then
			task.spawn(onCharacter, player, player.Character)
		end
	end
	Players.PlayerAdded:Connect(watch)
	for _, p in Players:GetPlayers() do
		watch(p)
	end
	Players.PlayerRemoving:Connect(function(player)
		tracks[player] = nil
	end)
	task.spawn(function()
		while true do
			local dt = 0.5
			task.wait(dt)
			for player, t in tracks do
				if player.Parent then
					local ok, err = pcall(check, player, t, dt)
					if not ok then
						warn("[ZoneService] check error: " .. tostring(err))
					end
				end
			end
		end
	end)
end

return ZoneService
