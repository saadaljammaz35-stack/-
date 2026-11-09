--!strict
-- Remote definitions. The server creates every remote in ReplicatedStorage.Remotes at boot;
-- clients wait for them. One RemoteFunction ("Request") carries all client actions that need
-- a reply; the server routes it by action name with per-action rate limiting.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Net = {}

-- reliable server <-> client events
Net.EventNames = {
	"DataSync", -- S->C full profile snapshot
	"DataDelta", -- S->C { key = value } partial update
	"Notify", -- S->C toast { Text, Kind, Icon }
	"Stroke", -- C->S cleaning stroke (Vector3)
	"PackCapsule", -- C->S pack container into a capsule
	"SectorSnapshot", -- S->C full sector table
	"SectorUpdate", -- S->C changed sector percentages
	"ServerEvent", -- S->C server-wide event / community goal state
	"BaseStatus", -- S->C live base production status
	"TradeUpdate", -- S->C trade window state
	"OpenPanel", -- S->C ask client to open a UI panel
	"Reward", -- S->C big reward popup (crate result, level up, secret)
	"WorldInfo", -- S->C world metadata (zone spawns, plot assignments)
}

-- unreliable cosmetic events (dropping one is fine)
Net.UnreliableNames = {
	"CleanFX", -- S->C your stroke result (kg, pickups) for floating text & sounds
	"WorldFX", -- S->C effects other players should see (sweeping, meteors, sector clear)
}

Net.FunctionNames = {
	"Request",
}

local folder: Folder? = nil

function Net.InitServer()
	assert(RunService:IsServer(), "Net.InitServer is server only")
	local f = ReplicatedStorage:FindFirstChild("Remotes") :: Folder?
	if not f then
		local nf = Instance.new("Folder")
		nf.Name = "Remotes"
		nf.Parent = ReplicatedStorage
		f = nf
	end
	assert(f)
	for _, name in Net.EventNames do
		if not f:FindFirstChild(name) then
			local r = Instance.new("RemoteEvent")
			r.Name = name
			r.Parent = f
		end
	end
	for _, name in Net.UnreliableNames do
		if not f:FindFirstChild(name) then
			local r = Instance.new("UnreliableRemoteEvent")
			r.Name = name
			r.Parent = f
		end
	end
	for _, name in Net.FunctionNames do
		if not f:FindFirstChild(name) then
			local r = Instance.new("RemoteFunction")
			r.Name = name
			r.Parent = f
		end
	end
	folder = f
end

local function getFolder(): Folder
	if folder then
		return folder
	end
	local f = ReplicatedStorage:WaitForChild("Remotes") :: Folder
	folder = f
	return f
end

function Net.Event(name: string): RemoteEvent
	return getFolder():WaitForChild(name) :: RemoteEvent
end

function Net.Unreliable(name: string): UnreliableRemoteEvent
	return getFolder():WaitForChild(name) :: UnreliableRemoteEvent
end

function Net.Function(name: string): RemoteFunction
	return getFolder():WaitForChild(name) :: RemoteFunction
end

export type Reply = { Ok: boolean, Msg: string?, Data: any? }

-- client helper: Net.Request("BuyTool", { Id = "nail_brush" }) -> Reply
function Net.Request(action: string, payload: any?): Reply
	local ok, result = pcall(function()
		return Net.Function("Request"):InvokeServer(action, payload)
	end)
	if not ok then
		return { Ok = false, Msg = "Connection problem, try again." }
	end
	if type(result) ~= "table" then
		return { Ok = false, Msg = "No response." }
	end
	return result :: Reply
end

return Net
