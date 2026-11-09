--!nonstrict
-- Character setup: gives the equipped cleaning tool, straps the container on the back,
-- adds the astronaut helmet / suit colours, applies movement stats, leaderstats.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local ModelFactory = require(Shared.ModelFactory)
local Robots = require(Shared.Config.Robots)
local Registry = require(script.Parent.Registry)

local PlayerService = {}

PlayerService.SUIT_COLORS = {
	Color3.fromRGB(236, 238, 242),
	Color3.fromRGB(255, 140, 40),
	Color3.fromRGB(70, 140, 255),
	Color3.fromRGB(60, 200, 110),
	Color3.fromRGB(230, 70, 70),
	Color3.fromRGB(180, 100, 255),
	Color3.fromRGB(40, 42, 50),
	Color3.fromRGB(255, 210, 60),
}
PlayerService.VISOR_COLORS = {
	Color3.fromRGB(255, 190, 60),
	Color3.fromRGB(120, 200, 255),
	Color3.fromRGB(255, 100, 180),
	Color3.fromRGB(120, 255, 170),
	Color3.fromRGB(30, 30, 40),
	Color3.fromRGB(255, 255, 255),
}

local function torsoOf(character: Model): BasePart?
	local t: any = character:FindFirstChild("UpperTorso") or character:FindFirstChild("Torso")
	return t
end

-- helper bonus from active helper robots (Buddy Bot capacity etc.)
function PlayerService:HelperBonus(player: Player, key: string): number
	local profile = Registry.DataService:Get(player)
	if not profile then
		return 0
	end
	local total = 0
	for _, r in profile.Robots do
		local def = Robots.ById[r.Id]
		if def and def.Role == "helper" and r.Enabled ~= false and (r.Durability or 100) > 0 and def.Bonus and def.Bonus[key] then
			total += def.Bonus[key]
		elseif def and def.Role == "collector" and def.Bonus and def.Bonus[key] and r.Enabled ~= false then
			total += def.Bonus[key]
		end
	end
	return total
end

function PlayerService:Capacity(player: Player, profile: any): number
	return Formulas.Capacity(profile, nil, self:HelperBonus(player, "Capacity"))
end

function PlayerService:ApplyMovement(player: Player)
	local profile = Registry.DataService:Get(player)
	local character = player.Character
	if not profile or not character then
		return
	end
	local hum = character:FindFirstChildOfClass("Humanoid")
	if not hum then
		return
	end
	local extra = 0
	local zone = Registry.ZoneService and Registry.ZoneService:ZoneOf(player)
	if zone == "shadow_side" or zone == "crystal_caverns" then
		extra += self:HelperBonus(player, "DarkSpeed")
	end
	local speed = Formulas.WalkSpeed(profile, extra)
	if character:GetAttribute("Carrying") then
		speed *= 1 - 0.2
	end
	hum.WalkSpeed = speed
	hum.UseJumpPower = true
	hum.JumpPower = Formulas.JumpPower(profile)
	character:SetAttribute("AirJumps", Formulas.AirJumps(profile))
end

function PlayerService:GiveTool(player: Player)
	local profile = Registry.DataService:Get(player)
	if not profile then
		return
	end
	local backpack = player:FindFirstChildOfClass("Backpack")
	local character = player.Character
	local wasEquipped = false
	for _, container in { backpack, character } do
		if container then
			for _, t in container:GetChildren() do
				if t:IsA("Tool") and t:GetAttribute("CleaningTool") then
					if t.Parent == character then
						wasEquipped = true
					end
					t:Destroy()
				end
			end
		end
	end
	local tool = ModelFactory.Tool(profile.EquippedTool)
	if backpack then
		tool.Parent = backpack
	end
	if wasEquipped and character then
		local hum = character:FindFirstChildOfClass("Humanoid")
		if hum then
			hum:EquipTool(tool)
		end
	end
end

function PlayerService:AttachContainer(player: Player)
	local profile = Registry.DataService:Get(player)
	local character = player.Character
	if not profile or not character then
		return
	end
	local old = character:FindFirstChild("DustContainer")
	if old then
		old:Destroy()
	end
	local torso = torsoOf(character)
	if not torso then
		return
	end
	local model = ModelFactory.Container(profile.EquippedContainer)
	model.Name = "DustContainer"
	local root = model.PrimaryPart :: BasePart
	ModelFactory.Builder.WeldAll(model, root, true)
	root.Massless = true
	model:PivotTo(torso.CFrame * CFrame.new(0, 0.1, torso.Size.Z / 2 + 0.05))
	local weld = Instance.new("WeldConstraint")
	weld.Part0 = torso
	weld.Part1 = root
	weld.Parent = root
	model.Parent = character
	self:UpdateFill(player)
end

