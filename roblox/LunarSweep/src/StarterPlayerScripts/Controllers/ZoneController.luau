--!nonstrict
-- Tracks which zone you are in: per-zone lighting mood, music, zone banner, helmet lamp
-- in dark zones, and local collision of zone barriers (locked zones are solid walls).

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Lighting = game:GetService("Lighting")
local TweenService = game:GetService("TweenService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Zones = require(Shared.Config.Zones)
local MapLayout = require(Shared.MapLayout)

local player = Players.LocalPlayer

local ZoneController = {}

local ctx
ZoneController.Current = "hub"

local function zoneDef(id: string)
	return Zones.ById[id] or Zones.Hub
end

local function applyLighting(id: string)
	local z = zoneDef(id)
	local L = z.Lighting
	local info = TweenInfo.new(2.5, Enum.EasingStyle.Sine)
	TweenService:Create(Lighting, info, {
		Brightness = L.Brightness,
		Ambient = L.Ambient,
		OutdoorAmbient = L.OutdoorAmbient,
		ExposureCompensation = L.Exposure,
	}):Play()
	local cc = Lighting:FindFirstChild("ColorGrade")
	if cc then
		TweenService:Create(cc, info, { TintColor = L.ColorTint }):Play()
	end
end

local function setHelmetLamp(on: boolean)
	local character = player.Character
	local helmet = character and character:FindFirstChild("SpaceHelmet")
	if helmet then
		for _, d in helmet:GetDescendants() do
			if d:IsA("SpotLight") then
				d.Enabled = on
			end
		end
	end
end

function ZoneController:UpdateBarriers()
	local profile = ctx.Data.Profile
	if not profile then
		return
	end
	local hub = Workspace:FindFirstChild("Hub")
	local folder = hub and hub:FindFirstChild("Barriers")
	if not folder then
		return
	end
	local function unlocked(id)
		return id == "hub" or profile.Zones[id] == true
	end
	for _, wall in folder:GetChildren() do
		if wall:IsA("BasePart") and wall.Name == "Barrier" then
			local a, b = wall:GetAttribute("ZoneA"), wall:GetAttribute("ZoneB")
			local open = unlocked(a) and unlocked(b)
			wall.CanCollide = not open
			wall.Transparency = open and 1 or 0.15
		end
	end
end

function ZoneController:Init(c)
	ctx = c
end

function ZoneController:Start()
	ctx.Data:Watch({ "Zones" }, function()
		self:UpdateBarriers()
	end)
	task.spawn(function()
		local hub = Workspace:WaitForChild("Hub", 120)
		if hub then
			local folder = hub:WaitForChild("Barriers", 60)
			if folder then
				self:UpdateBarriers()
				folder.ChildAdded:Connect(function()
					self:UpdateBarriers()
				end)
			end
		end
	end)
	applyLighting("hub")
	task.spawn(function()
		while true do
			task.wait(0.4)
			local character = player.Character
			local hrp = character and character:FindFirstChild("HumanoidRootPart")
			if hrp then
				local id = MapLayout.ZoneAt(hrp.Position)
				if id ~= self.Current then
					self.Current = id
					applyLighting(id)
					if ctx.HUD then
						ctx.HUD:SetZone(id)
					end
					local z = zoneDef(id)
					ctx.Sound:SetMusic(z.Music)
					if ctx.UI and id ~= "hub" then
						ctx.UI:Notify(string.format("%s - %s", z.Name, z.Subtitle or ""), "Info", "🌙")
					end
				end
				local dark = zoneDef(id).Lighting.Dark or (id == "crystal_caverns" and hrp.Position.Y < -20)
				setHelmetLamp(dark)
			end
		end
	end)
end

return ZoneController
