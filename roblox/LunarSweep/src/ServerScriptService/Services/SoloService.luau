--!nonstrict
-- One player per moon. The game is designed for a single owner per server (set Max Players
-- to 1 in Game Settings > Places). As a safety net, anyone who still lands in an occupied
-- server (friend-join, old server size settings) is moved to a fresh private server of
-- their own. Disabled in Studio so local multi-client tests keep working.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local TeleportService = game:GetService("TeleportService")

local SoloService = {}
SoloService.Enabled = true

local owner: Player? = nil

local function moveToOwnServer(player: Player)
	local ok, err = pcall(function()
		local code = TeleportService:ReserveServer(game.PlaceId)
		TeleportService:TeleportToPrivateServer(game.PlaceId, code, { player })
	end)
	if not ok then
		warn("[SoloService] could not move " .. player.Name .. " to their own moon: " .. tostring(err))
	end
end

function SoloService:Owner(): Player?
	return owner
end

function SoloService:Init() end

function SoloService:Start()
	if RunService:IsStudio() or game.PlaceId == 0 then
		self.Enabled = false
	end
	local function onAdded(player: Player)
		if not owner or not owner.Parent then
			owner = player
			return
		end
		if self.Enabled and player ~= owner then
			moveToOwnServer(player)
		end
	end
	Players.PlayerAdded:Connect(onAdded)
	for _, p in Players:GetPlayers() do
		onAdded(p)
	end
	Players.PlayerRemoving:Connect(function(player)
		if player == owner then
			owner = nil
			for _, p in Players:GetPlayers() do
				if p ~= player then
					owner = p
					break
				end
			end
		end
	end)
end

return SoloService
