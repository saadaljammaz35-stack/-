--!nonstrict
-- Supply Wall purchases (tools, containers), equipping and the Upgrade Terminal.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local Tools = require(Shared.Config.Tools)
local Containers = require(Shared.Config.Containers)
local Upgrades = require(Shared.Config.Upgrades)
local Registry = require(script.Parent.Registry)

local ShopService = {}

local function str(v: any): string?
	if type(v) == "string" and #v <= 40 then
		return v
	end
	return nil
end

local function buyTool(player, profile, payload)
	local id = str(payload.Id)
	local def = id and Tools.ById[id]
	if not def then
		return false, "Unknown tool."
	end
	if profile.Tools[id] then
		return false, "You already own this tool."
	end
	if def.Source ~= "shop" then
		return false, "This tool cannot be bought here."
	end
	if profile.Level < def.Level then
		return false, string.format("Requires level %d.", def.Level)
	end
	local price = Formulas.ShopPrice(def.Price, profile)
	if not Registry.EconomyService:Spend(player, price) then
		return false, "Not enough credits."
	end
	profile.Tools[id] = true
	profile.EquippedTool = id
	Registry.DataService:Mark(player, "Tools")
	Registry.DataService:Mark(player, "EquippedTool")
	Registry.PlayerService:GiveTool(player)
	Registry.PlayerService:ApplyMovement(player)
	Registry.DataService:MaxStat(player, "ToolsOwned", ShopService:CountOwned(profile.Tools))
	return true, string.format("Bought %s for %s", def.Name, Format.Credits(price))
end

local function equipTool(player, profile, payload)
	local id = str(payload.Id)
	local def = id and Tools.ById[id]
	if not def or not profile.Tools[id] then
		return false, "You don't own that tool."
	end
	if profile.Level < def.Level and def.Source ~= "shop" then
		return false, string.format("Requires level %d to use.", def.Level)
	end
	if Registry.TradeService and Registry.TradeService:IsLocked(player, "Tool", id) then
		return false, "That tool is in an active trade."
	end
	profile.EquippedTool = id
	Registry.DataService:Mark(player, "EquippedTool")
	Registry.PlayerService:GiveTool(player)
	Registry.PlayerService:ApplyMovement(player)
	return true, def.Name .. " equipped"
end

local function buyContainer(player, profile, payload)
	local id = str(payload.Id)
	local def = id and Containers.ById[id]
	if not def then
		return false, "Unknown container."
	end
	if profile.Containers[id] then
		return false, "You already own this container."
	end
	if def.Source ~= "shop" then
		return false, "This container cannot be bought here."
	end
	if profile.Level < def.Level then
		return false, string.format("Requires level %d.", def.Level)
	end
	local price = Formulas.ShopPrice(def.Price, profile)
	if not Registry.EconomyService:Spend(player, price) then
		return false, "Not enough credits."
	end
	profile.Containers[id] = true
	profile.EquippedContainer = id
	Registry.DataService:Mark(player, "Containers")
	Registry.DataService:Mark(player, "EquippedContainer")
	Registry.PlayerService:AttachContainer(player)
	Registry.PlayerService:ApplyMovement(player)
	return true, string.format("Bought %s for %s", def.Name, Format.Credits(price))
end

local function equipContainer(player, profile, payload)
	local id = str(payload.Id)
	local def = id and Containers.ById[id]
	if not def or not profile.Containers[id] then
		return false, "You don't own that container."
	end
	if profile.Level < def.Level and def.Source ~= "shop" then
		return false, string.format("Requires level %d to use.", def.Level)
	end
	if Registry.TradeService and Registry.TradeService:IsLocked(player, "Container", id) then
		return false, "That container is in an active trade."
	end
	-- if the new container is smaller than what we carry, refuse
	local newCap = Formulas.Capacity(profile, id, Registry.PlayerService:HelperBonus(player, "Capacity"))
	if Formulas.ContentsKg(profile.Contents) > newCap + 1e-6 then
		return false, "Empty your container first - it holds more than the new one fits."
	end
	profile.EquippedContainer = id
	Registry.DataService:Mark(player, "EquippedContainer")
	Registry.PlayerService:AttachContainer(player)
	Registry.PlayerService:ApplyMovement(player)
	return true, def.Name .. " equipped"
