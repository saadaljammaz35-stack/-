--!nonstrict
-- Routes the single "Request" RemoteFunction to registered handlers.
-- Every handler receives (player, profile, payload) and returns (ok, msg?, data?).
-- The router validates the action name, waits for the profile, rate-limits per action
-- and catches handler errors so a bug can never break the remote for everyone.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Net = require(ReplicatedStorage.Shared.Net)
local RateLimiter = require(script.Parent.RateLimiter)
local Registry = require(script.Parent.Registry)

local Router = {}

type Handler = (Player, any, any) -> (boolean, string?, any?)

local handlers: { [string]: { Fn: Handler, Limiter: any } } = {}

-- rate = max requests per second sustained, burst = bucket size
function Router.Register(action: string, fn: Handler, rate: number?, burst: number?)
	assert(not handlers[action], "duplicate action " .. action)
	handlers[action] = { Fn = fn, Limiter = RateLimiter.new(burst or 6, rate or 3) }
end

function Router.Has(action: string): boolean
	return handlers[action] ~= nil
end

-- Server-side invocation (used by self tests)
function Router.Invoke(player: Player, action: string, payload: any): { Ok: boolean, Msg: string?, Data: any? }
	local h = handlers[action]
	if not h then
		return { Ok = false, Msg = "Unknown action" }
	end
	local profile = Registry.DataService:Get(player)
	if not profile then
		return { Ok = false, Msg = "Still loading your data..." }
	end
	local ok, a, b, c = pcall(h.Fn, player, profile, payload)
	if not ok then
		warn(string.format("[Router] %s failed for %s: %s", action, player.Name, tostring(a)))
		return { Ok = false, Msg = "Something went wrong." }
	end
	return { Ok = a == true, Msg = b, Data = c }
end

function Router:Init() end

function Router:Start()
	local remote = Net.Function("Request")
	remote.OnServerInvoke = function(player: Player, action: any, payload: any)
		if type(action) ~= "string" or #action > 40 then
			return { Ok = false, Msg = "Bad request" }
		end
		local h = handlers[action]
		if not h then
			return { Ok = false, Msg = "Unknown action" }
		end
		if not h.Limiter:Check(player) then
			return { Ok = false, Msg = "Slow down!" }
		end
		if payload ~= nil and type(payload) ~= "table" then
			return { Ok = false, Msg = "Bad payload" }
		end
		return Router.Invoke(player, action, payload or {})
	end
end

return Router
