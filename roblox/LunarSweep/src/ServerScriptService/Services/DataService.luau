--!nonstrict
-- Player profiles: loading with session locking, reconciliation, autosave, release on
-- leave / shutdown, replication of changed keys to the owning client, stat tracking.
--
-- Session lock: the saved document carries _Lock = { Job = JobId, T = time }. A server may
-- only load a profile whose lock is missing, its own, or older than SessionLockTimeout.
-- This prevents item duplication when a player hops between servers quickly.

local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")
local RunService = game:GetService("RunService")
local HttpService = game:GetService("HttpService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local Signal = require(Shared.Util.Signal)
local TableUtil = require(Shared.Util.TableUtil)
local Net = require(Shared.Net)

local DataService = {}

DataService.Profiles = {} :: { [Player]: any }
DataService.Loaded = Signal.new() -- (player, profile)
DataService.Releasing = Signal.new() -- (player, profile) just before final save
DataService.Progress = Signal.new() -- (player, key, amount, ctx)
DataService.StatChanged = Signal.new() -- (player, stat, value)
DataService.UsingMemory = false

local TEMPLATE = {
	Version = GameConfig.DataVersion,
	Credits = 0,
	Gems = 0,
	Stars = 0,
	Level = 1,
	XP = 0,
	Rebirths = 0,
	Tools = { toothbrush = true },
	EquippedTool = "toothbrush",
	Containers = { pocket_pouch = true },
	EquippedContainer = "pocket_pouch",
	Upgrades = {},
	Perks = {},
	Contents = {},
	Vehicles = {},
	VehicleCargo = {},
	Zones = { dusty_flats = true },
	Robots = {},
	RobotSeq = 0,
	Base = { Buildings = {}, Silo = {}, Seq = 0, LastTick = 0 },
	Stats = {},
	Missions = { DailyKey = 0, Daily = {}, WeeklyKey = 0, Weekly = {} },
	Achievements = {},
	Login = { LastDay = 0, Streak = 0, Pending = false, DayIndex = 1 },
	Secrets = {},
	Boosts = {},
	Crates = { Pity = {} },
	EventTokens = {},
	Settings = {
		Music = 0.5,
		Sfx = 0.8,
		SectorLines = true,
		Particles = true,
		AutoSweep = false,
		CameraShake = true,
		UiScale = 1,
		ShowRobots = true,
		ShowTutorial = true,
		FirstPerson = true,
	},
	Cosmetics = { Suit = 1, Visor = 1, Helmet = true, SuitOn = true },
	Tutorial = { Step = 0, Done = false },
	Title = "",
	FirstJoin = 0,
	LastLogin = 0,
	LastLogout = 0,
	PlaySeconds = 0,
}
DataService.Template = TEMPLATE

local store: DataStore? = nil
local memoryStore: { [string]: any } = {}
local dirty: { [Player]: { [string]: boolean } } = {}
local saving: { [Player]: boolean } = {}
local releasing: { [Player]: boolean } = {}

local function keyFor(userId: number): string
	return "u_" .. tostring(userId)
end

------------------------------------------------------------------ low level store

local function updateAsync(key: string, transform: (any) -> any): (boolean, any)
	if DataService.UsingMemory or not store then
		local old = memoryStore[key]
		local new = transform(old and TableUtil.DeepCopy(old) or nil)
		if new ~= nil then
			memoryStore[key] = TableUtil.DeepCopy(new)
			return true, new
		end
		return true, old
	end
	local s = store :: DataStore
	return pcall(function()
		return s:UpdateAsync(key, transform)
	end)
end

local function waitForBudget(kind: Enum.DataStoreRequestType)
	if DataService.UsingMemory then
		return
	end
	local t0 = os.clock()
	while DataStoreService:GetRequestBudgetForRequestType(kind) < 1 and os.clock() - t0 < 15 do
		task.wait(0.5)
	end
end

------------------------------------------------------------------ migrations & sanitising

local function migrate(data: any): any
	data.Version = data.Version or 1
	-- future migrations: if data.Version < 2 then ... end
	data.Version = GameConfig.DataVersion
	return data
end

-- DataStores only accept plain JSON-compatible tables; drop anything else defensively
local function sanitize(value: any, depth: number?): any
	local d = depth or 0
	if d > 12 then
		return nil
	end
	local t = type(value)
	if t == "number" then
		if value ~= value or value == math.huge or value == -math.huge then
			return 0
		end
		return value
	elseif t == "string" or t == "boolean" then
		return value
	elseif t == "table" then
		local out = {}
		for k, v in value do
			if type(k) == "string" or type(k) == "number" then
				out[k] = sanitize(v, d + 1)
			end
		end
		return out
	end
	return nil
end

------------------------------------------------------------------ load / save

local function loadProfile(player: Player): any?
	local key = keyFor(player.UserId)
	local jobId = game.JobId ~= "" and game.JobId or ("studio-" .. HttpService:GenerateGUID(false))
	DataService._JobId = DataService._JobId or jobId
	jobId = DataService._JobId
	for attempt = 1, GameConfig.LoadRetries do
		if not player.Parent then
			return nil
		end
		local force = attempt == GameConfig.LoadRetries
		waitForBudget(Enum.DataStoreRequestType.UpdateAsync)
		local lockedElsewhere = false
		local ok, result = updateAsync(key, function(old)
			old = old or {}
			local lock = old._Lock
			if lock and lock.Job ~= jobId and (os.time() - (lock.T or 0)) < GameConfig.SessionLockTimeout and not force then
				lockedElsewhere = true
				return nil
			end
			old._Lock = { Job = jobId, T = os.time() }
			return old
		end)
		if ok and result and not lockedElsewhere and result._Lock and result._Lock.Job == jobId then
			return result
		end
		if not ok then
			warn(string.format("[DataService] load attempt %d for %s failed: %s", attempt, player.Name, tostring(result)))
			if type(result) == "string" and (string.find(result, "StudioAccessToApisNotAllowed") or string.find(result, "403")) then
				warn("[DataService] DataStore access is disabled in Studio. Using in-memory data (progress will NOT persist). Enable 'Studio Access to API Services' in Game Settings > Security.")
				DataService.UsingMemory = true
				return loadProfile(player)
			end
		elseif lockedElsewhere then
			warn(string.format("[DataService] %s's profile is locked by another server, retrying (%d)", player.Name, attempt))
		end
		task.wait(math.min(2 ^ attempt, 10))
	end
	return nil
end

local function writeProfile(player: Player, profile: any, release: boolean): boolean
	local key = keyFor(player.UserId)
	local jobId = DataService._JobId
	local snapshot = sanitize(TableUtil.DeepCopy(profile))
	snapshot._Lock = (not release) and { Job = jobId, T = os.time() } or nil
	waitForBudget(Enum.DataStoreRequestType.UpdateAsync)
	local stolen = false
	local ok, err = updateAsync(key, function(old)
		if old and old._Lock and old._Lock.Job ~= jobId then
			stolen = true
			return nil
		end
		return snapshot
	end)
	if not ok then
		warn("[DataService] save failed for " .. player.Name .. ": " .. tostring(err))
		return false
	end
	if stolen then
		warn("[DataService] profile of " .. player.Name .. " is now owned by another server; not overwriting")
		return false
	end
	return true
end

function DataService:Save(player: Player, release: boolean?): boolean
	local profile = self.Profiles[player]
	if not profile or saving[player] then
		return false
	end
	saving[player] = true
	profile.LastSave = os.time()
	local ok = false
	for attempt = 1, 3 do
		ok = writeProfile(player, profile, release == true)
		if ok then
			break
		end
		task.wait(attempt * 2)
	end
	saving[player] = nil
	return ok
end

------------------------------------------------------------------ replication

local function flush()
	local deltaEvent = Net.Event("DataDelta")
	for player, keys in dirty do
		local profile = DataService.Profiles[player]
		if profile and player.Parent then
			local delta = {}
			for k in keys do
				delta[k] = profile[k]
			end
			deltaEvent:FireClient(player, delta)
		end
	end
	table.clear(dirty)
end

-- Mark a top-level key as changed (after mutating nested tables)
function DataService:Mark(player: Player, key: string)
	if not self.Profiles[player] then
		return
	end
	local d = dirty[player]
	if not d then
		d = {}
		dirty[player] = d
	end
	d[key] = true
end

function DataService:Set(player: Player, key: string, value: any)
	local profile = self.Profiles[player]
	if not profile then
		return
	end
	profile[key] = value
	self:Mark(player, key)
end

function DataService:Get(player: Player): any?
	return self.Profiles[player]
end

function DataService:WaitFor(player: Player, timeout: number?): any?
	local t0 = os.clock()
	while player.Parent and not self.Profiles[player] and os.clock() - t0 < (timeout or 30) do
		task.wait(0.2)
	end
	return self.Profiles[player]
end

------------------------------------------------------------------ stats & progress

-- Increment a lifetime stat and emit progress for missions/achievements
function DataService:AddStat(player: Player, stat: string, amount: number, ctx: any?)
	local profile = self.Profiles[player]
	if not profile or amount == 0 then
		return
	end
	local value = (profile.Stats[stat] or 0) + amount
	profile.Stats[stat] = value
	self:Mark(player, "Stats")
	self.Progress:Fire(player, stat, amount, ctx)
	self.StatChanged:Fire(player, stat, value)
end

-- Set a stat to max(current, value) (levels, streaks...)
function DataService:MaxStat(player: Player, stat: string, value: number)
	local profile = self.Profiles[player]
	if not profile then
		return
	end
	if (profile.Stats[stat] or 0) < value then
		profile.Stats[stat] = value
		self:Mark(player, "Stats")
		self.StatChanged:Fire(player, stat, value)
	end
end

------------------------------------------------------------------ lifecycle

local function onPlayerAdded(player: Player)
	local data = loadProfile(player)
	if not player.Parent then
		if data then
			-- player left during load: release the lock immediately
			DataService.Profiles[player] = data
			DataService:Save(player, true)
			DataService.Profiles[player] = nil
		end
		return
	end
	if not data then
		player:Kick("Your save data is busy in another server. Please rejoin in a minute.")
		return
	end
	data._Lock = nil
	TableUtil.Reconcile(data, TEMPLATE)
	data = migrate(data)
	if data.FirstJoin == 0 then
		data.FirstJoin = os.time()
	end
	data.LastLogin = os.time()
	DataService.Profiles[player] = data
	-- full snapshot to the client
	Net.Event("DataSync"):FireClient(player, data, { UsingMemory = DataService.UsingMemory })
	DataService.Loaded:Fire(player, data)
	if DataService.UsingMemory then
		task.delay(6, function()
			local notify = Net.Event("Notify")
			if player.Parent then
				notify:FireClient(player, { Text = "Studio mode: DataStore access is off, progress will not be saved.", Kind = "Warning" })
			end
		end)
	end
end

local function onPlayerRemoving(player: Player)
	local profile = DataService.Profiles[player]
	if not profile or releasing[player] then
		return
	end
	releasing[player] = true
	profile.LastLogout = os.time()
	DataService.Releasing:Fire(player, profile)
	DataService:Save(player, true)
	DataService.Profiles[player] = nil
	dirty[player] = nil
	releasing[player] = nil
end

function DataService:Init()
	local ok, result = pcall(function()
		return DataStoreService:GetDataStore(GameConfig.DataStoreName)
	end)
	if ok then
		store = result
	else
		warn("[DataService] DataStore unavailable, using memory: " .. tostring(result))
		DataService.UsingMemory = true
	end
	if RunService:IsStudio() and game.PlaceId == 0 then
		-- unpublished place: DataStores cannot work at all
		DataService.UsingMemory = true
		warn("[DataService] Place is not published - using in-memory profiles (no persistence).")
	end
end

function DataService:Start()
	Players.PlayerAdded:Connect(onPlayerAdded)
	Players.PlayerRemoving:Connect(onPlayerRemoving)

	-- replication flush
	task.spawn(function()
		while true do
			task.wait(0.15)
			local ok, err = pcall(flush)
			if not ok then
				warn("[DataService] flush error: " .. tostring(err))
			end
		end
	end)

	-- autosave
	task.spawn(function()
		while true do
			task.wait(GameConfig.AutosaveInterval)
			for player in DataService.Profiles do
				if player.Parent and not releasing[player] then
					task.spawn(function()
						DataService:Save(player, false)
					end)
					task.wait(1)
				end
			end
		end
	end)

	game:BindToClose(function()
		local pending = 0
		for player in DataService.Profiles do
			pending += 1
			task.spawn(function()
				onPlayerRemoving(player)
				pending -= 1
			end)
		end
		local t0 = os.clock()
		while pending > 0 and os.clock() - t0 < 25 do
			task.wait(0.2)
		end
	end)
end

-- Called by Main after every service has started, so Loaded listeners never miss players
-- who joined before the server finished booting (common in Studio play-solo).
function DataService:LoadExisting()
	for _, p in Players:GetPlayers() do
		if not self.Profiles[p] then
			task.spawn(onPlayerAdded, p)
		end
	end
end

-- Wipe a player's profile back to the template (admin/testing)
function DataService:Reset(player: Player)
	local fresh = TableUtil.DeepCopy(TEMPLATE)
	fresh.FirstJoin = os.time()
	fresh.LastLogin = os.time()
	self.Profiles[player] = fresh
	Net.Event("DataSync"):FireClient(player, fresh, { UsingMemory = DataService.UsingMemory })
	return fresh
end

return DataService