end

local function buyUpgrade(player, profile, payload)
	local id = str(payload.Id)
	local def = id and Upgrades.ById[id]
	if not def then
		return false, "Unknown upgrade."
	end
	local current = profile.Upgrades[id] or 0
	if current >= def.MaxLevel then
		return false, "Already maxed."
	end
	if profile.Level < def.Level then
		return false, string.format("Requires level %d.", def.Level)
	end
	local cost = Formulas.UpgradeCost(id, current, profile)
	if not Registry.EconomyService:Spend(player, cost) then
		return false, "Not enough credits."
	end
	profile.Upgrades[id] = current + 1
	Registry.DataService:Mark(player, "Upgrades")
	Registry.DataService:AddStat(player, "UpgradesBought", 1)
	Registry.PlayerService:ApplyMovement(player)
	Registry.PlayerService:UpdateFill(player)
	if def.Category == "Tools" then
		-- tool stats changed; nothing to rebuild, stats are computed live
	end
	return true, string.format("%s upgraded to level %d", def.Name, current + 1)
end

function ShopService:CountOwned(set: { [string]: boolean }): number
	local n = 0
	for _, v in set do
		if v then
			n += 1
		end
	end
	return n
end

function ShopService:Init() end

function ShopService:Start()
	local R = Registry.Router
	R.Register("BuyTool", buyTool, 2, 4)
	R.Register("EquipTool", equipTool, 3, 5)
	R.Register("BuyContainer", buyContainer, 2, 4)
	R.Register("EquipContainer", equipContainer, 3, 5)
	R.Register("BuyUpgrade", buyUpgrade, 4, 8)
	R.Register("SaveSettings", function(player, profile, payload)
		local s = payload.Settings
		if type(s) ~= "table" then
			return false, "Bad settings"
		end
		for k, v in s do
			local current = profile.Settings[k]
			if current ~= nil and type(v) == type(current) then
				if type(v) == "number" then
					v = math.clamp(v, 0, 2)
				end
				profile.Settings[k] = v
			end
		end
		Registry.DataService:Mark(player, "Settings")
		return true
	end, 2, 5)
	R.Register("SetCosmetics", function(player, profile, payload)
		local c = profile.Cosmetics
		if type(payload.Suit) == "number" and Registry.PlayerService.SUIT_COLORS[payload.Suit] then
			c.Suit = payload.Suit
		end
		if type(payload.Visor) == "number" and Registry.PlayerService.VISOR_COLORS[payload.Visor] then
			c.Visor = payload.Visor
		end
		if type(payload.Helmet) == "boolean" then
			c.Helmet = payload.Helmet
		end
		if type(payload.SuitOn) == "boolean" then
			c.SuitOn = payload.SuitOn
		end
		Registry.DataService:Mark(player, "Cosmetics")
		Registry.PlayerService:ApplyCosmetics(player)
		return true, "Suit updated"
	end, 2, 4)
	R.Register("SetTitle", function(player, profile, payload)
		local t = str(payload.Title) or ""
		if t ~= "" then
			-- must be an earned achievement title
			local ok = false
			for id in profile.Achievements do
				local a = require(game:GetService("ReplicatedStorage").Shared.Config.Achievements).ById[id]
				if a and a.Title == t then
					ok = true
				end
			end
			if not ok then
				return false, "You haven't earned that title."
			end
		end
		profile.Title = t
		Registry.DataService:Mark(player, "Title")
		if player.Character then
			player.Character:SetAttribute("Title", t)
		end
		player:SetAttribute("Title", t)
		return true
	end, 1, 3)
	R.Register("Tutorial", function(player, profile, payload)
		if type(payload.Step) == "number" then
			profile.Tutorial.Step = math.clamp(math.floor(payload.Step), 0, 50)
		end
		if payload.Done == true then
			profile.Tutorial.Done = true
		end
		Registry.DataService:Mark(player, "Tutorial")
		return true
	end, 2, 5)
end

return ShopService
