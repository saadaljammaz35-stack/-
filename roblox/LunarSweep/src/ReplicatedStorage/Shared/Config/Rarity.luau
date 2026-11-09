--!strict
-- Rarity tiers used by tools, containers, robots, resources and crate rewards.

export type RarityDef = { Id: string, Name: string, Order: number, Color: Color3, Glow: Color3, DupeGems: number }

local list: { RarityDef } = {
	{ Id = "Common", Name = "Common", Order = 1, Color = Color3.fromRGB(190, 196, 206), Glow = Color3.fromRGB(150, 160, 175), DupeGems = 1 },
	{ Id = "Uncommon", Name = "Uncommon", Order = 2, Color = Color3.fromRGB(110, 220, 120), Glow = Color3.fromRGB(60, 200, 90), DupeGems = 2 },
	{ Id = "Rare", Name = "Rare", Order = 3, Color = Color3.fromRGB(80, 170, 255), Glow = Color3.fromRGB(40, 130, 255), DupeGems = 4 },
	{ Id = "Epic", Name = "Epic", Order = 4, Color = Color3.fromRGB(190, 110, 255), Glow = Color3.fromRGB(160, 60, 255), DupeGems = 12 },
	{ Id = "Legendary", Name = "Legendary", Order = 5, Color = Color3.fromRGB(255, 190, 60), Glow = Color3.fromRGB(255, 160, 20), DupeGems = 45 },
	{ Id = "Mythic", Name = "Mythic", Order = 6, Color = Color3.fromRGB(255, 80, 150), Glow = Color3.fromRGB(255, 40, 120), DupeGems = 150 },
}

local byId: { [string]: RarityDef } = {}
for _, r in list do
	byId[r.Id] = r
end

return {
	List = list,
	ById = byId,
	Get = function(id: string): RarityDef
		return byId[id] or list[1]
	end,
}