function PlayerService:UpdateFill(player: Player)
	local profile = Registry.DataService:Get(player)
	local character = player.Character
	if not profile or not character then
		return
	end
	local cap = self:Capacity(player, profile)
	local kg = Formulas.ContentsKg(profile.Contents)
	character:SetAttribute("ContainerFill", math.clamp(kg / math.max(cap, 0.001), 0, 1))
	player:SetAttribute("ContainerKg", kg)
	player:SetAttribute("ContainerCap", cap)
end

function PlayerService:ApplyCosmetics(player: Player)
	local profile = Registry.DataService:Get(player)
	local character = player.Character
	if not profile or not character then
		return
	end
	local head = character:FindFirstChild("Head") :: BasePart?
	local old = character:FindFirstChild("SpaceHelmet")
	if old then
		old:Destroy()
	end
	local cos = profile.Cosmetics
	local suit = self.SUIT_COLORS[cos.Suit] or self.SUIT_COLORS[1]
	local visor = self.VISOR_COLORS[cos.Visor] or self.VISOR_COLORS[1]
	if cos.Helmet and head then
		local helmet = ModelFactory.Helmet(visor, suit)
		local root = helmet.PrimaryPart :: BasePart
		ModelFactory.Builder.WeldAll(helmet, root, true)
		root.Massless = true
		helmet:PivotTo(head.CFrame)
		local weld = Instance.new("WeldConstraint")
		weld.Part0 = head
		weld.Part1 = root
		weld.Parent = root
		helmet.Parent = character
	end
	if cos.SuitOn then
		for _, d in character:GetChildren() do
			if d:IsA("BasePart") and d.Name ~= "Head" and d.Name ~= "HumanoidRootPart" then
				d.Color = suit
			elseif d:IsA("Shirt") or d:IsA("Pants") or d:IsA("ShirtGraphic") then
				d:Destroy()
			end
		end
		local bc = character:FindFirstChildOfClass("BodyColors")
		if bc then
			bc.TorsoColor3 = suit
			bc.LeftArmColor3 = suit
			bc.RightArmColor3 = suit
			bc.LeftLegColor3 = suit
			bc.RightLegColor3 = suit
		end
	end
end

function PlayerService:RefreshAll(player: Player)
	self:GiveTool(player)
	self:AttachContainer(player)
	self:ApplyMovement(player)
end

local function setupLeaderstats(player: Player, profile: any)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	local level = Instance.new("IntValue")
	level.Name = "Level"
	level.Value = profile.Level
	level.Parent = ls
	local credits = Instance.new("StringValue")
	credits.Name = "Credits"
	credits.Value = Format.Number(profile.Credits)
	credits.Parent = ls
	local rebirths = Instance.new("IntValue")
	rebirths.Name = "Re-Launch"
	rebirths.Value = profile.Rebirths
	rebirths.Parent = ls
	ls.Parent = player
end

function PlayerService:UpdateLeaderstats(player: Player)
	local profile = Registry.DataService:Get(player)
	local ls = player:FindFirstChild("leaderstats")
	if not profile or not ls then
		return
	end
	local lv = ls:FindFirstChild("Level") :: IntValue?
	local cr = ls:FindFirstChild("Credits") :: StringValue?
	local rb = ls:FindFirstChild("Re-Launch") :: IntValue?
	if lv then
		lv.Value = profile.Level
	end
	if cr then
		cr.Value = Format.Number(profile.Credits)
	end
	if rb then
		rb.Value = profile.Rebirths
	end
end

local function onCharacter(player: Player, character: Model)
	local profile = Registry.DataService:WaitFor(player, 60)
	if not profile or player.Character ~= character then
		return
	end
	character:WaitForChild("Humanoid", 10)
	task.wait(0.2)
	PlayerService:ApplyCosmetics(player)
	PlayerService:RefreshAll(player)
	local hum = character:FindFirstChildOfClass("Humanoid")
	if hum then
		hum.BreakJointsOnDeath = false
	end
end

function PlayerService:Init() end

function PlayerService:Start()
	Registry.DataService.Loaded:Connect(function(player, profile)
		setupLeaderstats(player, profile)
		if player.Character then
			task.spawn(onCharacter, player, player.Character)
		end
	end)
	Players.PlayerAdded:Connect(function(player)
		player.CharacterAdded:Connect(function(character)
			onCharacter(player, character)
		end)
	end)
	for _, p in Players:GetPlayers() do
		p.CharacterAdded:Connect(function(character)
			onCharacter(p, character)
		end)
	end
	-- keep leaderstats/fill in sync
	task.spawn(function()
		while true do
			task.wait(1)
			for _, p in Players:GetPlayers() do
				self:UpdateLeaderstats(p)
			end
		end
	end)
end

return PlayerService
