--!nonstrict
-- Client-side ProximityPrompt handling: prompts tagged with a Panel attribute open UI;
-- prompts owned by someone else (capsules, other bases) are hidden; relic prompts show
-- whether you already found them.

local Players = game:GetService("Players")
local ProximityPromptService = game:GetService("ProximityPromptService")

local player = Players.LocalPlayer

local PromptController = {}

local ctx

function PromptController:Init(c)
	ctx = c
end

function PromptController:Start()
	ProximityPromptService.PromptTriggered:Connect(function(prompt)
		local panel = prompt:GetAttribute("Panel")
		if panel then
			local owner = prompt:GetAttribute("Owner")
			if owner and owner ~= player.UserId then
				return
			end
			ctx.UI:Open(panel)
		end
	end)
	ProximityPromptService.PromptShown:Connect(function(prompt)
		local owner = prompt:GetAttribute("Owner")
		if owner and owner ~= player.UserId then
			prompt.Enabled = false
		end
		local secret = prompt:GetAttribute("SecretId")
		local profile = ctx.Data.Profile
		if secret and profile then
			prompt.ActionText = profile.Secrets[secret] and "Already found ✓" or "Inspect"
		end
	end)
end

return PromptController
