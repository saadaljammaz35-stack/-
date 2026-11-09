--!nonstrict
-- Small declarative UI toolkit used by every panel: instance builder with layout
-- shorthands, styled buttons with hover/press feedback, windows, tabs, bars, lists.

local TweenService = game:GetService("TweenService")

local Theme = require(script.Parent.Theme)
local C = Theme.Colors

local Lib = {}

Lib.ClickSound = nil :: ((string) -> ())?

local function apply(inst: Instance, props: { [string]: any })
	for k, v in props do
		if k == "Children" or k == "Parent" then
			continue
		elseif k == "Corner" then
			local c = Instance.new("UICorner")
			c.CornerRadius = typeof(v) == "UDim" and v or UDim.new(0, v == true and Theme.Corner or v)
			c.Parent = inst
		elseif k == "Stroke" then
			local s = Instance.new("UIStroke")
			s.Color = v.Color or C.Stroke
			s.Thickness = v.Thickness or 1.5
			s.Transparency = v.Transparency or 0
			s.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
			s.Parent = inst
		elseif k == "Padding" then
			local p = Instance.new("UIPadding")
			if type(v) == "number" then
				p.PaddingLeft, p.PaddingRight, p.PaddingTop, p.PaddingBottom = UDim.new(0, v), UDim.new(0, v), UDim.new(0, v), UDim.new(0, v)
			else
				p.PaddingLeft = UDim.new(0, v[1] or 0)
				p.PaddingRight = UDim.new(0, v[2] or 0)
				p.PaddingTop = UDim.new(0, v[3] or 0)
				p.PaddingBottom = UDim.new(0, v[4] or 0)
			end
			p.Parent = inst
		elseif k == "List" then
			local l = Instance.new("UIListLayout")
			l.Padding = UDim.new(0, v.Padding or 6)
			l.FillDirection = v.Horizontal and Enum.FillDirection.Horizontal or Enum.FillDirection.Vertical
			l.SortOrder = Enum.SortOrder.LayoutOrder
			if v.HAlign then
				l.HorizontalAlignment = v.HAlign
			end
			if v.VAlign then
				l.VerticalAlignment = v.VAlign
			end
			if v.Wraps then
				l.Wraps = true
			end
			l.Parent = inst
		elseif k == "Grid" then
			local g = Instance.new("UIGridLayout")
			g.CellSize = v.Cell or UDim2.fromOffset(150, 190)
			g.CellPadding = v.Pad or UDim2.fromOffset(8, 8)
			g.SortOrder = Enum.SortOrder.LayoutOrder
			g.Parent = inst
		elseif k == "Gradient" then
			local g = Instance.new("UIGradient")
			g.Color = v
			g.Rotation = 90
			g.Parent = inst
		elseif k == "Aspect" then
			local a = Instance.new("UIAspectRatioConstraint")
			a.AspectRatio = v
			a.Parent = inst
		elseif k == "MaxText" then
			local t = Instance.new("UITextSizeConstraint")
			t.MaxTextSize = v
			t.Parent = inst
		else
			(inst :: any)[k] = v
		end
	end
end

function Lib.Create(class: string, props: { [string]: any }?, children: { Instance }?): any
	local inst = Instance.new(class)
	if inst:IsA("GuiObject") then
		(inst :: GuiObject).BorderSizePixel = 0
	end
	if props then
		apply(inst, props)
	end
	for _, c in children or (props and props.Children) or {} do
		c.Parent = inst
	end
	if props and props.Parent then
		inst.Parent = props.Parent
	end
	return inst
end

function Lib.Tween(obj: Instance, props: { [string]: any }, t: number?, style: Enum.EasingStyle?, dir: Enum.EasingDirection?): Tween
	local tw = TweenService:Create(obj, TweenInfo.new(t or 0.2, style or Enum.EasingStyle.Quad, dir or Enum.EasingDirection.Out), props)
	tw:Play()
	return tw
