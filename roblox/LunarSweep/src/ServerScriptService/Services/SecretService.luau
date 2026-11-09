--!nonstrict
-- Hidden relics (one per zone + hub). Finding one grants gems, credits and achievements.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local MapLayout = require(Shared.MapLayout)
local Progression = require(Shared.Config.Progression)
local ModelFactory = require(Shared.ModelFactory)
local Net = require(Shared.Net)
local Registry = require(script.Parent.Registry)
local TerrainGenerator = require(script.Parent.TerrainGenerator)

local SecretService = {}

local function relicModel(color: Color3): Model
	local b = ModelFactory.Builder.new("Relic", true)
	local base = b:VCyl(0.6, 3, CFrame.new(0, 0.3, 0), Color3.fromRGB(40, 40, 48), Enum.Material.Slate, "Pedestal")
	local gem = b:Part({ Name = "Gem", Size = Vector3.new(1.2, 1.2, 1.2), CF = CFrame.new(0, 2.2, 0) * CFrame.Angles(math.rad(45), 0, math.rad(45)), Color = color, Material = Enum.Material.Neon, CanCollide = false })
	b:Light(gem, color, 16, 2)
	b:Sparkles(gem, color, 6, 0.6)
	return b:Finish(base)
end

local function positionOf(s): Vector3
	if s.Cave then
		local c = MapLayout.CaveChambers[s.Cave]
		return Vector3.new(s.X, c.Floor, s.Z)
	elseif s.Zone == "orbital_ring" then
		for _, a in MapLayout.Asteroids do
			if math.abs(a.X - s.X) < 1 and math.abs(a.Z - s.Z) < 1 then
				return Vector3.new(s.X, MapLayout.ORBIT_Y + a.TopOffset, s.Z)
			end
		end
	end
	return Vector3.new(s.X, (TerrainGenerator.Sample(s.X, s.Z)), s.Z)
end

function SecretService:Found(player: Player, profile, id: string): (boolean, string?)
	local s = Progression.SecretsById[id]
	if not s then
		return false
	end
	if profile.Secrets[id] then
		return false, "You already found this relic."
	end
	profile.Secrets[id] = os.time()
	Registry.DataService:Mark(player, "Secrets")
	local credits = math.floor(500 * Formulas.CrateCreditScale(Formulas.Tier(profile)))
	Registry.EconomyService:AddGems(player, s.Gems)
	Registry.EconomyService:AddCredits(player, credits, true)
	local count = 0
	for _ in profile.Secrets do
		count += 1
	end
	Registry.DataService:MaxStat(player, "SecretsFound", count)
	Net.Event("Reward"):FireClient(player, { Kind = "Secret", Name = s.Name, Gems = s.Gems, Credits = credits, Count = count })
	return true, string.format("Relic found: %s! +%d Gems, +%s", s.Name, s.Gems, Format.Credits(credits))
end

function SecretService:Init() end

function SecretService:Start()
	task.spawn(function()
		Registry.WorldService:WaitReady()
		local folder = Workspace:WaitForChild("Relics")
		for _, s in Progression.Secrets do
			local m = relicModel(Color3.fromRGB(255, 200, 90))
			m.Name = "Relic_" .. s.Id
			m:PivotTo(CFrame.new(positionOf(s)))
			m:SetAttribute("SecretId", s.Id)
			m.ModelStreamingMode = Enum.ModelStreamingMode.Atomic
			local prompt = Instance.new("ProximityPrompt")
			prompt.ActionText = "Inspect"
			prompt.ObjectText = "Ancient Relic"
			prompt.HoldDuration = 1
			prompt.MaxActivationDistance = 10
			prompt.RequiresLineOfSight = false
			prompt:SetAttribute("Action", "Relic")
			prompt:SetAttribute("SecretId", s.Id)
			prompt.Parent = m.PrimaryPart
			m.Parent = folder
		end
	end)
	game:GetService("ProximityPromptService").PromptTriggered:Connect(function(prompt, player)
		if prompt:GetAttribute("Action") ~= "Relic" then
			return
		end
		local profile = Registry.DataService:Get(player)
		if not profile then
			return
		end
		local ok, msg = self:Found(player, profile, prompt:GetAttribute("SecretId"))
		if msg then
			Net.Event("Notify"):FireClient(player, { Text = msg, Kind = ok and "Good" or "Info", Icon = "🏺" })
		end
	end)
end

return SecretService
