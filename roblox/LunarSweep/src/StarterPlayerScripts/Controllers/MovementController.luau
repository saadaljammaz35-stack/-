--!nonstrict
-- Jetpack mid-air boosts (Thrust Assist upgrade). The character is physics-owned by the
-- client, so the boost is applied locally; the server's movement check allows it.

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")

local player = Players.LocalPlayer

local MovementController = {}

local ctx
local used = 0

local function flame(hrp: BasePart)
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CastShadow = false
	p.Material = Enum.Material.Neon
	p.Color = Color3.fromRGB(120, 200, 255)
	p.Size = Vector3.new(1, 2.4, 1)
	p.CFrame = hrp.CFrame * CFrame.new(0, -2, 1)
	p.Parent = Workspace:FindFirstChild("LocalFX") or Workspace
	game:GetService("TweenService"):Create(p, TweenInfo.new(0.35), { Transparency = 1, Size = Vector3.new(0.3, 4, 0.3) }):Play()
	task.delay(0.4, function()
		p:Destroy()
	end)
end

function MovementController:Init(c)
	ctx = c
end

function MovementController:Start()
	local function hook(character: Model)
		used = 0
		local hum = character:WaitForChild("Humanoid", 10) :: Humanoid?
		if not hum then
			return
		end
		hum.StateChanged:Connect(function(_, new)
			if new == Enum.HumanoidStateType.Landed or new == Enum.HumanoidStateType.Running then
				used = 0
			end
		end)
	end
	if player.Character then
		task.spawn(hook, player.Character)
	end
	player.CharacterAdded:Connect(hook)
	UserInputService.JumpRequest:Connect(function()
		local character = player.Character
		local hum = character and character:FindFirstChildOfClass("Humanoid")
		local hrp = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
		if not hum or not hrp then
			return
		end
		local allowed = character:GetAttribute("AirJumps") or 0
		local state = hum:GetState()
		if allowed > 0 and used < allowed and (state == Enum.HumanoidStateType.Freefall or state == Enum.HumanoidStateType.Jumping) and hrp.AssemblyLinearVelocity.Y < hum.JumpPower * 0.6 then
			used += 1
			local v = hrp.AssemblyLinearVelocity
			hrp.AssemblyLinearVelocity = Vector3.new(v.X, hum.JumpPower * 0.95, v.Z)
			flame(hrp)
			ctx.Sound:Play("jetpack")
		end
	end)
end

return MovementController
