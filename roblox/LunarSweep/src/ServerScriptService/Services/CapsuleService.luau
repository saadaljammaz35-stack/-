--!nonstrict
-- Dust capsules: pack your container into a capsule and keep cleaning. Capsules can be
-- carried (one at a time, slows you down), deposited at the Exchange or a base hopper,
-- fetched by hauler robots, pulled home by a Capsule Catcher, or recalled for a fee.
-- Only the owner can interact with their capsules.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local ModelFactory = require(Shared.ModelFactory)
local Net = require(Shared.Net)
local Registry = require(script.Parent.Registry)

local CapsuleService = {}

type Capsule = { Id: number, Owner: number, Contents: { [string]: number }, Kg: number, Model: Model, Created: number, Carried: boolean, Claimed: boolean }

local capsules: { [number]: Capsule } = {}
local carrying: { [Player]: Capsule } = {}
local nextId = 0
local folder: Folder

local function notify(player: Player, text: string, kind: string?)
	Net.Event("Notify"):FireClient(player, { Text = text, Kind = kind or "Info", Icon = "🛢" })
end

local function ownedBy(userId: number): { Capsule }
	local out = {}
	for _, c in capsules do
		if c.Owner == userId and not c.Claimed then
			table.insert(out, c)
		end
	end
	return out
end
CapsuleService.OwnedBy = function(_, userId)
	return ownedBy(userId)
end

local function destroy(c: Capsule)
	capsules[c.Id] = nil
	c.Claimed = true
	if c.Model then
		c.Model:Destroy()
	end
end