end

function Lib.Label(text: string, props: { [string]: any }?): TextLabel
	local p = {
		Text = text,
		BackgroundTransparency = 1,
		Font = Theme.FontBold,
		TextColor3 = C.Text,
		TextSize = 16,
		TextXAlignment = Enum.TextXAlignment.Left,
		TextWrapped = true,
		Size = UDim2.new(1, 0, 0, 22),
	}
	for k, v in (props or {}) :: { [string]: any } do
		p[k] = v
	end
	return Lib.Create("TextLabel", p)
end

local STYLES = {
	Primary = { C.Accent, Color3.fromRGB(255, 150, 70), C.Text },
	Secondary = { C.PanelLighter, Color3.fromRGB(70, 76, 90), C.Text },
	Good = { Color3.fromRGB(46, 160, 90), Color3.fromRGB(60, 190, 110), C.Text },
	Danger = { Color3.fromRGB(190, 50, 50), Color3.fromRGB(220, 70, 70), C.Text },
	Disabled = { Color3.fromRGB(60, 64, 74), Color3.fromRGB(60, 64, 74), C.SubText },
	Ghost = { C.PanelLight, C.PanelLighter, C.Text },
}
Lib.Styles = STYLES

function Lib.StyleButton(btn: GuiButton, style: string)
	local s = STYLES[style] or STYLES.Primary
	btn.BackgroundColor3 = s[1]
	btn:SetAttribute("Base", s[1])
	btn:SetAttribute("Hover", s[2])
	if btn:IsA("TextButton") then
		(btn :: TextButton).TextColor3 = s[3]
	end
	btn:SetAttribute("Style", style)
end

function Lib.Button(text: string, props: { [string]: any }?, onClick: (() -> ())?): TextButton
	local p = {
		Text = text,
		Font = Theme.FontBold,
		TextSize = 16,
		AutoButtonColor = false,
		Size = UDim2.fromOffset(120, 36),
		Corner = Theme.CornerSmall,
		TextWrapped = true,
	}
	local style = "Primary"
	for k, v in (props or {}) :: { [string]: any } do
		if k == "Style" then
			style = v
		else
			p[k] = v
		end
	end
	local btn = Lib.Create("TextButton", p)
	Lib.StyleButton(btn, style)
	local scale = Instance.new("UIScale")
	scale.Parent = btn
	btn.MouseEnter:Connect(function()
		Lib.Tween(btn, { BackgroundColor3 = btn:GetAttribute("Hover") }, 0.12)
	end)
	btn.MouseLeave:Connect(function()
		Lib.Tween(btn, { BackgroundColor3 = btn:GetAttribute("Base") }, 0.12)
		Lib.Tween(scale, { Scale = 1 }, 0.1)
	end)
	btn.MouseButton1Down:Connect(function()
		Lib.Tween(scale, { Scale = 0.94 }, 0.06)
	end)
	btn.MouseButton1Up:Connect(function()
		Lib.Tween(scale, { Scale = 1 }, 0.1)
	end)
	if onClick then
		btn.Activated:Connect(function()
			if btn:GetAttribute("Style") == "Disabled" then
				if Lib.ClickSound then
					Lib.ClickSound("error")
				end
				return
			end
			if Lib.ClickSound then
				Lib.ClickSound("click")
			end
			onClick()
		end)
	end
	return btn
end

function Lib.Frame(props: { [string]: any }?): Frame
	local p = { BackgroundColor3 = C.PanelLight, Size = UDim2.fromScale(1, 1) }
	for k, v in (props or {}) :: { [string]: any } do
		p[k] = v
	end
	return Lib.Create("Frame", p)
end

