--!nonstrict
-- Shared panel building blocks: item cards with 3D previews, detail panes and
-- stat comparison rows.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Rarity = require(Shared.Config.Rarity)
local Format = require(Shared.Util.Format)

local UI = script.Parent.Parent
local Lib = require(UI.Lib)
local Theme = require(UI.Theme)
local Viewport = require(UI.Viewport)

local C = Theme.Colors

local Common = {}

export type CardSpec = {
	Kind: string,
	Id: string,
	Name: string,
	Rarity: string,
	Sub: string?,
	Badge: string?,
	BadgeColor: Color3?,
	Order: number?,
	OnSelect: (() -> ())?,
	Dim: boolean?,
}

function Common.Card(parent: Instance, spec: CardSpec): TextButton
	local rar = Rarity.Get(spec.Rarity)
	local card = Lib.Create("TextButton", {
		Text = "",
		AutoButtonColor = false,
		BackgroundColor3 = C.PanelLight,
		Corner = 10,
		Stroke = { Color = rar.Color, Thickness = 1.5, Transparency = 0.35 },
		LayoutOrder = spec.Order or 0,
		Parent = parent,
	})
	local glow = Lib.Create("Frame", { Size = UDim2.new(1, 0, 0.62, 0), BackgroundColor3 = rar.Color, BackgroundTransparency = 0.86, Corner = 10, Parent = card })
	local holder = Lib.Create("Frame", { Size = UDim2.new(1, -8, 0.6, 0), Position = UDim2.fromOffset(4, 4), BackgroundTransparency = 1, Parent = card })
	task.defer(function()
		Viewport.Render(holder, spec.Kind, spec.Id)
	end)
	Lib.Label(spec.Name, { Size = UDim2.new(1, -10, 0, 20), Position = UDim2.new(0, 6, 0.62, 2), TextSize = 15, Font = Theme.FontBlack, TextColor3 = rar.Color, TextTruncate = Enum.TextTruncate.AtEnd, TextWrapped = false, Parent = card })
	Lib.Label(spec.Sub or rar.Name, { Name = "Sub", Size = UDim2.new(1, -10, 0, 30), Position = UDim2.new(0, 6, 0.62, 22), TextSize = 13, TextColor3 = C.SubText, Font = Theme.FontMedium, TextYAlignment = Enum.TextYAlignment.Top, Parent = card })
	if spec.Badge then
		local badge = Lib.Create("TextLabel", {
			Text = spec.Badge,
			Font = Theme.FontBlack,
			TextSize = 11,
			TextColor3 = C.Text,
			BackgroundColor3 = spec.BadgeColor or C.Accent,
			Size = UDim2.fromOffset(78, 18),
			Position = UDim2.new(1, -82, 0, 4),
			Corner = 5,
			ZIndex = 3,
			Parent = card,
		})
		local _ = badge
	end
	if spec.Dim then
		card.BackgroundTransparency = 0.4
		glow.BackgroundTransparency = 0.95
	end
	card.MouseEnter:Connect(function()
		Lib.Tween(card, { BackgroundColor3 = C.PanelLighter }, 0.1)
	end)
	card.MouseLeave:Connect(function()
		Lib.Tween(card, { BackgroundColor3 = C.PanelLight }, 0.1)
	end)
	if spec.OnSelect then
		card.Activated:Connect(function()
			if Lib.ClickSound then
				Lib.ClickSound("click")
			end
			spec.OnSelect()
		end)
	end
	return card
end

-- Detail pane on the right side of catalog panels
function Common.DetailPane(parent: Instance): any
	local pane = Lib.Create("Frame", { Size = UDim2.new(0.36, 0, 1, 0), Position = UDim2.fromScale(0.64, 0), BackgroundColor3 = C.PanelLight, Corner = 12, Parent = parent })
	local preview = Lib.Create("Frame", { Size = UDim2.new(1, -16, 0, 150), Position = UDim2.fromOffset(8, 8), BackgroundColor3 = Color3.fromRGB(28, 31, 38), Corner = 10, Parent = pane })
	local name = Lib.Label("", { Size = UDim2.new(1, -20, 0, 26), Position = UDim2.fromOffset(10, 164), TextSize = 20, Font = Theme.FontBlack, Parent = pane })
	local desc = Lib.Label("", { Size = UDim2.new(1, -20, 0, 40), Position = UDim2.fromOffset(10, 190), TextSize = 13, TextColor3 = C.SubText, Font = Theme.FontMedium, TextYAlignment = Enum.TextYAlignment.Top, Parent = pane })
	local stats = Lib.Create("Frame", { Size = UDim2.new(1, -20, 0, 140), Position = UDim2.fromOffset(10, 234), BackgroundTransparency = 1, List = { Padding = 2 }, Parent = pane })
	local action = Lib.Button("", { Size = UDim2.new(1, -20, 0, 42), Position = UDim2.new(0, 10, 1, -52), TextSize = 18, Parent = pane })
	local obj = { Frame = pane, Preview = preview, Name = name, Desc = desc, Stats = stats, Action = action, Handler = nil :: (() -> ())? }
	action.Activated:Connect(function()
		if action:GetAttribute("Style") == "Disabled" then
			if Lib.ClickSound then
				Lib.ClickSound("error")
			end
			return
		end
		if Lib.ClickSound then
			Lib.ClickSound("click")
		end
		if obj.Handler then
			obj.Handler()
		end
	end)
	function obj:Show(kind: string, id: string, title: string, rarityId: string, description: string)
		Lib.Clear(preview)
		Viewport.Render(preview, kind, id, 25)
		name.Text = title
		name.TextColor3 = Rarity.Get(rarityId).Color
		desc.Text = description
		Lib.Clear(stats)
	end
	function obj:SetAction(text: string, style: string, handler: (() -> ())?)
		action.Text = text
		Lib.StyleButton(action, style)
		obj.Handler = handler
	end
	return obj
end

-- comparison row: name, new value, old value; higher is better unless lowerBetter
function Common.CompareRow(parent: Instance, label: string, new: number, old: number?, fmt: ((number) -> string)?, order: number?, lowerBetter: boolean?)
	local f = fmt or function(v)
		return Format.Number(v)
	end
	local text = f(new)
	local color = C.Text
	if old and math.abs(new - old) > 1e-6 then
		local better = (new > old) ~= (lowerBetter == true)
		color = better and C.Good or C.Bad
		local delta = new - old
		text = string.format("%s  (%s%s)", f(new), delta > 0 and "+" or "-", f(math.abs(delta)))
	end
	Lib.StatRow(parent, label, text, color, order)
end

return Common
