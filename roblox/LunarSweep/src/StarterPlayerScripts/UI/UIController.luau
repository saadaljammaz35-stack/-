--!nonstrict
-- Root of the interface: ScreenGui, responsive scaling, panel manager, toasts,
-- reward pop-ups and the shared request helper used by every panel.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local GuiService = game:GetService("GuiService")
local Lighting = game:GetService("Lighting")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Net = require(Shared.Net)
local Format = require(Shared.Util.Format)
local Formulas = require(Shared.Formulas)
local Rarity = require(Shared.Config.Rarity)
local Lib = require(script.Parent.Lib)
local Theme = require(script.Parent.Theme)
local Viewport = require(script.Parent.Viewport)

local C = Theme.Colors
local player = Players.LocalPlayer

local UIController = {}

UIController.Panels = {} :: { [string]: any }
UIController.Current = nil :: string?
UIController.Root = nil :: ScreenGui?
UIController.Ctx = nil :: any

local toastHolder: Frame
local blur: BlurEffect

------------------------------------------------------------------ toasts

local KIND_COLORS = {
	Info = C.PanelLighter,
	Good = Color3.fromRGB(46, 150, 86),
	Warning = Color3.fromRGB(190, 110, 30),
	Error = Color3.fromRGB(180, 50, 50),
	Event = Color3.fromRGB(110, 70, 200),
}