-- Progress bar: returns frame with :Set(frac, text)
function Lib.Bar(props: { [string]: any }?, color: Color3?): any
	local p = { BackgroundColor3 = Color3.fromRGB(16, 18, 22), Size = UDim2.new(1, 0, 0, 14), Corner = 7 }
	for k, v in (props or {}) :: { [string]: any } do
		p[k] = v
	end
	local frame = Lib.Create("Frame", p)
	local fill = Lib.Create("Frame", { Name = "Fill", BackgroundColor3 = color or C.Accent, Size = UDim2.fromScale(0, 1), Corner = 7, Parent = frame })
	local label = Lib.Label("", { Name = "Text", Size = UDim2.fromScale(1, 1), TextXAlignment = Enum.TextXAlignment.Center, TextSize = 12, ZIndex = 3, TextStrokeTransparency = 0.6, Parent = frame })
	local obj = { Frame = frame, Fill = fill, Label = label }
	function obj:Set(frac: number, text: string?)
		frac = math.clamp(frac ~= frac and 0 or frac, 0, 1)
		Lib.Tween(fill, { Size = UDim2.fromScale(frac, 1) }, 0.25)
		label.Text = text or ""
	end
	function obj:Color(c: Color3)
		fill.BackgroundColor3 = c
	end
	return obj
end

function Lib.Scroll(props: { [string]: any }?, layout: { [string]: any }?): ScrollingFrame
	local p = {
		BackgroundTransparency = 1,
		Size = UDim2.fromScale(1, 1),
		ScrollBarThickness = 6,
		ScrollBarImageColor3 = C.Accent,
		CanvasSize = UDim2.new(),
		AutomaticCanvasSize = Enum.AutomaticSize.Y,
		ScrollingDirection = Enum.ScrollingDirection.Y,
		BorderSizePixel = 0,
	}
	for k, v in (props or {}) :: { [string]: any } do
		p[k] = v
	end
	if layout and layout.Grid then
		p.Grid = layout.Grid
	else
		p.List = layout or { Padding = 6 }
	end
	return Lib.Create("ScrollingFrame", p)
end

function Lib.Clear(container: Instance)
	for _, c in container:GetChildren() do
		if not c:IsA("UIListLayout") and not c:IsA("UIGridLayout") and not c:IsA("UIPadding") and not c:IsA("UICorner") and not c:IsA("UIStroke") then
			c:Destroy()
		end
	end
end

-- Modal window with header + close button
function Lib.Window(title: string, size: UDim2?, accent: Color3?): any
	local frame = Lib.Create("Frame", {
		Name = title,
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.52),
		Size = size or Theme.PanelSize,
		BackgroundColor3 = C.Panel,
		Corner = 14,
		Stroke = { Color = C.Stroke, Thickness = 2 },
		Visible = false,
		ZIndex = 5,
	})
	local header = Lib.Create("Frame", { Name = "Header", Size = UDim2.new(1, 0, 0, 52), BackgroundColor3 = C.PanelLight, Corner = 14, Parent = frame })
	Lib.Create("Frame", { Size = UDim2.new(1, 0, 0, 14), Position = UDim2.new(0, 0, 1, -14), BackgroundColor3 = C.PanelLight, Parent = header })
	-- hazard stripe accent (like a space-agency terminal)
	Lib.Create("Frame", { Size = UDim2.new(1, -28, 0, 3), Position = UDim2.new(0, 14, 1, -2), BackgroundColor3 = accent or C.Accent, Parent = header })
	local titleLabel = Lib.Label(string.upper(title), { Size = UDim2.new(1, -120, 1, 0), Position = UDim2.fromOffset(20, 0), Font = Theme.FontBlack, TextSize = 24, TextWrapped = false, Parent = header })
	local close = Lib.Button("✕", { Size = UDim2.fromOffset(40, 36), Position = UDim2.new(1, -50, 0, 8), Style = "Secondary", TextSize = 18, Parent = header })
	local body = Lib.Create("Frame", { Name = "Body", Size = UDim2.new(1, -24, 1, -68), Position = UDim2.fromOffset(12, 60), BackgroundTransparency = 1, Parent = frame })
	return { Frame = frame, Body = body, Header = header, Title = titleLabel, CloseButton = close }