local function updatePlayerCount(userId: number)
	local player = Players:GetPlayerByUserId(userId)
	if player then
		player:SetAttribute("Capsules", #ownedBy(userId))
	end
end

function CapsuleService:Pack(player: Player, auto: boolean?): boolean
	local profile = Registry.DataService:Get(player)
	local character = player.Character
	local hrp = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not profile or not hrp then
		return false
	end
	if carrying[player] then
		self:Drop(player)
		return true
	end
	local kg = Formulas.ContentsKg(profile.Contents)
	if kg < 0.01 then
		if not auto then
			notify(player, "Nothing to pack - your container is empty.")
		end
		return false
	end
	if #ownedBy(player.UserId) >= GameConfig.MaxCapsules then
		if not auto then
			notify(player, "Too many capsules out. Deposit or recall some first.", "Warning")
		end
		return false
	end
	nextId += 1
	local model = ModelFactory.Capsule(Color3.fromRGB(255, 140, 40))
	model.Name = "Capsule"
	local ground = Registry.WorldService:GroundAt(hrp.Position.X - hrp.CFrame.LookVector.X * 4, hrp.Position.Z - hrp.CFrame.LookVector.Z * 4, hrp.Position.Y)
	local pos = hrp.Position - hrp.CFrame.LookVector * 4
	local y = math.abs(ground - hrp.Position.Y) < 12 and ground or (hrp.Position.Y - 3)
	model:PivotTo(CFrame.new(pos.X, y, pos.Z))
	model:SetAttribute("CapsuleId", nextId)
	model:SetAttribute("Owner", player.UserId)
	model:SetAttribute("Kg", kg)
	local root = model.PrimaryPart :: BasePart
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "Carry"
	prompt.ObjectText = string.format("%s's capsule (%s)", player.DisplayName, Format.Kg(kg))
	prompt.HoldDuration = 0.2
	prompt.MaxActivationDistance = 10
	prompt.RequiresLineOfSight = false
	prompt:SetAttribute("Action", "CarryCapsule")
	prompt:SetAttribute("Owner", player.UserId)
	prompt.Parent = root
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.fromOffset(120, 30)
	bb.StudsOffset = Vector3.new(0, 2.6, 0)
	bb.MaxDistance = 90
	bb.LightInfluence = 0
	bb.Parent = root
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.TextColor3 = Color3.fromRGB(255, 200, 120)
	label.TextStrokeTransparency = 0.3
	label.Font = Enum.Font.BuilderSansBold
	label.TextScaled = true
	label.Text = Format.Kg(kg)
	label.Parent = bb
	model.Parent = folder
	local c: Capsule = { Id = nextId, Owner = player.UserId, Contents = profile.Contents, Kg = kg, Model = model, Created = os.clock(), Carried = false, Claimed = false }
	capsules[nextId] = c
	profile.Contents = {}
	Registry.DataService:Mark(player, "Contents")
	Registry.PlayerService:UpdateFill(player)
	Registry.DataService:AddStat(player, "CapsulesPacked", 1)
	updatePlayerCount(player.UserId)
	Net.Event("Reward"):FireClient(player, { Kind = "Capsule", Kg = kg, Auto = auto })
	return true
end

function CapsuleService:Carry(player: Player, capsuleId: number): (boolean, string?)
	local c = capsules[capsuleId]
	local character = player.Character
	local hrp = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not c or c.Claimed or not hrp or not character then
		return false, "Capsule not found."
	end
	if c.Owner ~= player.UserId then
		return false, "That isn't your capsule."
	end
	if carrying[player] then
		return false, "You are already carrying a capsule."
	end
	if (c.Model:GetPivot().Position - hrp.Position).Magnitude > 16 then
		return false, "Too far away."
	end
	c.Carried = true
	carrying[player] = c
	local root = c.Model.PrimaryPart :: BasePart
	ModelFactory.Builder.WeldAll(c.Model, root, true)
	ModelFactory.Builder.SetCollide(c.Model, false)
	root.Massless = true
	c.Model:PivotTo(hrp.CFrame * CFrame.new(0, -1.2, -2.6))
	local weld = Instance.new("WeldConstraint")
	weld.Name = "CarryWeld"
	weld.Part0 = hrp
	weld.Part1 = root
	weld.Parent = root
	c.Model.Parent = character
	local prompt = root:FindFirstChildOfClass("ProximityPrompt")
	if prompt then
		prompt.Enabled = false
	end
	character:SetAttribute("Carrying", true)
	Registry.PlayerService:ApplyMovement(player)
	return true
end

function CapsuleService:Drop(player: Player)
	local c = carrying[player]
	if not c then
		return
	end
	carrying[player] = nil
	local character = player.Character
	if character then
		character:SetAttribute("Carrying", nil)
	end
	local root = c.Model.PrimaryPart :: BasePart
	local weld = root and root:FindFirstChild("CarryWeld")
	if weld then
		weld:Destroy()
	end
	local pos = c.Model:GetPivot().Position
	local ground = Registry.WorldService:GroundAt(pos.X, pos.Z, pos.Y)
	for _, d in c.Model:GetDescendants() do
		if d:IsA("BasePart") then
			d.Anchored = true
		end
	end
	ModelFactory.Builder.SetCollide(c.Model, true, true)
	c.Model:PivotTo(CFrame.new(pos.X, math.abs(ground - pos.Y) < 12 and ground or pos.Y - 2, pos.Z))
	c.Model.Parent = folder
	c.Carried = false
	local prompt = root and root:FindFirstChildOfClass("ProximityPrompt")
	if prompt then
		prompt.Enabled = true
	end
	Registry.PlayerService:ApplyMovement(player)
end

-- Remove the carried capsule and return its contents (used by deposits)
function CapsuleService:TakeCarried(player: Player): { [string]: number }?
	local c = carrying[player]
	if not c then
		return nil
	end
	carrying[player] = nil
	if player.Character then
		player.Character:SetAttribute("Carrying", nil)
	end
	local contents = c.Contents
	destroy(c)
	updatePlayerCount(c.Owner)
	Registry.PlayerService:ApplyMovement(player)
	return contents
end

-- Claim a capsule (robots / catcher). Returns contents.
function CapsuleService:Claim(c: Capsule): { [string]: number }?
	if c.Claimed or c.Carried then
		return nil
	end
	local contents = c.Contents
	destroy(c)
	updatePlayerCount(c.Owner)
	return contents
end

function CapsuleService:Recall(player: Player, profile, free: boolean?): (number, number)
	local list = ownedBy(player.UserId)
	local fee = free and 0 or GameConfig.CapsuleRecallFee * math.max(0, 1 - 0.25 * (profile.Upgrades.capsule_tether or 0))
	local moved, count = 0, 0
	for _, c in list do
		if not c.Carried then
			local contents = {}
			for res, kg in c.Contents do
				contents[res] = kg * (1 - fee)
			end
			local space = Registry.BaseService:SiloSpace(player)
			local kg = Formulas.ContentsKg(contents)
			if kg <= space + 1e-6 then
				Registry.BaseService:AddToSilo(player, contents)
				moved += kg
				count += 1
				destroy(c)
			end
		end
	end
	updatePlayerCount(player.UserId)
	return count, moved
end

function CapsuleService:Init()
	folder = Workspace:WaitForChild("Capsules") :: Folder
end

function CapsuleService:Start()
	Net.Event("PackCapsule").OnServerEvent:Connect(function(player)
		pcall(self.Pack, self, player, false)
	end)
	Registry.Router.Register("RecallCapsules", function(player, profile)
		if not Registry.BaseService:HasPlot(player) then
			return false, "You need a base to recall capsules."
		end
		local count, kg = self:Recall(player, profile, false)
		if count == 0 then
			return false, "No capsules recalled (none out, or your silo is full)."
		end
		return true, string.format("Recalled %d capsules (%s) to your silo", count, Format.Kg(kg))
	end, 1, 2)
	-- prompt actions
	game:GetService("ProximityPromptService").PromptTriggered:Connect(function(prompt, player)
		if prompt:GetAttribute("Action") == "CarryCapsule" then
			local model = prompt:FindFirstAncestorOfClass("Model")
			local id = model and model:GetAttribute("CapsuleId")
			if id then
				local ok, msg = self:Carry(player, id)
				if not ok and msg then
					notify(player, msg, "Warning")
				end
			end
		end
	end)
	-- runs before the final save so capsule contents are persisted
	Registry.DataService.Releasing:Connect(function(player)
		local c = carrying[player]
		if c then
			carrying[player] = nil
			c.Carried = false
		end
		-- capsules go home to the silo when you leave (no fee, ignores capacity)
		for _, cap in ownedBy(player.UserId) do
			Registry.BaseService:AddToSilo(player, cap.Contents, true)
			destroy(cap)
		end
	end)
	-- expiry: old capsules are recalled automatically
	task.spawn(function()
		while true do
			task.wait(30)
			local now = os.clock()
			for _, c in capsules do
				if not c.Carried and now - c.Created > GameConfig.CapsuleLifetime then
					local owner = Players:GetPlayerByUserId(c.Owner)
					if owner then
						Registry.BaseService:AddToSilo(owner, c.Contents, true)
						notify(owner, "An old capsule was auto-recalled to your silo.")
					end
					destroy(c)
					updatePlayerCount(c.Owner)
				end
			end
		end
	end)
end

return CapsuleService
