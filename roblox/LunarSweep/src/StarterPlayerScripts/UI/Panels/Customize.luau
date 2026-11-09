--!nonstrict
-- Suit locker: suit colour, visor colour, helmet/suit toggles.

local UI = script.Parent.Parent
local Lib = require(UI.Lib)
local Theme = require(UI.Theme)

local C = Theme.Colors

local SUITS = {
	Color3.fromRGB(236, 238, 242),
	Color3.fromRGB(255, 140, 40),
	Color3.fromRGB(70, 140, 255),
	Color3.fromRGB(60, 200, 110),
	Color3.fromRGB(230, 70, 70),
	Color3.fromRGB(180, 100, 255),
	Color3.fromRGB(40, 42, 50),
	Color3.fromRGB(255, 210, 60),
}
local VISORS = {
	Color3.fromRGB(255, 190, 60),
	Color3.fromRGB(120, 200, 255),
	Color3.fromRGB(255, 100, 180),
	Color3.fromRGB(120, 255, 170),
	Color3.fromRGB(30, 30, 40),
	Color3.fromRGB(255, 255, 255),
}

return function(ctx)
	local Data = ctx.Data
	local win = Lib.Window("Suit Locker", UDim2.fromOffset(620, 470))
	local panel = { Window = win }
	local body = Lib.Frame({ BackgroundTransparency = 1, List = { Padding = 12 }, Parent = win.Body })

	local function swatches(label: string, colors: { Color3 }, current: number, key: string, order: number)
		Lib.Label(label, { TextSize = 16, Font = Theme.FontBlack, LayoutOrder = order, Parent = body })
		local row = Lib.Frame({ Size = UDim2.new(1, 0, 0, 56), BackgroundTransparency = 1, List = { Horizontal = true, Padding = 8 }, LayoutOrder = order + 1, Parent = body })
		for i, c in colors do
			local b = Lib.Create("TextButton", { Text = i == current and "✓" or "", TextSize = 22, Font = Theme.FontBlack, TextColor3 = Color3.new(0, 0, 0), Size = UDim2.fromOffset(52, 52), BackgroundColor3 = c, Corner = 26, AutoButtonColor = true, LayoutOrder = i, Stroke = { Color = i == current and C.Accent or C.Stroke, Thickness = i == current and 3 or 1 }, Parent = row })
			b.Activated:Connect(function()
				ctx.UI:Request("SetCosmetics", { [key] = i }, true)
			end)
		end
	end

	local function rebuild()
		local p = Data.Profile
		if not p then
			return
		end
		Lib.Clear(body)
		local cos = p.Cosmetics
		swatches("SUIT COLOUR", SUITS, cos.Suit, "Suit", 1)
		swatches("VISOR TINT", VISORS, cos.Visor, "Visor", 3)
		local toggles = Lib.Frame({ Size = UDim2.new(1, 0, 0, 50), BackgroundTransparency = 1, List = { Horizontal = true, Padding = 10 }, LayoutOrder = 5, Parent = body })
		Lib.Button(cos.Helmet and "Helmet: ON" or "Helmet: OFF", { Size = UDim2.fromOffset(200, 44), Style = cos.Helmet and "Good" or "Secondary", Parent = toggles }, function()
			ctx.UI:Request("SetCosmetics", { Helmet = not cos.Helmet }, true)
		end)
		Lib.Button(cos.SuitOn and "Space suit: ON" or "Space suit: OFF", { Size = UDim2.fromOffset(200, 44), Style = cos.SuitOn and "Good" or "Secondary", Parent = toggles }, function()
			ctx.UI:Request("SetCosmetics", { SuitOn = not cos.SuitOn }, true)
		end)
		Lib.Label("Turning the suit off shows your normal avatar clothes after you respawn.", { TextSize = 13, TextColor3 = C.SubText, LayoutOrder = 6, Parent = body })
	end
	Data.Changed:Connect(function(key)
		if ctx.UI.Current == "Customize" and key == "Cosmetics" then
			rebuild()
		end
	end)
	function panel:Open()
		rebuild()
	end
	return panel
end