end

-- Tab bar: returns { Select(name), Buttons, Current }
function Lib.Tabs(parent: Instance, names: { string }, onSelect: (string) -> (), props: { [string]: any }?): any
	local bar = Lib.Create("Frame", { Name = "Tabs", Size = UDim2.new(1, 0, 0, 36), BackgroundTransparency = 1, List = { Horizontal = true, Padding = 6 }, Parent = parent })
	for k, v in (props or {}) :: { [string]: any } do
		(bar :: any)[k] = v
	end
	local obj = { Buttons = {}, Current = nil, Bar = bar }
	function obj:Select(name: string)
		obj.Current = name
		for n, b in obj.Buttons do
			Lib.StyleButton(b, n == name and "Primary" or "Ghost")
		end
		onSelect(name)
	end
	for i, n in names do
		local b = Lib.Button(n, { Size = UDim2.fromOffset(math.max(90, #n * 10 + 24), 34), LayoutOrder = i, TextSize = 15, Parent = bar }, function()
			obj:Select(n)
		end)
		obj.Buttons[n] = b
	end
	return obj
end

function Lib.Pips(parent: Instance, level: number, max: number, color: Color3?): Frame
	local f = Lib.Create("Frame", { Size = UDim2.fromOffset(max * 16, 10), BackgroundTransparency = 1, List = { Horizontal = true, Padding = 4 }, Parent = parent })
	for i = 1, max do
		Lib.Create("Frame", { Size = UDim2.fromOffset(12, 10), BackgroundColor3 = i <= level and (color or C.Accent) or Color3.fromRGB(60, 64, 74), Corner = 3, LayoutOrder = i, Parent = f })
	end
	return f
end

-- Confirmation dialog
function Lib.Confirm(root: Instance, text: string, onYes: () -> (), yesText: string?)
	local shade = Lib.Create("TextButton", { Text = "", AutoButtonColor = false, Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.new(), BackgroundTransparency = 0.45, ZIndex = 50, Parent = root })
	local box = Lib.Create("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(420, 190), BackgroundColor3 = C.Panel, Corner = 14, Stroke = { Color = C.Accent, Thickness = 2 }, ZIndex = 51, Parent = shade })
	Lib.Label(text, { Size = UDim2.new(1, -40, 0, 100), Position = UDim2.fromOffset(20, 16), TextSize = 18, TextXAlignment = Enum.TextXAlignment.Center, ZIndex = 52, Parent = box })
	Lib.Button(yesText or "Confirm", { Size = UDim2.fromOffset(150, 40), Position = UDim2.new(0.5, -160, 1, -56), ZIndex = 52, Parent = box }, function()
		shade:Destroy()
		onYes()
	end)
	Lib.Button("Cancel", { Size = UDim2.fromOffset(150, 40), Position = UDim2.new(0.5, 10, 1, -56), Style = "Secondary", ZIndex = 52, Parent = box }, function()
		shade:Destroy()
	end)
end

-- Labelled stat row "Name ...... value"
function Lib.StatRow(parent: Instance, name: string, value: string, color: Color3?, order: number?): Frame
	local row = Lib.Create("Frame", { Size = UDim2.new(1, 0, 0, 22), BackgroundTransparency = 1, LayoutOrder = order or 0, Parent = parent })
	Lib.Label(name, { Size = UDim2.new(0.55, 0, 1, 0), TextColor3 = C.SubText, TextSize = 15, Font = Theme.FontMedium, Parent = row })
	Lib.Label(value, { Name = "Value", Size = UDim2.new(0.45, 0, 1, 0), Position = UDim2.fromScale(0.55, 0), TextXAlignment = Enum.TextXAlignment.Right, TextColor3 = color or C.Text, TextSize = 15, Parent = row })
	return row
end

return Lib
