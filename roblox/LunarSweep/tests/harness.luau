--!nonstrict
-- Headless test harness for Lunar Sweep, built on Lune (https://lune-org.github.io).
--
-- It deserializes the Rojo-built place (build/LunarSweep.rbxl), polyfills the engine APIs
-- Lune does not emulate (events, remotes, terrain voxel ops, model pivots, players,
-- humanoids...), and executes the game's real ModuleScripts/Scripts from the place with a
-- Roblox-like environment. Tests can then drive the actual server code.

local fs = require("@lune/fs")
local luau = require("@lune/luau")
local roblox = require("@lune/roblox")
local task = require("@lune/task")

local Harness = {}

local Instance = roblox.Instance
local Vector3 = roblox.Vector3
local CFrame = roblox.CFrame
local Enum = roblox.Enum

------------------------------------------------------------------ ids & signals

local nextId = 0
local function idOf(inst): number
	local id = inst:GetAttribute("__tid")
	if not id then
		nextId += 1
		id = nextId
		inst:SetAttribute("__tid", id)
	end
	return id
end
Harness.IdOf = idOf

local function newSignal()
	local s = { _h = {} }
	function s:Connect(fn)
		local c = { Connected = true, _fn = fn }
		function c:Disconnect()
			c.Connected = false
		end
		table.insert(s._h, c)
		return c
	end
	function s:Once(fn)
		local c
		c = s:Connect(function(...)
			c:Disconnect()
			fn(...)
		end)
		return c
	end
	function s:Fire(...)
		for _, c in table.clone(s._h) do
			if c.Connected then
				local ok, err = pcall(c._fn, ...)
				if not ok then
					Harness.Errors += 1
					print("[harness] signal handler error: " .. tostring(err))
				end
			end
		end
	end
	function s:Wait()
		local thread = coroutine.running()
		s:Once(function(...)
			task.spawn(thread, ...)
		end)
		return coroutine.yield()
	end
	return s
end
Harness.Signal = newSignal
Harness.Errors = 0

local signals: { [string]: any } = {}
local function signalFor(inst, name: string)
	local key = idOf(inst) .. ":" .. name
	local s = signals[key]
	if not s then
		s = newSignal()
		signals[key] = s
	end
	return s
end
Harness.SignalFor = signalFor

local function eventProp(class: string, name: string)
	roblox.implementProperty(class, name, function(self)
		return signalFor(self, name)
	end)
end

------------------------------------------------------------------ recorded traffic

Harness.Sent = {} :: { [string]: { any } } -- remote name -> list of { Player?, Payload }
Harness.Terrain = { WriteVoxels = 0, ReplaceMaterial = 0, Fill = 0, Voxels = 0 }
Harness.Kicked = {} :: { any }

local function record(name: string, player, payload)
	Harness.Sent[name] = Harness.Sent[name] or {}
	table.insert(Harness.Sent[name], { Player = player, Payload = payload })
end

------------------------------------------------------------------ polyfills

local invokeCallbacks: { [number]: any } = {}

function Harness.InstallPolyfills()
	-- events
	for _, pair in {
		{ "Players", "PlayerAdded" },
		{ "Players", "PlayerRemoving" },
		{ "Player", "CharacterAdded" },
		{ "Player", "CharacterRemoving" },
		{ "RemoteEvent", "OnServerEvent" },
		{ "RemoteEvent", "OnClientEvent" },
		{ "UnreliableRemoteEvent", "OnServerEvent" },
		{ "UnreliableRemoteEvent", "OnClientEvent" },
		{ "ProximityPromptService", "PromptTriggered" },
		{ "ProximityPromptService", "PromptShown" },
		{ "RunService", "Heartbeat" },
		{ "RunService", "RenderStepped" },
		{ "RunService", "Stepped" },
		{ "Humanoid", "StateChanged" },
		{ "Humanoid", "Died" },
		{ "ProximityPrompt", "Triggered" },
	} do
		eventProp(pair[1], pair[2])
	end
	for _, class in { "Instance" } do
		roblox.implementMethod(class, "GetPropertyChangedSignal", function(self, prop)
			return signalFor(self, "Prop:" .. prop)
		end)
		roblox.implementMethod(class, "GetAttributeChangedSignal", function(self, attr)
			return signalFor(self, "Attr:" .. attr)
		end)
		roblox.implementMethod(class, "WaitForChild", function(self, name, _timeout)
			return self:FindFirstChild(name)
		end)
	end
	-- remotes
	for _, class in { "RemoteEvent", "UnreliableRemoteEvent" } do
		roblox.implementMethod(class, "FireClient", function(self, player, ...)
			record(self.Name, player, { ... })
		end)
		roblox.implementMethod(class, "FireAllClients", function(self, ...)
			record(self.Name, nil, { ... })
		end)
		roblox.implementMethod(class, "FireServer", function(self, ...)
			record(self.Name .. "@server", nil, { ... })
		end)
	end
	roblox.implementProperty("RemoteFunction", "OnServerInvoke", function(self)
		return invokeCallbacks[idOf(self)]
	end, function(self, fn)
		invokeCallbacks[idOf(self)] = fn
	end)
	-- pivots
	local function getPivot(self)
		if self:IsA("BasePart") then
			return self.CFrame
		end
		local pp = self.PrimaryPart
		if pp then
			return pp.CFrame
		end
		for _, d in self:GetDescendants() do
			if d:IsA("BasePart") then
				return d.CFrame
			end
		end
		return CFrame.new()
	end
	local function pivotTo(self, cf)
		if self:IsA("BasePart") then
			self.CFrame = cf
			self.Position = cf.Position
			return
		end
		local current = getPivot(self)
		local delta = cf * current:Inverse()
		for _, d in self:GetDescendants() do
			if d:IsA("BasePart") then
				local n = delta * d.CFrame
				d.CFrame = n
				-- Lune stores Position separately from CFrame; keep them in sync
				d.Position = n.Position
			end
		end
	end
	for _, class in { "Model", "BasePart" } do
		roblox.implementMethod(class, "GetPivot", getPivot)
		roblox.implementMethod(class, "PivotTo", pivotTo)
	end
	roblox.implementMethod("Model", "GetBoundingBox", function(self)
		local minV, maxV = nil, nil
		for _, d in self:GetDescendants() do
			if d:IsA("BasePart") then
				local p, s = d.CFrame.Position, d.Size / 2
				local lo, hi = p - s, p + s
				minV = minV and Vector3.new(math.min(minV.X, lo.X), math.min(minV.Y, lo.Y), math.min(minV.Z, lo.Z)) or lo
				maxV = maxV and Vector3.new(math.max(maxV.X, hi.X), math.max(maxV.Y, hi.Y), math.max(maxV.Z, hi.Z)) or hi
			end
		end
		if not minV then
			return CFrame.new(), Vector3.new()
		end
		return CFrame.new((minV + maxV) / 2), maxV - minV
	end)
	roblox.implementMethod("Model", "ScaleTo", function() end)
	roblox.implementMethod("BasePart", "SetNetworkOwner", function() end)
	-- terrain
	roblox.implementMethod("Terrain", "Clear", function() end)
	roblox.implementMethod("Terrain", "SetMaterialColor", function() end)
	roblox.implementMethod("Terrain", "WriteVoxels", function(_, region, res, mats, occ)
		assert(res == 4, "resolution must be 4")
		local size = region.Size
		local nx, ny, nz = math.round(size.X / 4), math.round(size.Y / 4), math.round(size.Z / 4)
		assert(#mats == nx and #occ == nx, "voxel array X mismatch")
		assert(#mats[1] == ny and #mats[1][1] == nz, "voxel array Y/Z mismatch")
		Harness.Terrain.WriteVoxels += 1
		Harness.Terrain.Voxels += nx * ny * nz
	end)
	roblox.implementMethod("Terrain", "ReplaceMaterial", function(_, region, res, from, to)
		assert(res == 4)
		assert(typeof(from) == "EnumItem" and typeof(to) == "EnumItem", "materials must be enums")
		Harness.Terrain.ReplaceMaterial += 1
	end)
	for _, m in { "FillBall", "FillBlock", "FillCylinder", "FillWedge" } do
		roblox.implementMethod("Terrain", m, function()
			Harness.Terrain.Fill += 1
		end)
	end
	roblox.implementMethod("Terrain", "ReadVoxels", function()
		return { { { Enum.Material.Limestone } } }, { { { 1 } } }
	end)
	roblox.implementMethod("WorldRoot", "Raycast", function()
		return nil
	end)
	-- services
	roblox.implementMethod("RunService", "IsStudio", function()
		return true
	end)
	roblox.implementMethod("RunService", "IsServer", function()
		return Harness.Mode ~= "client"
	end)
	roblox.implementMethod("RunService", "IsClient", function()
		return Harness.Mode == "client"
	end)
	roblox.implementMethod("HttpService", "GenerateGUID", function()
		nextId += 1
		return "guid-" .. nextId
	end)
	roblox.implementMethod("DataModel", "BindToClose", function(_, fn)
		Harness.CloseCallbacks = Harness.CloseCallbacks or {}
		table.insert(Harness.CloseCallbacks, fn)
	end)
	roblox.implementProperty("DataModel", "PlaceId", function()
		return 0
	end)
	roblox.implementProperty("DataModel", "JobId", function()
		return ""
	end)
	roblox.implementProperty("DataModel", "CreatorId", function()
		return 0
	end)
	roblox.implementMethod("DataModel", "IsLoaded", function()
		return true
	end)
	-- Roblox preserves Instance identity (same userdata = same table key). Return the exact
	-- Player objects created by the harness so server tables keyed by player keep working.
	roblox.implementMethod("Players", "GetPlayers", function(_self)
		local out = {}
		for _, p in Harness.PlayerObjects do
			if p.Parent then
				table.insert(out, p)
			end
		end
		return out
	end)
	roblox.implementMethod("Players", "GetPlayerByUserId", function(_self, id)
		for _, p in Harness.PlayerObjects do
			if p.Parent and p.UserId == id then
				return p
			end
		end
		return nil
	end)
	roblox.implementMethod("Players", "GetNameFromUserIdAsync", function(_, id)
		return "User" .. tostring(id)
	end)
	roblox.implementProperty("Player", "UserId", function(self)
		return self:GetAttribute("__uid") or 0
	end, function(self, v)
		self:SetAttribute("__uid", v)
	end)
	roblox.implementProperty("Player", "DisplayName", function(self)
		return self:GetAttribute("__dn") or self.Name
	end, function(self, v)
		self:SetAttribute("__dn", v)
	end)
	roblox.implementProperty("Player", "Character", function(self)
		local id = self:GetAttribute("__char")
		return id and Harness.Characters[id] or nil
	end, function(self, v)
		if v then
			Harness.Characters[idOf(v)] = v
			self:SetAttribute("__char", idOf(v))
		else
			self:SetAttribute("__char", nil)
		end
	end)
	roblox.implementMethod("Player", "Kick", function(self, msg)
		table.insert(Harness.Kicked, { Player = self, Msg = msg })
	end)
	roblox.implementMethod("Humanoid", "EquipTool", function(self, tool)
		tool.Parent = self.Parent
	end)
	roblox.implementMethod("Humanoid", "UnequipTools", function(self)
		local character = self.Parent
		local player
		for _, p in Harness.Game:GetService("Players"):GetChildren() do
			if p:IsA("Player") and p.Character == character then
				player = p
			end
		end
		for _, t in character:GetChildren() do
			if t:IsA("Tool") and player then
				t.Parent = player:FindFirstChildOfClass("Backpack")
			end
		end
	end)
	roblox.implementMethod("Humanoid", "GetState", function()
		return Enum.HumanoidStateType.Running
	end)
	roblox.implementMethod("SoundService", "PlayLocalSound", function() end)
	roblox.implementMethod("Sound", "Play", function() end)
	roblox.implementMethod("Sound", "Stop", function() end)
	roblox.implementMethod("StarterGui", "SetCoreGuiEnabled", function() end)
	roblox.implementMethod("DataStoreService", "GetRequestBudgetForRequestType", function()
		return 100
	end)
end

------------------------------------------------------------------ client polyfills

local TweenInfoClass = {}
function TweenInfoClass.new(time, style, dir, ...)
	return { Time = time or 1, EasingStyle = style, EasingDirection = dir }
end
local RaycastParamsClass = {}
function RaycastParamsClass.new()
	return { FilterType = roblox.Enum.RaycastFilterType.Exclude, FilterDescendantsInstances = {}, IgnoreWater = false }
end
Harness.TweenInfo = TweenInfoClass
Harness.RaycastParams = RaycastParamsClass
Harness.ClientInvoke = function(action, payload)
	return { Ok = true, Msg = nil, Data = nil }
end

function Harness.InstallClientPolyfills()
	for _, pair in {
		{ "GuiButton", "Activated" },
		{ "GuiButton", "MouseButton1Click" },
		{ "GuiButton", "MouseButton1Down" },
		{ "GuiButton", "MouseButton1Up" },
		{ "GuiObject", "MouseEnter" },
		{ "GuiObject", "MouseLeave" },
		{ "GuiObject", "InputBegan" },
		{ "GuiObject", "InputEnded" },
		{ "GuiObject", "InputChanged" },
		{ "UserInputService", "InputBegan" },
		{ "UserInputService", "InputEnded" },
		{ "UserInputService", "InputChanged" },
		{ "UserInputService", "JumpRequest" },
		{ "Instance", "ChildAdded" },
		{ "Instance", "ChildRemoved" },
		{ "Instance", "DescendantAdded" },
		{ "Instance", "Changed" },
		{ "Tween", "Completed" },
	} do
		eventProp(pair[1], pair[2])
	end
	roblox.implementMethod("UserInputService", "GetMouseLocation", function()
		return roblox.Vector2.new(640, 360)
	end)
	roblox.implementMethod("ContextActionService", "BindAction", function() end)
	roblox.implementMethod("ContextActionService", "UnbindAction", function() end)
	roblox.implementMethod("TweenService", "Create", function(_, inst, _info, props)
		local tween = Instance.new("Tween")
		local obj = {}
		function obj:Play()
			for k, v in props do
				pcall(function()
					inst[k] = v
				end)
			end
			signalFor(tween, "Completed"):Fire(Enum.PlaybackState.Completed)
		end
		function obj:Cancel() end
		function obj:Pause() end
		obj.Completed = signalFor(tween, "Completed")
		return obj
	end)
	roblox.implementMethod("Lighting", "GetSunDirection", function()
		return Vector3.new(0.3, 0.8, -0.4).Unit
	end)
	roblox.implementMethod("SocialService", "PromptGameInvite", function() end)
	roblox.implementMethod("Camera", "ViewportPointToRay", function(self, x, y)
		return roblox.Ray.new(self.CFrame.Position, Vector3.new(0, -1, 0))
	end)
	roblox.implementMethod("ReplicatedFirst", "RemoveDefaultLoadingScreen", function() end)
	roblox.implementMethod("ParticleEmitter", "Emit", function() end)
	roblox.implementMethod("RemoteFunction", "InvokeServer", function(_, action, payload)
		return Harness.ClientInvoke(action, payload)
	end)
end

Harness.Characters = {}
Harness.PlayerObjects = {} :: { any }

------------------------------------------------------------------ Random polyfill

local RandomClass = {}
RandomClass.__index = RandomClass
function RandomClass.new(seed: number?)
	local s = math.floor(seed or (os.clock() * 1e6)) % 2147483647
	if s <= 0 then
		s += 2147483646
	end
	return setmetatable({ _s = s }, RandomClass)
end
function RandomClass:_next(): number
	self._s = (self._s * 48271) % 2147483647
	return self._s / 2147483647
end
function RandomClass:NextNumber(a: number?, b: number?): number
	local r = self:_next()
	if a and b then
		return a + (b - a) * r
	end
	return r
end
function RandomClass:NextInteger(a: number, b: number): number
	return a + math.floor(self:_next() * (b - a + 1))
end
function RandomClass:NextUnitVector()
	local z = self:NextNumber(-1, 1)
	local t = self:NextNumber(0, math.pi * 2)
	local r = math.sqrt(1 - z * z)
	return Vector3.new(r * math.cos(t), r * math.sin(t), z)
end
Harness.Random = RandomClass

------------------------------------------------------------------ loader

local cache: { [number]: any } = {}

local function makeEnv(scriptInst)
	local env = {
		script = scriptInst,
		game = Harness.Game,
		workspace = Harness.Game:GetService("Workspace"),
		Workspace = Harness.Game:GetService("Workspace"),
		Instance = roblox.Instance,
		Enum = roblox.Enum,
		Vector3 = roblox.Vector3,
		Vector2 = roblox.Vector2,
		CFrame = roblox.CFrame,
		Color3 = roblox.Color3,
		ColorSequence = roblox.ColorSequence,
		ColorSequenceKeypoint = roblox.ColorSequenceKeypoint,
		NumberSequence = roblox.NumberSequence,
		NumberSequenceKeypoint = roblox.NumberSequenceKeypoint,
		NumberRange = roblox.NumberRange,
		UDim = roblox.UDim,
		UDim2 = roblox.UDim2,
		Region3 = roblox.Region3,
		BrickColor = roblox.BrickColor,
		Font = roblox.Font,
		Random = RandomClass,
		TweenInfo = TweenInfoClass,
		RaycastParams = RaycastParamsClass,
		task = task,
		buffer = buffer,
		warn = function(...)
			print("[warn]", ...)
			Harness.Warnings += 1
		end,
		print = print,
		typeof = typeof,
		require = function(target)
			return Harness.Require(target)
		end,
	}
	return setmetatable(env, { __index = _G })
end
Harness.Warnings = 0

function Harness.Require(moduleScript)
	local id = idOf(moduleScript)
	if cache[id] ~= nil then
		return cache[id]
	end
	assert(moduleScript:IsA("ModuleScript"), "require target is not a ModuleScript: " .. moduleScript:GetFullName())
	local fn = luau.load(moduleScript.Source, { debugName = moduleScript:GetFullName(), environment = makeEnv(moduleScript) })
	local result = fn()
	cache[id] = result
	return result
end

function Harness.RunScript(scriptInst)
	local fn = luau.load(scriptInst.Source, { debugName = scriptInst:GetFullName(), environment = makeEnv(scriptInst) })
	return fn()
end

function Harness.Load(placePath: string)
	Harness.InstallPolyfills()
	local game = roblox.deserializePlace(fs.readFile(placePath))
	-- DataModel properties Lune leaves without defaults
	for k, v in { JobId = "", PlaceId = 0, CreatorId = 0, GameId = 0 } do
		pcall(function()
			(game :: any)[k] = v
		end)
	end
	Harness.Game = game
	return game
end

------------------------------------------------------------------ players

function Harness.AddPlayer(userId: number, name: string)
	local game = Harness.Game
	local players = game:GetService("Players")
	local p = Instance.new("Player")
	p.Name = name
	p.UserId = userId
	p.DisplayName = name
	local backpack = Instance.new("Backpack")
	backpack.Parent = p
	local pg = Instance.new("PlayerGui")
	pg.Parent = p
	p.Parent = players
	table.insert(Harness.PlayerObjects, p)
	signalFor(players, "PlayerAdded"):Fire(p)
	return p
end

function Harness.SpawnCharacter(player, pos)
	local character = Instance.new("Model")
	character.Name = player.Name
	local hrp = Instance.new("Part")
	hrp.Name = "HumanoidRootPart"
	hrp.Size = Vector3.new(2, 2, 1)
	hrp.CFrame = CFrame.new(pos)
	hrp.Parent = character
	local torso = Instance.new("Part")
	torso.Name = "UpperTorso"
	torso.Size = Vector3.new(2, 1.6, 1)
	torso.CFrame = CFrame.new(pos + Vector3.new(0, 0.5, 0))
	torso.Parent = character
	local head = Instance.new("Part")
	head.Name = "Head"
	head.Size = Vector3.new(1.2, 1.2, 1.2)
	head.CFrame = CFrame.new(pos + Vector3.new(0, 2, 0))
	head.Parent = character
	for _, part in character:GetChildren() do
		part.Position = part.CFrame.Position
		pcall(function()
			part.AssemblyLinearVelocity = Vector3.zero
		end)
	end
	local hum = Instance.new("Humanoid")
	hum.Health = 100
	hum.MaxHealth = 100
	hum.Parent = character
	character.PrimaryPart = hrp
	character.Parent = Harness.Game:GetService("Workspace")
	player.Character = character
	signalFor(player, "CharacterAdded"):Fire(character)
	return character
end

function Harness.MoveCharacter(player, pos)
	local c = player.Character
	c:PivotTo(CFrame.new(pos))
end

function Harness.RemovePlayer(player)
	local players = Harness.Game:GetService("Players")
	signalFor(players, "PlayerRemoving"):Fire(player)
end

-- call the Request RemoteFunction exactly like a client would
function Harness.Invoke(player, action: string, payload: any?)
	local remotes = Harness.Game:GetService("ReplicatedStorage"):FindFirstChild("Remotes")
	local rf = remotes:FindFirstChild("Request")
	local cb = invokeCallbacks[idOf(rf)]
	assert(cb, "OnServerInvoke not set")
	return cb(player, action, payload)
end

function Harness.FireServer(player, remoteName: string, ...)
	local remotes = Harness.Game:GetService("ReplicatedStorage"):FindFirstChild("Remotes")
	local r = remotes:FindFirstChild(remoteName)
	signalFor(r, "OnServerEvent"):Fire(player, ...)
end

function Harness.TriggerPrompt(prompt, player)
	local pps = Harness.Game:GetService("ProximityPromptService")
	signalFor(pps, "PromptTriggered"):Fire(prompt, player)
end

------------------------------------------------------------------ tiny test framework

Harness.Passed = 0
Harness.Failed = 0
Harness.Results = {} :: { string }

function Harness.Check(name: string, ok: boolean, detail: any?)
	if ok then
		Harness.Passed += 1
	else
		Harness.Failed += 1
	end
	local line = string.format("[%s] %s%s", ok and "PASS" or "FAIL", name, detail ~= nil and (" - " .. tostring(detail)) or "")
	table.insert(Harness.Results, line)
	print(line)
end

function Harness.Test(name: string, fn: () -> (boolean, any?))
	local ok, a, b = pcall(fn)
	if not ok then
		Harness.Check(name, false, "error: " .. tostring(a))
	else
		Harness.Check(name, a == true, b)
	end
end

return Harness
