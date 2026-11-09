--!nonstrict
-- 7-day login reward loop. Missing more than one day resets the streak.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local Progression = require(Shared.Config.Progression)
local Net = require(Shared.Net)
local Registry = require(script.Parent.Registry)

local LoginRewardService = {}

local function today(): number
	return os.time() // 86400
end

function LoginRewardService:Update(player: Player, profile)
	local login = profile.Login
	local d = today()
	if login.LastDay == d then
		return
	end
	if login.LastDay == d - 1 then
		login.Streak += 1
	else
		login.Streak = 1
	end
	login.LastDay = d
	login.DayIndex = ((login.Streak - 1) % #Progression.LoginRewards) + 1
	login.Pending = true
	Registry.DataService:Mark(player, "Login")
	Registry.DataService:MaxStat(player, "LoginStreak", login.Streak)
end

function LoginRewardService:Claim(player: Player, profile): (boolean, string?)
	local login = profile.Login
	if not login.Pending then
		return false, "Already claimed today. Come back tomorrow!"
	end
	local reward = Progression.LoginRewards[login.DayIndex]
	login.Pending = false
	Registry.DataService:Mark(player, "Login")
	local label = reward.Label
	if reward.Type == "Credits" then
		local amount = math.floor(reward.Amount * Formulas.CrateCreditScale(Formulas.Tier(profile)))
		Registry.EconomyService:AddCredits(player, amount, true)
		label = Format.Credits(amount)
	elseif reward.Type == "Gems" then
		Registry.EconomyService:AddGems(player, reward.Amount)
	elseif reward.Type == "Boost" then
		Registry.EconomyService:AddBoost(player, reward.Id, reward.Minutes)
	elseif reward.Type == "Crate" then
		if reward.Amount then
			Registry.EconomyService:AddGems(player, reward.Amount)
		end
		profile.Crates.Free = profile.Crates.Free or {}
		profile.Crates.Free[reward.Id] = (profile.Crates.Free[reward.Id] or 0) + 1
		Registry.CrateService:Open(player, profile, reward.Id, true)
	end
	Net.Event("Reward"):FireClient(player, { Kind = "Login", Day = login.DayIndex, Label = label })
	return true, "Day " .. login.DayIndex .. " reward: " .. label
end

function LoginRewardService:Init() end

function LoginRewardService:Start()
	Registry.DataService.Loaded:Connect(function(player, profile)
		self:Update(player, profile)
	end)
	Registry.Router.Register("ClaimLogin", function(player, profile)
		self:Update(player, profile)
		return self:Claim(player, profile)
	end, 1, 2)
end

return LoginRewardService
