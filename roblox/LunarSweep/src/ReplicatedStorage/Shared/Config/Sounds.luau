--!strict
-- Sound registry. The game's original synthesized sounds/music live in /assets/audio.
-- A sound plays when it has an id from either source (first match wins):
--   1. ReplicatedStorage.CustomSounds: a Sound named after the key (e.g. "click") - easiest:
--      import the .ogg files with Studio's Asset Manager, put the Sound objects in that folder.
--   2. AudioIds.luau - written automatically by tools/upload_assets.py (Open Cloud).
-- Without either, the game is silent (no built-in fallbacks: some accounts block
-- rbxasset sounds and Studio prints "Asset is not approved" errors).

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local AudioIds = require(script.Parent.AudioIds)

export type SoundDef = { Fallback: string, Volume: number, Pitch: number?, Looped: boolean?, Music: boolean? }

local defs: { [string]: SoundDef } = {
	-- ui
	click = { Fallback = "", Volume = 0.45 },
	hover = { Fallback = "", Volume = 0.15 },
	open_panel = { Fallback = "", Volume = 0.25, Pitch = 1.3 },
	error = { Fallback = "", Volume = 0.4, Pitch = 0.7 },
	notify = { Fallback = "", Volume = 0.35 },
	-- gameplay
	sweep = { Fallback = "", Volume = 0.18, Pitch = 1.6 },
	vacuum_loop = { Fallback = "", Volume = 0.25, Pitch = 1.8, Looped = true },
	pickup = { Fallback = "", Volume = 0.3, Pitch = 1.5 },
	rare_pickup = { Fallback = "", Volume = 0.5, Pitch = 0.9 },
	full = { Fallback = "", Volume = 0.5, Pitch = 0.5 },
	deposit = { Fallback = "", Volume = 0.6, Pitch = 0.8 },
	cash = { Fallback = "", Volume = 0.55, Pitch = 1.2 },
	level_up = { Fallback = "", Volume = 0.5 },
	purchase = { Fallback = "", Volume = 0.6, Pitch = 1.2 },
	capsule_pack = { Fallback = "", Volume = 0.6, Pitch = 0.6 },
	teleport = { Fallback = "", Volume = 0.4, Pitch = 1.4 },
	launch = { Fallback = "", Volume = 0.45 },
	crate_roll = { Fallback = "", Volume = 0.3, Pitch = 1.1 },
	crate_reveal = { Fallback = "", Volume = 0.55, Pitch = 1.1 },
	robot_beep = { Fallback = "", Volume = 0.25, Pitch = 2 },
	build_place = { Fallback = "", Volume = 0.6, Pitch = 0.9 },
	build_remove = { Fallback = "", Volume = 0.5 },
	sector_clear = { Fallback = "", Volume = 0.4, Pitch = 1.25 },
	meteor = { Fallback = "", Volume = 0.5, Pitch = 0.6 },
	jetpack = { Fallback = "", Volume = 0.35, Pitch = 1.6 },
	secret = { Fallback = "", Volume = 0.6, Pitch = 0.8 },
	throw = { Fallback = "", Volume = 0.5, Pitch = 1 },
	engine_loop = { Fallback = "", Volume = 0.35, Looped = true },
	-- ambience & music (no built-in fallback for music: silent until uploaded)
	ambience = { Fallback = "", Volume = 0.25, Looped = true },
	music_hub = { Fallback = "", Volume = 0.35, Looped = true, Music = true },
	music_explore = { Fallback = "", Volume = 0.35, Looped = true, Music = true },
	music_caves = { Fallback = "", Volume = 0.35, Looped = true, Music = true },
	music_ice = { Fallback = "", Volume = 0.35, Looped = true, Music = true },
	music_ember = { Fallback = "", Volume = 0.35, Looped = true, Music = true },
	music_dark = { Fallback = "", Volume = 0.35, Looped = true, Music = true },
	music_epic = { Fallback = "", Volume = 0.35, Looped = true, Music = true },
}

local Sounds = {}

function Sounds.Get(key: string): SoundDef?
	return defs[key]
end

-- Returns the content id to use for a key ("" if none available)
function Sounds.Resolve(key: string): string
	local folder = ReplicatedStorage:FindFirstChild("CustomSounds")
	local custom = folder and folder:FindFirstChild(key)
	if custom and custom:IsA("Sound") and custom.SoundId ~= "" then
		return custom.SoundId
	end
	local uploaded = (AudioIds :: any)[key]
	if type(uploaded) == "number" and uploaded > 0 then
		return "rbxassetid://" .. tostring(uploaded)
	end
	local def = defs[key]
	return def and def.Fallback or ""
end

Sounds.Defs = defs

return Sounds
