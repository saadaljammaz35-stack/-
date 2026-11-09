--!nonstrict
-- Status billboards over your robots (state, battery, cargo) and the "Show robots" setting
-- (hides other players' robots locally for performance).

local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")

local player = Players.LocalPlayer

local RobotVisualController = {}

local ctx

local STATE_TEXT = {
	Docked = "Charging",
	Travel = "Warping",
	Working = "Working",
	Returning = "Returning",
	Broken = "BROKEN",
	NoWork = "Zone clean!",
	SiloFull = "Silo full",
	Following = "Following",
}

local function billboard(model: Model)
	local root = model.PrimaryPart
	if not root or root:FindFirstChild("RobotTag") then
		return
	end
	local bb = Instance.new("BillboardGui")
	bb.Name = "RobotTag"
	bb.Size = UDim2.fromOffset(150, 44)
	bb.StudsOffset = Vector3.new(0, 4, 0)
	bb.MaxDistance = 90
	bb.LightInfluence = 0
	bb.Parent = root
	local label = Instance.new("TextLabel")
	label.Name = "Text"
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundColor3 = Color3.fromRGB(20, 22, 28)
	label.BackgroundTransparency = 0.3
	label.TextColor3 = Color3.fromRGB(230, 235, 245)
	label.Font = Enum.Font.BuilderSansBold
	label.TextScaled = true
	label.Parent = bb
	local corner = Instance.new("UICorner")
	corner.Parent = label
end

function RobotVisualController:Init(c)
	ctx = c
end

function RobotVisualController:Start()
	task.spawn(function()
		local folder = Workspace:WaitForChild("Robots", 120)
		if not folder then
			return
		end
		while true do
			task.wait(0.5)
			local profile = ctx.Data.Profile
			local showOthers = not profile or profile.Settings.ShowRobots ~= false
			for _, m in folder:GetChildren() do
				if m:IsA("Model") then
					local mine = m:GetAttribute("Owner") == player.UserId
					if mine then
						billboard(m)
						local root = m.PrimaryPart
						local tag = root and root:FindFirstChild("RobotTag")
						local label = tag and tag:FindFirstChild("Text")
						if label then
							local state = m:GetAttribute("State") or "?"
							local kg = m:GetAttribute("Kg") or 0
							local cap = m:GetAttribute("Cap") or 0
							label.Text = string.format("%s\n%s  🔋%d%%%s", m.Name, STATE_TEXT[state] or state, m:GetAttribute("Battery") or 0, cap > 0 and string.format("  %.1f/%.0fkg", kg, cap) or "")
							label.TextColor3 = state == "Broken" and Color3.fromRGB(255, 90, 90) or Color3.fromRGB(230, 235, 245)
						end
					end
					local hide = not mine and not showOthers
					for _, d in m:GetDescendants() do
						if d:IsA("BasePart") then
							d.LocalTransparencyModifier = hide and 1 or 0
						end
					end
				end
			end
		end
	end)
end

return RobotVisualController
