--!nonstrict
-- Safe player-to-player trading of crate-exclusive (tradeable) tools/containers and gems.
-- Two-step handshake: both players press Ready, then both Confirm after a short countdown.
-- Any change to an offer resets both. Items are re-validated at execution, both profiles
-- are saved immediately afterwards, and items in an open trade cannot be equipped.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Tools = require(Shared.Config.Tools)
local Containers = require(Shared.Config.Containers)
local Net = require(Shared.Net)
local Registry = require(script.Parent.Registry)

local TradeService = {}

local CONFIRM_DELAY = 4
local MAX_ITEMS = 8

type Offer = { Tools: { string }, Containers: { string }, Gems: number }
type Session = { A: Player, B: Player, Offers: { [Player]: Offer }, Ready: { [Player]: boolean }, Confirmed: { [Player]: boolean }, ReadyAt: number?, Done: boolean }

local sessions: { [Player]: Session } = {}
local invites: { [Player]: { [number]: number } } = {} -- target -> fromUserId -> time

local function notify(player: Player, text: string, kind: string?)
	Net.Event("Notify"):FireClient(player, { Text = text, Kind = kind or "Info", Icon = "🤝" })
end

local function other(s: Session, p: Player): Player
	return s.A == p and s.B or s.A
end

local function push(s: Session)
	for _, p in { s.A, s.B } do
		local o = other(s, p)
		Net.Event("TradeUpdate"):FireClient(p, {
			Kind = "Session",
			Partner = o.UserId,
			PartnerName = o.DisplayName,
			Mine = s.Offers[p],
			Theirs = s.Offers[o],
			MyReady = s.Ready[p] == true,
			TheirReady = s.Ready[o] == true,
			MyConfirm = s.Confirmed[p] == true,
			TheirConfirm = s.Confirmed[o] == true,
			ConfirmAt = s.ReadyAt and (s.ReadyAt + CONFIRM_DELAY) or nil,
			ServerClock = os.clock(),
		})
	end
end

local function close(s: Session, reason: string?)
	if s.Done then
		return
	end
	s.Done = true
	sessions[s.A] = nil
	sessions[s.B] = nil
	for _, p in { s.A, s.B } do
		if p.Parent then
			Net.Event("TradeUpdate"):FireClient(p, { Kind = "Closed", Reason = reason })
		end
	end
end

function TradeService:IsLocked(player: Player, kind: string, id: string): boolean
	local s = sessions[player]
	if not s then
		return false
	end
	local offer = s.Offers[player]
	local list = kind == "Tool" and offer.Tools or offer.Containers
	return table.find(list, id) ~= nil
end

local function validOffer(profile, offer: Offer): (boolean, string?)
	if #offer.Tools + #offer.Containers > MAX_ITEMS then
		return false, "Too many items."
	end
	for _, id in offer.Tools do
		local def = Tools.ById[id]
		if not def or not def.Tradeable or not profile.Tools[id] then
			return false, "You can't trade that tool."
		end
		if profile.EquippedTool == id then
			return false, "Unequip the tool first."
		end
	end
	for _, id in offer.Containers do
		local def = Containers.ById[id]
		if not def or not def.Tradeable or not profile.Containers[id] then
			return false, "You can't trade that container."
		end
		if profile.EquippedContainer == id then
			return false, "Unequip the container first."
		end
	end
	if offer.Gems < 0 or offer.Gems ~= math.floor(offer.Gems) or offer.Gems > profile.Gems then
		return false, "Not enough gems."
	end
	return true
end

local function execute(s: Session)
	local pa = Registry.DataService:Get(s.A)
	local pb = Registry.DataService:Get(s.B)
	if not pa or not pb then
		close(s, "A player left.")
		return
	end
	local oa, ob = s.Offers[s.A], s.Offers[s.B]
	local okA, msgA = validOffer(pa, oa)
	local okB, msgB = validOffer(pb, ob)
	if not okA or not okB then
		close(s, msgA or msgB or "Trade invalid.")
		return
	end
	-- check receivers don't already own unique items
	for _, id in oa.Tools do
		if pb.Tools[id] then
			close(s, s.B.DisplayName .. " already owns " .. Tools.ById[id].Name)
			return
		end
	end
	for _, id in ob.Tools do
		if pa.Tools[id] then
			close(s, s.A.DisplayName .. " already owns " .. Tools.ById[id].Name)
			return
		end
	end
	for _, id in oa.Containers do
		if pb.Containers[id] then
			close(s, "Duplicate container.")
			return
		end
	end
	for _, id in ob.Containers do
		if pa.Containers[id] then
			close(s, "Duplicate container.")
			return
		end
	end
	-- atomic swap (single server, no yields in between)
	for _, id in oa.Tools do
		pa.Tools[id] = nil
		pb.Tools[id] = true
	end
	for _, id in ob.Tools do
		pb.Tools[id] = nil
		pa.Tools[id] = true
	end
	for _, id in oa.Containers do
		pa.Containers[id] = nil
		pb.Containers[id] = true
	end
	for _, id in ob.Containers do
		pb.Containers[id] = nil
		pa.Containers[id] = true
	end
	pa.Gems = pa.Gems - oa.Gems + ob.Gems
	pb.Gems = pb.Gems - ob.Gems + oa.Gems
	for _, p in { s.A, s.B } do
		for _, k in { "Tools", "Containers", "Gems" } do
			Registry.DataService:Mark(p, k)
		end
		Registry.DataService:AddStat(p, "TradesDone", 1)
	end
	close(s, "Trade complete!")
	task.spawn(function()
		Registry.DataService:Save(s.A, false)
	end)
	task.spawn(function()
		Registry.DataService:Save(s.B, false)
	end)
