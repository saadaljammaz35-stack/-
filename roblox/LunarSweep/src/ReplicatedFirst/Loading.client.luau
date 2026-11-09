--!nonstrict
-- Custom loading screen: shows server-side world generation progress and waits until the
-- client UI reports it is ready.

local Players = game:GetService("Players")
local ReplicatedFirst = game:GetService("ReplicatedFirst")
local TweenService = game:GetService("TweenService")
local Workspace = game:GetService("Workspace")

local player = Players.LocalPlayer
pcall(function()
	ReplicatedFirst:RemoveDefaultLoadingScreen()
end)

local gui = Instance.new("ScreenGui")
gui.Name = "LoadingScreen"
gui.IgnoreGuiInset = true
gui.DisplayOrder = 100
gui.ResetOnSpawn = false
gui.Parent = player:WaitForChild("PlayerGui")

local bg = Instance.new("Frame")
bg.Size = UDim2.fromScale(1, 1)
bg.BackgroundColor3 = Color3.fromRGB(6, 8, 14)
bg.BorderSizePixel = 0
bg.Parent = gui

-- a few stars
local rng = Random.new(5)
for _ = 1, 90 do
	local s = Instance.new("Frame")
	local size = rng:NextInteger(1, 3)
	s.Size = UDim2.fromOffset(size, size)
	s.Position = UDim2.fromScale(rng:NextNumber(), rng:NextNumber())
	s.BackgroundColor3 = Color3.new(1, 1, 1)
	s.BackgroundTransparency = rng:NextNumber(0, 0.6)
	s.BorderSizePixel = 0
	s.Parent = bg
end

local moon = Instance.new("Frame")
moon.AnchorPoint = Vector2.new(0.5, 0.5)
moon.Position = UDim2.fromScale(0.5, 0.38)
moon.Size = UDim2.fromOffset(160, 160)
moon.BackgroundColor3 = Color3.fromRGB(200, 200, 205)
moon.BorderSizePixel = 0
moon.Parent = bg
local mc = Instance.new("UICorner")
mc.CornerRadius = UDim.new(0.5, 0)
mc.Parent = moon
local clean = Instance.new("Frame")
clean.Size = UDim2.fromScale(0, 1)
clean.BackgroundColor3 = Color3.fromRGB(245, 246, 250)
clean.BorderSizePixel = 0
clean.Parent = moon
local cc = Instance.new("UICorner")
cc.CornerRadius = UDim.new(0.5, 0)
cc.Parent = clean

local title = Instance.new("TextLabel")
title.AnchorPoint = Vector2.new(0.5, 0)
title.Position = UDim2.fromScale(0.5, 0.55)
title.Size = UDim2.fromOffset(600, 70)
title.BackgroundTransparency = 1
title.Font = Enum.Font.BuilderSansExtraBold
title.TextSize = 64
title.TextColor3 = Color3.fromRGB(255, 122, 26)
title.Text = "LUNAR SWEEP"
title.Parent = bg

local status = Instance.new("TextLabel")
status.AnchorPoint = Vector2.new(0.5, 0)
status.Position = UDim2.fromScale(0.5, 0.66)
status.Size = UDim2.fromOffset(600, 30)
status.BackgroundTransparency = 1
status.Font = Enum.Font.BuilderSansBold
status.TextSize = 20
status.TextColor3 = Color3.fromRGB(180, 186, 200)
status.Text = "Connecting to the colony..."
status.Parent = bg

local barBg = Instance.new("Frame")
barBg.AnchorPoint = Vector2.new(0.5, 0)
barBg.Position = UDim2.fromScale(0.5, 0.72)
barBg.Size = UDim2.fromOffset(420, 12)
barBg.BackgroundColor3 = Color3.fromRGB(30, 34, 42)
barBg.BorderSizePixel = 0
barBg.Parent = bg
local bc = Instance.new("UICorner")
bc.CornerRadius = UDim.new(0, 6)
bc.Parent = barBg
local bar = Instance.new("Frame")
bar.Size = UDim2.fromScale(0, 1)
bar.BackgroundColor3 = Color3.fromRGB(255, 122, 26)
bar.BorderSizePixel = 0
bar.Parent = barBg
local bc2 = Instance.new("UICorner")
bc2.CornerRadius = UDim.new(0, 6)
bc2.Parent = bar

local tips = {
	"Tip: dark zones? Your helmet lamp switches on automatically.",
	"Tip: cleaning next to other players gives a co-op bonus.",
	"Tip: press Q to pack your container into a capsule.",
	"Tip: production buildings must touch a silo or be linked with conveyors.",
	"Tip: market prices drift - sell when the board shows ▲.",
}
local tip = Instance.new("TextLabel")
tip.AnchorPoint = Vector2.new(0.5, 1)
tip.Position = UDim2.new(0.5, 0, 1, -40)
tip.Size = UDim2.fromOffset(700, 30)
tip.BackgroundTransparency = 1
tip.Font = Enum.Font.BuilderSans
tip.TextSize = 18
tip.TextColor3 = Color3.fromRGB(140, 148, 165)
tip.Text = tips[rng:NextInteger(1, #tips)]
tip.Parent = bg

local t0 = os.clock()
while true do
	local p = Workspace:GetAttribute("WorldGenProgress") or 0
	local ready = Workspace:GetAttribute("WorldReady") == true and player:GetAttribute("ClientReady") == true and game:IsLoaded()
	local text = Workspace:GetAttribute("WorldGenStatus") or "Connecting to the colony"
	if Workspace:GetAttribute("WorldReady") and not player:GetAttribute("ClientReady") then
		text = "Loading your save"
		p = 0.98
	end
	status.Text = text .. "..."
	bar.Size = UDim2.fromScale(math.clamp(p, 0, 1), 1)
	clean.Size = UDim2.fromScale(math.clamp(p, 0, 1), 1)
	if ready or os.clock() - t0 > 180 then
		break
	end
	task.wait(0.1)
end

for _, d in bg:GetDescendants() do
	if d:IsA("TextLabel") then
		TweenService:Create(d, TweenInfo.new(0.6), { TextTransparency = 1 }):Play()
	elseif d:IsA("Frame") then
		TweenService:Create(d, TweenInfo.new(0.6), { BackgroundTransparency = 1 }):Play()
	end
end
TweenService:Create(bg, TweenInfo.new(0.8), { BackgroundTransparency = 1 }):Play()
task.wait(0.85)
gui:Destroy()
