--!nonstrict
-- Camera modes:
--   * Main menu: slow orbit over the colony.
--   * On foot: first person by default (setting "FirstPerson", toggle with V), third person
--     otherwise. The cursor is locked to the crosshair in first person and freed while a
--     panel is open, in build mode, or while LeftAlt is held.
--   * Driving: third person chase camera behind the vehicle.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")

local player = Players.LocalPlayer

local CameraController = {}

local ctx
local orbitConn: RBXScriptConnection? = nil
local inMenu = false
local freeReasons: { [string]: boolean? } = {}
local modal: TextButton? = nil
local crosshair: Frame? = nil

local function driving(): boolean
	return player:GetAttribute("Driving") ~= nil
end

local function settingOn(): boolean
	local p = ctx and ctx.Data and ctx.Data.Profile
	if p and p.Settings and p.Settings.FirstPerson ~= nil then
		return p.Settings.FirstPerson == true
	end
	return true
end

function CameraController:IsFirstPerson(): boolean
	return not inMenu and settingOn() and not driving()
end

function CameraController:CursorFree(): boolean
	return next(freeReasons) ~= nil
end

local function refreshCursor()
	local free = next(freeReasons) ~= nil
	if modal then
		-- a visible Modal button releases the mouse lock in first person
		modal.Visible = free and CameraController:IsFirstPerson()
	end
	if crosshair then
		crosshair.Visible = CameraController:IsFirstPerson() and not free
	end
end

function CameraController:SetCursorFree(reason: string, on: boolean)
	if on then
		freeReasons[reason] = true
	else
		freeReasons[reason] = nil
	end
	refreshCursor()
end

function CameraController:Apply()
	if inMenu then
		return
	end
	local cam = Workspace.CurrentCamera
	if cam and cam.CameraType == Enum.CameraType.Scriptable then
		cam.CameraType = Enum.CameraType.Custom
	end
	if driving() then
		player.CameraMode = Enum.CameraMode.Classic
		player.CameraMinZoomDistance = 12
		player.CameraMaxZoomDistance = 60
	elseif settingOn() then
		player.CameraMode = Enum.CameraMode.LockFirstPerson
		player.CameraMinZoomDistance = 0.5
		player.CameraMaxZoomDistance = 0.5
	else
		player.CameraMode = Enum.CameraMode.Classic
		player.CameraMinZoomDistance = 0.5
		player.CameraMaxZoomDistance = 60
		-- coming out of first person: pull the camera back
		if cam and player.Character and player.Character:FindFirstChild("Head") then
			local head = player.Character.Head :: BasePart
			if (cam.CFrame.Position - head.Position).Magnitude < 2 then
				player.CameraMinZoomDistance = 14
				task.delay(0.1, function()
					if not settingOn() and not driving() then
						player.CameraMinZoomDistance = 0.5
					end
				end)
			end
		end
	end
	refreshCursor()
end

function CameraController:SetFirstPerson(on: boolean)
	local p = ctx.Data.Profile
	if p then
		p.Settings.FirstPerson = on
	end
	self:Apply()
	ctx.UI:Request("SaveSettings", { Settings = { FirstPerson = on } })
end

function CameraController:StartMenuOrbit()
	local cam = Workspace.CurrentCamera
	if not cam or orbitConn then
		return
	end
	inMenu = true
	player.CameraMode = Enum.CameraMode.Classic
	cam.CameraType = Enum.CameraType.Scriptable
	refreshCursor()
	local t = 0
	orbitConn = RunService.RenderStepped:Connect(function(dt)
		t += dt * 0.06
		local pos = Vector3.new(math.sin(t) * 150, 70 + math.sin(t * 0.7) * 12, math.cos(t) * 150)
		cam.CFrame = CFrame.lookAt(pos, Vector3.new(0, 8, 0))
	end)
end

function CameraController:StopMenuOrbit()
	if orbitConn then
		orbitConn:Disconnect()
		orbitConn = nil
	end
	inMenu = false
	local cam = Workspace.CurrentCamera
	if cam then
		cam.CameraType = Enum.CameraType.Custom
	end
	self:Apply()
end

function CameraController:Init(c)
	ctx = c
end

function CameraController:Start()
	local root = ctx.Root
	if root then
		local b = Instance.new("TextButton")
		b.Name = "CursorUnlock"
		b.Modal = true
		b.Text = ""
		b.BackgroundTransparency = 1
		b.Size = UDim2.fromOffset(0, 0)
		b.Visible = false
		b.Parent = root
		modal = b
		local ch = Instance.new("Frame")
		ch.Name = "Crosshair"
		ch.AnchorPoint = Vector2.new(0.5, 0.5)
		ch.Position = UDim2.fromScale(0.5, 0.5)
		ch.Size = UDim2.fromOffset(6, 6)
		ch.BackgroundColor3 = Color3.new(1, 1, 1)
		ch.BackgroundTransparency = 0.15
		ch.Visible = false
		local corner = Instance.new("UICorner")
		corner.CornerRadius = UDim.new(1, 0)
		corner.Parent = ch
		local stroke = Instance.new("UIStroke")
		stroke.Color = Color3.new(0, 0, 0)
		stroke.Transparency = 0.4
		stroke.Thickness = 1
		stroke.Parent = ch
		ch.Parent = root
		crosshair = ch
	end
	UserInputService.InputBegan:Connect(function(input, processed)
		if input.KeyCode == Enum.KeyCode.LeftAlt then
			self:SetCursorFree("alt", true)
			return
		end
		if processed or inMenu then
			return
		end
		if input.KeyCode == Enum.KeyCode.V or input.KeyCode == Enum.KeyCode.ButtonL3 then
			self:SetFirstPerson(not settingOn())
			ctx.UI:Notify(settingOn() and "First-person view" or "Third-person view", "Info", "🎥")
		end
	end)
	UserInputService.InputEnded:Connect(function(input)
		if input.KeyCode == Enum.KeyCode.LeftAlt then
			self:SetCursorFree("alt", false)
		end
	end)
	player:GetAttributeChangedSignal("Driving"):Connect(function()
		self:Apply()
	end)
	player.CharacterAdded:Connect(function()
		task.defer(function()
			self:Apply()
		end)
	end)
	-- panels free the cursor while open
	task.spawn(function()
		local last = nil
		while true do
			task.wait(0.15)
			local open = ctx.UI.Current ~= nil
			if open ~= last then
				last = open
				self:SetCursorFree("panel", open)
			end
		end
	end)
	if ctx.Data.Changed then
		ctx.Data.Changed:Connect(function(key)
			if key == "Settings" then
				self:Apply()
			end
		end)
	end
end

return CameraController