function UIController:Notify(text: string, kind: string?, icon: string?)
	if not toastHolder then
		return
	end
	local color = KIND_COLORS[kind or "Info"] or KIND_COLORS.Info
	local toast = Lib.Create("Frame", {
		Size = UDim2.fromOffset(380, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundColor3 = C.Panel,
		BackgroundTransparency = 0.05,
		Corner = 10,
		Stroke = { Color = color, Thickness = 2 },
		LayoutOrder = -math.floor(os.clock() * 100),
		Parent = toastHolder,
	})
	Lib.Create("Frame", { Size = UDim2.new(0, 6, 1, 0), BackgroundColor3 = color, Corner = 3, Parent = toast })
	Lib.Label((icon and (icon .. "  ") or "") .. text, {
		Size = UDim2.new(1, -24, 0, 0),
		Position = UDim2.fromOffset(16, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		TextSize = 16,
		Font = Theme.FontBold,
		Padding = { 0, 0, 8, 8 },
		Parent = toast,
	})
	if self.Ctx and self.Ctx.Sound then
		self.Ctx.Sound:Play(kind == "Warning" and "error" or "notify")
	end
	local children = 0
	for _, c in toastHolder:GetChildren() do
		if c:IsA("Frame") then
			children += 1
		end
	end
	if children > 5 then
		local oldest, order = nil, -math.huge
		for _, c in toastHolder:GetChildren() do
			if c:IsA("Frame") and c.LayoutOrder > order then
				oldest, order = c, c.LayoutOrder
			end
		end
		if oldest then
			oldest:Destroy()
		end
	end
	task.delay(5, function()
		if toast.Parent then
			Lib.Tween(toast, { BackgroundTransparency = 1 }, 0.4)
			task.wait(0.4)
			toast:Destroy()
		end
	end)
end

------------------------------------------------------------------ requests

function UIController:Request(action: string, payload: any?, quiet: boolean?): any
	local reply = Net.Request(action, payload)
	if reply.Msg and not quiet then
		self:Notify(reply.Msg, reply.Ok and "Good" or "Warning")
	elseif not reply.Ok and self.Ctx and self.Ctx.Sound then
		self.Ctx.Sound:Play("error")
	end
	if reply.Ok and self.Ctx and self.Ctx.Sound and not quiet then
		self.Ctx.Sound:Play("purchase")
	end
	return reply
end

------------------------------------------------------------------ panels

function UIController:Register(name: string, factory: (any) -> any)
	local ok, panel = pcall(factory, self.Ctx)
	if not ok then
		warn("[UI] panel " .. name .. " failed to build: " .. tostring(panel))
		return
	end
	panel.Name = name
	self.Panels[name] = panel
	local win = panel.Window
	if win then
		win.Frame.Parent = self.Root
		win.CloseButton.Activated:Connect(function()
			self:Close()
		end)
	end
end

function UIController:Open(name: string)
	local panel = self.Panels[name]
	if not panel then
		return
	end
	if self.Current and self.Current ~= name then
		self:Close(true)
	end
	self.Current = name
	local frame = panel.Window.Frame
	frame.Visible = true
	local scale = frame:FindFirstChild("OpenScale") or Lib.Create("UIScale", { Name = "OpenScale", Parent = frame })
	scale.Scale = 0.92
	Lib.Tween(scale, { Scale = 1 }, 0.18, Enum.EasingStyle.Back)
	if blur then
		Lib.Tween(blur, { Size = 10 }, 0.2)
	end
	if self.Ctx.Sound then
		self.Ctx.Sound:Play("open_panel")
	end
	local ok, err = pcall(function()
		if panel.Open then
			panel:Open()
		end
	end)
	if not ok then
		warn("[UI] " .. name .. ":Open error " .. tostring(err))
	end
end

function UIController:Close(silent: boolean?)
	local name = self.Current
	if not name then
		return
	end
	local panel = self.Panels[name]
	self.Current = nil
	if panel then
		panel.Window.Frame.Visible = false
		if panel.Close then
			pcall(panel.Close, panel)
		end
	end
	if blur and not silent then
		Lib.Tween(blur, { Size = 0 }, 0.2)
	end
end

function UIController:Toggle(name: string)
	if self.Current == name then
		self:Close()
	else
		self:Open(name)
	end
end

function UIController:Refresh(name: string?)
	if name then
		local p = self.Panels[name]
		if p and p.Refresh and self.Current == name then
			p:Refresh()
		end
	elseif self.Current then
		local p = self.Panels[self.Current]
		if p and p.Refresh then
			p:Refresh()
		end
	end
end

------------------------------------------------------------------ reward popups

local popupQueue = {}
local popupBusy = false

local function showPopup(info)
	local root = UIController.Root
	local color = info.Color or C.Accent
	local frame = Lib.Create("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.32),
		Size = UDim2.fromOffset(460, info.Model and 300 or 170),
		BackgroundColor3 = C.Panel,
		BackgroundTransparency = 0.04,
		Corner = 18,
		Stroke = { Color = color, Thickness = 3 },
		ZIndex = 40,
		Parent = root,
	})
	local scale = Lib.Create("UIScale", { Scale = 0.3, Parent = frame })
	Lib.Label(info.Title or "", { Size = UDim2.new(1, -30, 0, 40), Position = UDim2.fromOffset(15, 12), Font = Theme.FontBlack, TextSize = 30, TextColor3 = color, TextXAlignment = Enum.TextXAlignment.Center, ZIndex = 41, Parent = frame })
	if info.Model then
		local holder = Lib.Create("Frame", { Size = UDim2.fromOffset(180, 140), Position = UDim2.new(0.5, -90, 0, 56), BackgroundTransparency = 1, ZIndex = 41, Parent = frame })
		local vf = Viewport.Render(holder, info.Model[1], info.Model[2])
		vf.ZIndex = 41
	end
	Lib.Label(info.Text or "", { Size = UDim2.new(1, -30, 0, 70), Position = UDim2.new(0, 15, 1, -86), TextSize = 19, TextXAlignment = Enum.TextXAlignment.Center, ZIndex = 41, Parent = frame })
	Lib.Tween(scale, { Scale = 1 }, 0.35, Enum.EasingStyle.Back)
	if UIController.Ctx.Sound then
		UIController.Ctx.Sound:Play(info.Sound or "level_up")
	end
	if UIController.Ctx.FX and info.Burst then
		UIController.Ctx.FX:ScreenBurst(color)
	end
	task.wait(info.Duration or 2.6)
	Lib.Tween(scale, { Scale = 0.2 }, 0.2)
	task.wait(0.2)
	frame:Destroy()
end

function UIController:Popup(info)
	table.insert(popupQueue, info)
	if popupBusy then
		return
	end
	popupBusy = true
	task.spawn(function()
		while #popupQueue > 0 do
			local nextInfo = table.remove(popupQueue, 1)
			pcall(showPopup, nextInfo)
		end
		popupBusy = false
	end)
end

local function onReward(r)
	local kind = r.Kind
	if kind == "LevelUp" then
		UIController:Popup({ Title = "LEVEL " .. r.Level .. "!", Text = string.format("+%d Gems. New gear may be unlocked!", r.Gems), Color = C.Xp, Burst = true })
	elseif kind == "Crate" then
		local res = r.Result
		local rar = Rarity.Get(res.Rarity or "Common")
		local model = nil
		if res.Type == "Tool" or res.Type == "EventTool" then
			model = { "Tool", res.Id }
		elseif res.Type == "Container" or res.Type == "EventContainer" then
			model = { "Container", res.Id }
		elseif res.Type == "Robot" then
			model = { "Robot", res.Id }
		end
		UIController:Popup({ Title = string.upper(rar.Name) .. "!", Text = res.Label or "", Color = rar.Color, Model = model, Sound = "crate_reveal", Burst = rar.Order >= 4, Duration = 3.2 })
	elseif kind == "Sector" then
		UIController:Popup({ Title = "SECTOR " .. r.Number .. " CLEAN!", Text = string.format("%s - your share %d%%\n+%s%s", r.Zone, math.floor(r.Share * 100), Format.Credits(r.Credits), r.Gems > 0 and ("  +" .. r.Gems .. " Gem") or ""), Color = C.Good, Sound = "sector_clear", Duration = 2.2 })
	elseif kind == "Achievement" then
		UIController:Popup({ Title = "ACHIEVEMENT", Text = string.format("%s\n+%d Gems%s", r.Name, r.Gems, r.Title and ("  • Title unlocked: " .. r.Title) or ""), Color = C.Credit, Burst = true })
	elseif kind == "Secret" then
		UIController:Popup({ Title = "RELIC FOUND!", Text = string.format("%s (%d/10)\n+%d Gems  +%s", r.Name, r.Count, r.Gems, Format.Credits(r.Credits)), Color = Color3.fromRGB(255, 200, 90), Sound = "secret", Burst = true, Duration = 3.2 })
	elseif kind == "Zone" then
		UIController:Popup({ Title = "ZONE UNLOCKED", Text = r.Name, Color = C.Accent, Burst = true })
	elseif kind == "Rebirth" then
		UIController:Popup({ Title = "RE-LAUNCH #" .. r.Rebirths, Text = string.format("+%d Cosmic Stars. Permanent bonuses applied!", r.Stars), Color = C.Star, Burst = true, Duration = 3.5 })
	elseif kind == "Login" then
		UIController:Popup({ Title = "DAY " .. r.Day .. " REWARD", Text = r.Label, Color = C.Gem, Sound = "cash" })
	elseif kind == "Deposit" then
		if UIController.Ctx.Sound then
			UIController.Ctx.Sound:Play("cash")
		end
		if UIController.Ctx.FX then
			UIController.Ctx.FX:FloatingText("+" .. Format.Credits(r.Credits), C.Credit, true)
		end
	elseif kind == "Capsule" then
		if UIController.Ctx.Sound then
			UIController.Ctx.Sound:Play("capsule_pack")
		end
		UIController:Notify(string.format("%sPacked a %s capsule", r.Auto and "Auto-" or "", Format.Kg(r.Kg)), "Good", "🛢")
	end
end

------------------------------------------------------------------ setup

local function updateScale(scale: UIScale)
	local cam = Workspace.CurrentCamera
	if not cam then
		return
	end
	local v = cam.ViewportSize
	local base = math.clamp(math.min(v.X / 1280, v.Y / 760), 0.5, 1.2)
	local setting = 1
	local data = UIController.Ctx and UIController.Ctx.Data
	if data and data.Profile then
		setting = data.Profile.Settings.UiScale or 1
	end
	scale.Scale = base * math.clamp(setting, 0.6, 1.4)
end

function UIController:Init(ctx)
	self.Ctx = ctx
	local gui = Instance.new("ScreenGui")
	gui.Name = "LunarSweepUI"
	gui.ResetOnSpawn = false
	gui.IgnoreGuiInset = true
	gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	gui.DisplayOrder = 5
	gui.Parent = player:WaitForChild("PlayerGui")
	self.Root = gui
	ctx.Root = gui
	local scale = Instance.new("UIScale")
	scale.Parent = gui
	updateScale(scale)
	Workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(function()
		updateScale(scale)
	end)
	ctx.Data.Changed:Connect(function(key)
		if key == "Settings" or key == "*" then
			updateScale(scale)
		end
	end)
	toastHolder = Lib.Create("Frame", {
		Name = "Toasts",
		AnchorPoint = Vector2.new(1, 0),
		Position = UDim2.new(1, -16, 0, 120),
		Size = UDim2.fromOffset(380, 500),
		BackgroundTransparency = 1,
		List = { Padding = 8, HAlign = Enum.HorizontalAlignment.Right },
		ZIndex = 30,
		Parent = gui,
	})
	blur = Lighting:FindFirstChild("UIBlur") or Instance.new("BlurEffect")
	blur.Name = "UIBlur"
	blur.Size = 0
	blur.Parent = Lighting
	Lib.ClickSound = function(name)
		if ctx.Sound then
			ctx.Sound:Play(name)
		end
	end
	Net.Event("Notify").OnClientEvent:Connect(function(n)
		self:Notify(n.Text, n.Kind, n.Icon)
	end)
	Net.Event("Reward").OnClientEvent:Connect(onReward)
	Net.Event("OpenPanel").OnClientEvent:Connect(function(name)
		self:Open(name)
	end)
	UserInputService.InputBegan:Connect(function(input, processed)
		if input.KeyCode == Enum.KeyCode.Escape or input.KeyCode == Enum.KeyCode.ButtonB then
			if self.Current then
				self:Close()
			end
		end
		if processed then
			return
		end
		local binds = {
			[Enum.KeyCode.M] = "Map",
			[Enum.KeyCode.B] = "Base",
			[Enum.KeyCode.U] = "Upgrades",
			[Enum.KeyCode.I] = "Inventory",
			[Enum.KeyCode.J] = "Missions",
			[Enum.KeyCode.R] = nil,
		}
		local target = binds[input.KeyCode]
		if target and not (ctx.Build and ctx.Build.Active) then
			self:Toggle(target)
		end
	end)
	local _ = GuiService
	local __ = Formulas
end

return UIController
