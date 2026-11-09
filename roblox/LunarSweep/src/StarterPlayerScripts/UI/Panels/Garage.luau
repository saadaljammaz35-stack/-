--!nonstrict
-- Motor Pool / Garage: buy cleaning vehicles, compare them, take one out or store it.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Vehicles = require(Shared.Config.Vehicles)
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)

local UI = script.Parent.Parent
local Lib = require(UI.Lib)
local Theme = require(UI.Theme)
local Common = require(script.Parent.Common)

local C = Theme.Colors
local player = Players.LocalPlayer

return function(ctx)
	local Data = ctx.Data
	local win = Lib.Window("Motor Pool", nil, Color3.fromRGB(255, 170, 60))
	local panel = { Window = win }
	local selected: string? = nil

	local left = Lib.Frame({ Size = UDim2.new(0.62, 0, 1, 0), BackgroundTransparency = 1, Parent = win.Body })
	local header = Lib.Label("", { Size = UDim2.new(1, -8, 0, 36), TextSize = 14, TextColor3 = C.SubText, Font = Theme.FontMedium, Parent = left })
	local grid = Lib.Scroll({ Size = UDim2.new(1, 0, 1, -44), Position = UDim2.fromOffset(0, 44), Parent = left }, { Grid = { Cell = UDim2.fromOffset(160, 200), Pad = UDim2.fromOffset(8, 8) } })
	local detail = Common.DetailPane(win.Body)

	local function show(id: string)
		local p = Data.Profile
		local def = Vehicles.ById[id]
		detail:Show("Vehicle", id, def.Name, def.Rarity, def.Description)
		local st = Formulas.VehicleStats(p, id)
		local cur = player:GetAttribute("VehicleId")
		local curSt = cur and Vehicles.ById[cur] and Formulas.VehicleStats(p, cur) or nil
		Common.CompareRow(detail.Stats, "Top speed", st.Speed, curSt and curSt.Speed, function(v)
			return string.format("%d st/s", math.floor(v))
		end, 1)
		if def.Width > 0 then
			Common.CompareRow(detail.Stats, "Cleaning width", st.Width, curSt and curSt.Width, function(v)
				return string.format("%.1f", v)
			end, 2)
			Common.CompareRow(detail.Stats, "Hopper", st.Hopper, curSt and curSt.Hopper, function(v)
				return Format.Kg(v)
			end, 3)
			Common.CompareRow(detail.Stats, "Dust per patch", st.Depth, curSt and curSt.Depth, function(v)
				return string.format("x%.2f", v)
			end, 4)
		else
			Lib.StatRow(detail.Stats, "Cleaning", "None - transport only", C.SubText, 2)
		end
		Lib.StatRow(detail.Stats, "Seats", tostring(def.Seats), C.Text, 5)
		Lib.StatRow(detail.Stats, "Level required", tostring(def.Level), p.Level >= def.Level and C.Text or C.Bad, 6)
		if p.Vehicles[id] then
			if cur == id then
				detail:SetAction("Store vehicle", "Secondary", function()
					ctx.UI:Request("StoreVehicle", {})
				end)
			else
				detail:SetAction("Take it out", "Good", function()
					local reply = ctx.UI:Request("SpawnVehicle", { Id = id })
					if reply.Ok then
						ctx.UI:Close()
					end
				end)
			end
		elseif p.Level < def.Level then
			detail:SetAction("Requires level " .. def.Level, "Disabled")
		else
			detail:SetAction("Buy  " .. Format.Credits(def.Price), p.Credits >= def.Price and "Primary" or "Disabled", function()
				ctx.UI:Request("BuyVehicle", { Id = id })
			end)
		end
	end

	local function rebuild()
		local p = Data.Profile
		if not p then
			return
		end
		Lib.Clear(grid)
		local cur = player:GetAttribute("VehicleId")
		header.Text = cur and string.format("Out now: %s  •  hopper %s / %s", Vehicles.ById[cur] and Vehicles.ById[cur].Name or cur, Format.Kg(player:GetAttribute("VehicleKg") or 0), Format.Kg(player:GetAttribute("VehicleCap") or 0))
			or "Vehicles clean wide strips fast. Take one out here or at your own Garage. Empty the hopper at the Exchange or your base."
		local firstUnowned
		for i, def in Vehicles.List do
			local badge, badgeColor
			if cur == def.Id then
				badge, badgeColor = "OUT", C.Good
			elseif p.Vehicles[def.Id] then
				badge, badgeColor = "OWNED", Color3.fromRGB(70, 110, 200)
			elseif p.Level < def.Level then
				badge, badgeColor = "LV " .. def.Level, Color3.fromRGB(90, 90, 100)
			end
			local sub = def.Width > 0 and string.format("W %d • %s • %d st/s", def.Width, Format.Kg(def.Hopper), def.Speed) or string.format("Transport • %d seats", def.Seats)
			if not p.Vehicles[def.Id] then
				sub ..= "\n" .. Format.Credits(def.Price)
				firstUnowned = firstUnowned or def.Id
			end
			Common.Card(grid, {
				Kind = "Vehicle",
				Id = def.Id,
				Name = def.Name,
				Rarity = def.Rarity,
				Sub = sub,
				Badge = badge,
				BadgeColor = badgeColor,
				Order = i,
				Dim = p.Level < def.Level and not p.Vehicles[def.Id],
				OnSelect = function()
					selected = def.Id
					show(def.Id)
				end,
			})
		end
		if not selected or not Vehicles.ById[selected] then
			selected = cur or firstUnowned or Vehicles.List[1].Id
		end
		show(selected :: string)
	end

	Data:Watch({ "Vehicles", "Credits", "Level", "Upgrades" }, function()
		if ctx.UI.Current == "Garage" then
			rebuild()
		end
	end)
	player:GetAttributeChangedSignal("VehicleId"):Connect(function()
		if ctx.UI.Current == "Garage" then
			rebuild()
		end
	end)
	function panel:Open()
		rebuild()
	end
	return panel
end
