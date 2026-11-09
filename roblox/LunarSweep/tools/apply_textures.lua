-- Lunar Sweep - realistic ground textures (run ONCE in Roblox Studio, then save the place).
--
-- 1. Studio > View > Asset Manager > Bulk Import: upload the 8 images in assets/textures/
--    (dust/clean/rock/frost, each a _color and a _normal file).
-- 2. Right-click each uploaded image > Copy Asset ID and paste the numbers below.
-- 3. Studio > View > Command Bar: paste this whole file and press Enter.
-- 4. File > Save. The textures are now part of the place (MaterialService) and the game keeps
--    tinting them per zone. Run it again any time to change the IDs.
--
-- (Scripts can't set texture images at runtime, which is why this runs from the Command Bar.)

local IDS = {
	dust = { color = 0, normal = 0 }, -- powdery regolith (dirty ground)
	clean = { color = 0, normal = 0 }, -- swept, compacted ground (clean)
	rock = { color = 0, normal = 0 }, -- boulders, crater walls, cave rock
	frost = { color = 0, normal = 0 }, -- Frostbite Basin
}

-- terrain materials each texture replaces (matches Config/Zones.luau)
local MAP = {
	dust = { "Sand", "Ground", "Mud", "Sandstone", "Limestone", "Asphalt" },
	clean = { "Slate", "Salt", "Concrete" },
	rock = { "Rock", "Basalt" },
	frost = { "Snow", "Glacier" },
}

local TILE = { dust = 20, clean = 20, rock = 28, frost = 20 }

local MaterialService = game:GetService("MaterialService")
local made = 0
for key, mats in MAP do
	local ids = IDS[key]
	if ids and ids.color ~= 0 then
		for _, matName in mats do
			local name = "Lunar_" .. matName
			local v = MaterialService:FindFirstChild(name) or Instance.new("MaterialVariant")
			v.Name = name
			v.BaseMaterial = Enum.Material[matName]
			v.StudsPerTile = TILE[key]
			v.MaterialPattern = Enum.MaterialPattern.Organic
			v.ColorMap = "rbxassetid://" .. ids.color
			if ids.normal ~= 0 then
				v.NormalMap = "rbxassetid://" .. ids.normal
			end
			v.Parent = MaterialService
			MaterialService:SetBaseMaterialOverride(Enum.Material[matName], name)
			made += 1
		end
	end
end
print(string.format("[Lunar Sweep] %d terrain materials now use the lunar textures. Save the place!", made))
