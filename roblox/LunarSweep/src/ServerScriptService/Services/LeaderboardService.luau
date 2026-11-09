--!nonstrict
-- Global leaderboards (OrderedDataStore) + in-server ranking, shown on the hub boards and
-- in the Leaderboards panel. Falls back to server-only rankings when DataStores are off.

local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local Format = require(Shared.Util.Format)
local Registry = require(script.Parent.Registry)

local LeaderboardService = {}

local BOARDS = {
	Kg = { Store = "LB_Kg_v1", Stat = "KgCollected", Scale = 100, Title = "Top Cleaners" },
	Earned = { Store = "LB_Earned_v1", Stat = "CreditsEarned", Scale = 1, Title = "Top Earners" },
	Sectors = { Store = "LB_Sectors_v1", Stat = "SectorsCleared", Scale = 1, Title = "Sectors Cleared" },
	Rebirths = { Store = "LB_Rebirths_v1", Stat = "Rebirths", Scale = 1, Title = "Most Re-Launches" },
}

local stores: { [string]: OrderedDataStore } = {}
local cache: { [string]: { { UserId: number, Name: string, Value: number } } } = {}
local names: { [number]: string } = {}
local lastWrite: { [Player]: number } = {}

local function nameOf(userId: number): string
	if names[userId] then
		return names[userId]
	end
	local p = Players:GetPlayerByUserId(userId)
	if p then
		names[userId] = p.DisplayName
		return p.DisplayName
	end
	local ok, n = pcall(function()
		return Players:GetNameFromUserIdAsync(userId)
	end)
	names[userId] = ok and n or ("User " .. userId)
	return names[userId]
end

local function statValue(profile, key: string): number
	local b = BOARDS[key]
	if key == "Rebirths" then
		return profile.Rebirths or 0
	end
	return math.floor((profile.Stats[b.Stat] or 0) * b.Scale)
end

local function serverBoard(key: string)
	local list = {}
	for _, p in Players:GetPlayers() do
		local profile = Registry.DataService:Get(p)
		if profile then
			table.insert(list, { UserId = p.UserId, Name = p.DisplayName, Value = statValue(profile, key) / BOARDS[key].Scale })
		end
	end
	table.sort(list, function(a, b)
		return a.Value > b.Value
	end)
	return list
end

local function refresh()
	for key, b in BOARDS do
		local store = stores[key]
		if store then
			local ok, pages = pcall(function()
				return store:GetSortedAsync(false, GameConfig.LeaderboardSize)
			end)
			if ok and pages then
				local list = {}
				for _, entry in pages:GetCurrentPage() do
					local uid = tonumber(string.match(entry.key, "%d+"))
					if uid then
						table.insert(list, { UserId = uid, Name = nameOf(uid), Value = entry.value / b.Scale })
					end
				end
				cache[key] = list
			end
		else
			cache[key] = serverBoard(key)
		end
	end
end

local function write(player: Player)
	local profile = Registry.DataService:Get(player)
	if not profile then
		return
	end
	for key in BOARDS do
		local store = stores[key]
		if store then
			local value = statValue(profile, key)
			if value > 0 then
				pcall(function()
					store:SetAsync("u_" .. player.UserId, value)
				end)
			end
		end
	end
end

local function renderBoards()
	local boards = Registry.HubBuilder and Registry.HubBuilder.Boards or {}
	for key, gui in boards do
		local list = cache[key] or {}
		local frame = gui:FindFirstChild("List")
		if not frame then
			frame = Instance.new("Frame")
			frame.Name = "List"
			frame.Size = UDim2.fromScale(1, 1)
			frame.BackgroundColor3 = Color3.fromRGB(22, 25, 31)
			frame.Parent = gui
			local layout = Instance.new("UIListLayout")
			layout.Padding = UDim.new(0, 4)
			layout.Parent = frame
			local pad = Instance.new("UIPadding")
			pad.PaddingTop = UDim.new(0, 10)
			pad.PaddingLeft = UDim.new(0, 12)
			pad.PaddingRight = UDim.new(0, 12)
			pad.Parent = frame
		end
		for _, c in frame:GetChildren() do
			if c:IsA("TextLabel") then
				c:Destroy()
			end
		end
		local title = Instance.new("TextLabel")
		title.Size = UDim2.new(1, 0, 0, 44)
		title.BackgroundTransparency = 1
		title.Font = Enum.Font.BuilderSansExtraBold
		title.TextColor3 = Color3.fromRGB(255, 122, 26)
		title.TextScaled = true
		title.Text = gui:GetAttribute("Title") or key
		title.LayoutOrder = 0
		title.Parent = frame
		for i = 1, math.min(12, #list) do
			local e = list[i]
			local row = Instance.new("TextLabel")
			row.Size = UDim2.new(1, 0, 0, 32)
			row.BackgroundTransparency = 1
			row.Font = Enum.Font.BuilderSansBold
			row.TextColor3 = i <= 3 and Color3.fromRGB(255, 220, 120) or Color3.fromRGB(230, 232, 238)
			row.TextXAlignment = Enum.TextXAlignment.Left
			row.TextScaled = true
			row.Text = string.format("%d. %s  —  %s", i, e.Name, Format.Number(e.Value))
			row.LayoutOrder = i
			row.Parent = frame
		end
	end
end

function LeaderboardService:Init()
	if Registry.DataService.UsingMemory then
		return
	end
	for key, b in BOARDS do
		local ok, store = pcall(function()
			return DataStoreService:GetOrderedDataStore(b.Store)
		end)
		if ok then
			stores[key] = store
		end
	end
end

function LeaderboardService:Start()
	Registry.Router.Register("GetLeaderboards", function()
		local out = { Global = cache, Server = {} }
		for key in BOARDS do
			out.Server[key] = serverBoard(key)
		end
		out.Titles = {}
		for key, b in BOARDS do
			out.Titles[key] = b.Title
		end
		return true, nil, out
	end, 1, 3)
	Registry.DataService.Releasing:Connect(function(player)
		write(player)
		lastWrite[player] = nil
	end)
	task.spawn(function()
		Registry.WorldService:WaitReady()
		while true do
			if Registry.DataService.UsingMemory then
				table.clear(stores)
			end
			for _, p in Players:GetPlayers() do
				if os.clock() - (lastWrite[p] or 0) > 120 then
					lastWrite[p] = os.clock()
					write(p)
				end
			end
			refresh()
			pcall(renderBoards)
			task.wait(GameConfig.LeaderboardRefresh)
		end
	end)
end

return LeaderboardService