end

local function sanitizeList(list: any, max: number): { string }
	local out = {}
	if type(list) == "table" then
		for _, v in list do
			if type(v) == "string" and #out < max and not table.find(out, v) then
				table.insert(out, v)
			end
		end
	end
	return out
end

function TradeService:Init() end

function TradeService:Start()
	local R = Registry.Router
	R.Register("TradeRequest", function(player, profile, payload)
		local target = type(payload.UserId) == "number" and Players:GetPlayerByUserId(payload.UserId)
		if not target or target == player then
			return false, "Player not found."
		end
		if not Registry.DataService:Get(target) then
			return false, "That player is still loading."
		end
		if sessions[player] or sessions[target] then
			return false, "Someone is already trading."
		end
		if profile.Level < 5 then
			return false, "Trading unlocks at level 5."
		end
		invites[target] = invites[target] or {}
		invites[target][player.UserId] = os.clock()
		Net.Event("TradeUpdate"):FireClient(target, { Kind = "Invite", From = player.UserId, FromName = player.DisplayName })
		return true, "Trade request sent to " .. target.DisplayName
	end, 1, 3)
	R.Register("TradeRespond", function(player, profile, payload)
		local fromId = payload.From
		local list = invites[player]
		local t = list and type(fromId) == "number" and list[fromId]
		if not t or os.clock() - t > 45 then
			return false, "That request expired."
		end
		list[fromId] = nil
		local from = Players:GetPlayerByUserId(fromId)
		if not from then
			return false, "Player left."
		end
		if payload.Accept ~= true then
			notify(from, player.DisplayName .. " declined your trade.")
			return true
		end
		if sessions[player] or sessions[from] then
			return false, "Someone is already trading."
		end
		local s: Session = {
			A = from,
			B = player,
			Offers = { [from] = { Tools = {}, Containers = {}, Gems = 0 }, [player] = { Tools = {}, Containers = {}, Gems = 0 } },
			Ready = {},
			Confirmed = {},
			ReadyAt = nil,
			Done = false,
		}
		sessions[from] = s
		sessions[player] = s
		push(s)
		return true
	end, 2, 4)
	R.Register("TradeOffer", function(player, profile, payload)
		local s = sessions[player]
		if not s then
			return false, "No active trade."
		end
		local offer: Offer = {
			Tools = sanitizeList(payload.Tools, MAX_ITEMS),
			Containers = sanitizeList(payload.Containers, MAX_ITEMS),
			Gems = math.floor(tonumber(payload.Gems) or 0),
		}
		local ok, msg = validOffer(profile, offer)
		if not ok then
			return false, msg
		end
		s.Offers[player] = offer
		s.Ready = {}
		s.Confirmed = {}
		s.ReadyAt = nil
		push(s)
		return true
	end, 5, 10)
	R.Register("TradeReady", function(player, profile, payload)
		local s = sessions[player]
		if not s then
			return false, "No active trade."
		end
		s.Ready[player] = payload.Ready == true
		s.Confirmed = {}
		if s.Ready[s.A] and s.Ready[s.B] then
			s.ReadyAt = os.clock()
		else
			s.ReadyAt = nil
		end
		push(s)
		return true
	end, 4, 8)
	R.Register("TradeConfirm", function(player, profile)
		local s = sessions[player]
		if not s or not s.ReadyAt then
			return false, "Both players must be ready."
		end
		if os.clock() - s.ReadyAt < CONFIRM_DELAY - 0.2 then
			return false, "Please review the trade first."
		end
		s.Confirmed[player] = true
		if s.Confirmed[s.A] and s.Confirmed[s.B] then
			execute(s)
		else
			push(s)
		end
		return true
	end, 2, 4)
	R.Register("TradeCancel", function(player)
		local s = sessions[player]
		if s then
			close(s, player.DisplayName .. " cancelled the trade.")
		end
		return true
	end, 2, 4)
	Registry.DataService.Releasing:Connect(function(player)
		local s = sessions[player]
		if s then
			close(s, "A player left.")
		end
		invites[player] = nil
	end)
end

return TradeService
