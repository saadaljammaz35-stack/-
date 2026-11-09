--!nonstrict
-- Admin / QA panel (Studio, place owner or AdminUserIds only - enforced on the server).

local UI = script.Parent.Parent
local Lib = require(UI.Lib)
local Theme = require(UI.Theme)

local C = Theme.Colors

local COMMANDS = {
	{ "credits", "1000000", "+1M credits" },
	{ "gems", "500", "+500 gems" },
	{ "stars", "10", "+10 stars" },
	{ "level", "50", "Level 50" },
	{ "zones", "", "Unlock all zones" },
	{ "upgrades", "", "Max upgrades" },
	{ "gear", "", "Unlock all gear" },
	{ "fill", "", "Fill container" },
	{ "robot", "dustbot_mk2", "Give robot" },
	{ "event", "MeteorShower", "Meteor shower" },
	{ "event", "DustStorm", "Dust storm" },
	{ "event", "SolarFlare", "Solar flare" },
	{ "event", "DebrisFrenzy", "Debris frenzy" },
	{ "season", "harvest_moon", "Force Harvest Moon" },
	{ "season", "frost_festival", "Force Frost Festival" },
	{ "tokens", "500", "+500 event tokens" },
	{ "regrow", "", "Regrow all dust" },
	{ "selftest", "", "Run self test" },
	{ "reset", "", "RESET my data" },
}

return function(ctx)
	local win = Lib.Window("Admin & QA Tools", UDim2.fromOffset(700, 520), C.Bad)
	local panel = { Window = win }
	local output = Lib.Label("Commands run on the server. Only admins can use them.", { Size = UDim2.new(1, 0, 0, 40), TextColor3 = C.SubText, Parent = win.Body })
	local grid = Lib.Scroll({ Size = UDim2.new(1, 0, 1, -50), Position = UDim2.fromOffset(0, 50), Parent = win.Body }, { Grid = { Cell = UDim2.fromOffset(210, 44), Pad = UDim2.fromOffset(8, 8) } })
	for i, c in COMMANDS do
		Lib.Button(c[3], { Style = c[1] == "reset" and "Danger" or "Secondary", TextSize = 14, LayoutOrder = i, Parent = grid }, function()
			local run = function()
				local reply = ctx.UI:Request("Admin", { Cmd = c[1], Arg = c[2] }, true)
				output.Text = (reply.Ok and "✓ " or "✗ ") .. tostring(reply.Msg)
				output.TextColor3 = reply.Ok and C.Good or C.Bad
			end
			if c[1] == "reset" then
				Lib.Confirm(ctx.Root, "Reset ALL of your progress?", run, "Reset")
			else
				run()
			end
		end)
	end
	return panel
end
