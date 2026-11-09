--!nonstrict
-- Player trading: pick a player, exchange crate-exclusive gear and gems with a
-- ready -> review countdown -> confirm handshake.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Tools = require(Shared.Config.Tools)
local Containers = require(Shared.Config.Containers)
local Rarity = require(Shared.Config.Rarity)
local Net = require(Shared.Net)

local UI = script.Parent.Parent
local Lib = require(UI.Lib)
local Theme = require(UI.Theme)

local C = Theme.Colors

return function(ctx)
	local Data = ctx.Data
	local win = Lib.Window("Trading", nil, Color3.fromRGB(120, 220, 160))
	local panel = { Window = win }
	local session = nil
	local myOffer = { Tools = {}, Containers = {}, Gems = 0 }
	local content = Lib.Frame({ Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Parent = win.Body })

	local function sendOffer()
		ctx.UI:Request("TradeOffer", myOffer, true)
	end

	local function itemName(kind, id)
		local def = kind == "Tool" and Tools.ById[id] or Containers.ById[id]
		return def and def.Name or id, def and Rarity.Get(def.Rarity).Color or C.Text
	end

	local function offerColumn(parent, title, offer, editable)
		local col = Lib.Frame({ Size = UDim2.new(0.5, -6, 1, -60), BackgroundColor3 = C.PanelLight, Corner = 10, Parent = parent })
		Lib.Label(title, { Size = UDim2.new(1, -20, 0, 28), Position = UDim2.fromOffset(10, 6), TextSize = 18, Font = Theme.FontBlack, Parent = col })
		local list = Lib.Scroll({ Size = UDim2.new(1, -16, 1, -44), Position = UDim2.fromOffset(8, 38), Parent = col }, { Padding = 4 })
		if editable then
			local p = Data.Profile
			local gemsRow = Lib.Frame({ Size = UDim2.new(1, -8, 0, 36), BackgroundTransparency = 1, Parent = list })
			Lib.Label("💎 Gems offered: " .. myOffer.Gems, { Size = UDim2.new(0.5, 0, 1, 0), Parent = gemsRow })
			for i, amt in { -10, -1, 1, 10 } do
				Lib.Button((amt > 0 and "+" or "") .. amt, { Size = UDim2.fromOffset(44, 30), Position = UDim2.new(0.5, (i - 1) * 48, 0, 3), TextSize = 13, Style = "Secondary", Parent = gemsRow }, function()
					myOffer.Gems = math.clamp(myOffer.Gems + amt, 0, p.Gems)
					sendOffer()
				end)
			end
			for _, kind in { "Tool", "Container" } do
				local owned = kind == "Tool" and p.Tools or p.Containers
				local catalog = kind == "Tool" and Tools.List or Containers.List
				local chosen = kind == "Tool" and myOffer.Tools or myOffer.Containers
				for _, def in catalog do
					if owned[def.Id] and def.Tradeable then
						local inOffer = table.find(chosen, def.Id) ~= nil
						local equipped = (kind == "Tool" and p.EquippedTool or p.EquippedContainer) == def.Id
						local name, color = itemName(kind, def.Id)
						local b = Lib.Button((inOffer and "✓ " or "+ ") .. name .. (equipped and " (equipped)" or ""), { Size = UDim2.new(1, -8, 0, 32), TextSize = 14, Style = inOffer and "Good" or (equipped and "Disabled" or "Ghost"), Parent = list }, function()
							local idx = table.find(chosen, def.Id)
							if idx then
								table.remove(chosen, idx)
							else
								table.insert(chosen, def.Id)
							end
							sendOffer()
						end)
						b.TextColor3 = inOffer and C.Text or color
					end
				end
			end
		else
			Lib.Label("💎 Gems: " .. (offer and offer.Gems or 0), { Size = UDim2.new(1, -8, 0, 28), Parent = list })
			for _, id in offer and offer.Tools or {} do
				local name, color = itemName("Tool", id)
				Lib.Label("• " .. name, { Size = UDim2.new(1, -8, 0, 26), TextColor3 = color, Parent = list })
			end
			for _, id in offer and offer.Containers or {} do
				local name, color = itemName("Container", id)
				Lib.Label("• " .. name, { Size = UDim2.new(1, -8, 0, 26), TextColor3 = color, Parent = list })
			end
		end
	end

	local function rebuild()
		Lib.Clear(content)
		if not session then
			Lib.Label("Trade crate-exclusive tools, containers and gems safely. Both players must press Ready, review, then Confirm.", { Size = UDim2.new(1, 0, 0, 44), TextColor3 = C.SubText, Parent = content })
			local list = Lib.Scroll({ Size = UDim2.new(1, 0, 1, -54), Position = UDim2.fromOffset(0, 54), Parent = content }, { Padding = 6 })
			local any = false
			for _, pl in Players:GetPlayers() do
				if pl ~= Players.LocalPlayer then
					any = true
					local row = Lib.Frame({ Size = UDim2.new(1, -10, 0, 48), BackgroundColor3 = C.PanelLight, Corner = 8, Parent = list })
					Lib.Label(pl.DisplayName .. "  (@" .. pl.Name .. ")", { Size = UDim2.new(0.6, 0, 1, 0), Position = UDim2.fromOffset(12, 0), Parent = row })
					Lib.Button("Request trade", { Size = UDim2.fromOffset(150, 34), Position = UDim2.new(1, -160, 0, 7), Parent = row }, function()
						ctx.UI:Request("TradeRequest", { UserId = pl.UserId })
					end)
				end
			end
			if not any then
				Lib.Label("No other players in this server yet. Invite a friend!", { TextColor3 = C.SubText, Parent = list })
			end
			return
		end
		local cols = Lib.Frame({ Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Parent = content })
		offerColumn(cols, "YOUR OFFER", session.Mine, true)
		local right = Lib.Frame({ Size = UDim2.fromScale(1, 1), Position = UDim2.new(0.5, 6, 0, 0), BackgroundTransparency = 1, Parent = cols })
		offerColumn(right, session.PartnerName .. "'S OFFER", session.Theirs, false)
		local bar = Lib.Frame({ Size = UDim2.new(1, 0, 0, 50), Position = UDim2.new(0, 0, 1, -50), BackgroundTransparency = 1, Parent = content })
		local status = Lib.Label(string.format("You: %s   •   %s: %s", session.MyConfirm and "CONFIRMED" or (session.MyReady and "READY" or "editing"), session.PartnerName, session.TheirConfirm and "CONFIRMED" or (session.TheirReady and "READY" or "editing")), { Size = UDim2.new(0.5, 0, 1, 0), TextSize = 14, Parent = bar })
		local _ = status
		if session.ConfirmAt then
			local left = session.ConfirmAt - session.ServerClock - (os.clock() - session.ReceivedAt)
			Lib.Button(left > 0 and string.format("Review... %ds", math.ceil(left)) or "CONFIRM TRADE", { Size = UDim2.fromOffset(180, 42), Position = UDim2.new(1, -380, 0, 4), Style = (left > 0 or session.MyConfirm) and "Disabled" or "Good", Parent = bar }, function()
				ctx.UI:Request("TradeConfirm", {}, true)
			end)
			if left > 0 then
				task.delay(math.min(1, left), function()
					if ctx.UI.Current == "Trade" then
						rebuild()
					end
				end)
			end
		else
			Lib.Button(session.MyReady and "Unready" or "Ready", { Size = UDim2.fromOffset(180, 42), Position = UDim2.new(1, -380, 0, 4), Style = session.MyReady and "Secondary" or "Primary", Parent = bar }, function()
				ctx.UI:Request("TradeReady", { Ready = not session.MyReady }, true)
			end)
		end
		Lib.Button("Cancel", { Size = UDim2.fromOffset(180, 42), Position = UDim2.new(1, -190, 0, 4), Style = "Danger", Parent = bar }, function()
			ctx.UI:Request("TradeCancel", {}, true)
		end)
	end

	Net.Event("TradeUpdate").OnClientEvent:Connect(function(msg)
		if msg.Kind == "Invite" then
			ctx.UI:Notify(msg.FromName .. " wants to trade with you!", "Event", "🤝")
			Lib.Confirm(ctx.Root, msg.FromName .. " wants to trade. Accept?", function()
				ctx.UI:Request("TradeRespond", { From = msg.From, Accept = true }, true)
			end, "Accept")
		elseif msg.Kind == "Session" then
			session = msg
			session.ReceivedAt = os.clock()
			myOffer = { Tools = table.clone(msg.Mine.Tools), Containers = table.clone(msg.Mine.Containers), Gems = msg.Mine.Gems }
			if ctx.UI.Current ~= "Trade" then
				ctx.UI:Open("Trade")
			else
				rebuild()
			end
		elseif msg.Kind == "Closed" then
			session = nil
			myOffer = { Tools = {}, Containers = {}, Gems = 0 }
			if msg.Reason then
				ctx.UI:Notify(msg.Reason, "Info", "🤝")
			end
			if ctx.UI.Current == "Trade" then
				rebuild()
			end
		end
	end)
	function panel:Open()
		rebuild()
	end
	return panel
end
