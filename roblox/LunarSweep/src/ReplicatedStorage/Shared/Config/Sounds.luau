--!strict
-- Sound registry. Each entry has a Fallback that ships with every Roblox client
-- (rbxasset://sounds/...), so the game has audio out of the box.
-- The custom synthesized sounds/music in /assets/audio can be uploaded with
-- tools/upload_assets.py, which writes their asset ids into AudioIds.luau; uploaded ids
-- always take priority over the fallbacks.

local AudioIds = require(script.Parent.AudioIds)

export type SoundDef = { Fallback: string, Volume: number, Pitch: number?, Looped: boolean?, Music: boolean? }

local defs: { [string]: SoundDef } = {
	-- ui
	click = { Fallback = "rbxasset://sounds/button.wav", Volume = 0.45 },
	hover = { Fallback = "rbxasset://sounds/clickfast.wav", Volume = 0.15 },
	open_panel = { Fallback = "rbxasset://sounds/swoosh.wav", Volume = 0.25, Pitch = 1.3 },
	error = { Fallback = "rbxasset://sounds/collide.wav", Volume = 0.4, Pitch = 0.7 },
	notify = { Fallback = "rbxasset://sounds/electronicpingshort.wav", Volume = 0.35 },
	-- gameplay
	sweep = { Fallback = "rbxasset://sounds/swoosh.wav", Volume = 0.18, Pitch = 1.6 },
	vacuum_loop = { Fallback = "rbxasset://sounds/action_swim.mp3", Volume = 0.25, Pitch = 1.8, Looped = true },
	pickup = { Fallback = "rbxasset://sounds/electronicpingshort.wav", Volume = 0.3, Pitch = 1.5 },
	rare_pickup = { Fallback = "rbxasset://sounds/electronicpingshort.wav", Volume = 0.5, Pitch = 0.9 },
	full = { Fallback = "rbxasset://sounds/collide.wav", Volume = 0.5, Pitch = 0.5 },
	deposit = { Fallback = "rbxasset://sounds/snap.wav", Volume = 0.6, Pitch = 0.8 },
	cash = { Fallback = "rbxasset://sounds/electronicpingshort.wav", Volume = 0.55, Pitch = 1.2 },
	level_up = { Fallback = "rbxasset://sounds/victory.wav", Volume = 0.5 },
	purchase = { Fallback = "rbxasset://sounds/snap.wav", Volume = 0.6, Pitch = 1.2 },
	capsule_pack = { Fallback = "rbxasset://sounds/snap.wav", Volume = 0.6, Pitch = 0.6 },
	teleport = { Fallback = "rbxasset://sounds/Rocket whoosh 01.wav", Volume = 0.4, Pitch = 1.4 },
	launch = { Fallback = "rbxasset://sounds/Launching rocket.wav", Volume = 0.45 },
	crate_roll = { Fallback = "rbxasset://sounds/clickfast.wav", Volume = 0.3, Pitch = 1.1 },
	crate_reveal = { Fallback = "rbxasset://sounds/victory.wav", Volume = 0.55, Pitch = 1.1 },
	robot_beep = { Fallback = "rbxasset://sounds/electronicpingshort.wav", Volume = 0.25, Pitch = 2 },
	build_place = { Fallback = "rbxasset://sounds/snap.wav", Volume = 0.6, Pitch = 0.9 },
	build_remove = { Fallback = "rbxasset://sounds/collide.wav", Volume = 0.5 },
	sector_clear = { Fallback = "rbxasset://sounds/victory.wav", Volume = 0.4, Pitch = 1.25 },
	meteor = { Fallback = "rbxasset://sounds/Rocket shot.wav", Volume = 0.5, Pitch = 0.6 },
	jetpack = { Fallback = "rbxasset://sounds/Rocket whoosh 01.wav", Volume = 0.35, Pitch = 1.6 },
	secret = { Fallback = "rbxasset://sounds/victory.wav", Volume = 0.6, Pitch = 0.8 },
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
	local uploaded = (AudioIds :: any)[key]
	if type(uploaded) == "number" and uploaded > 0 then
		return "rbxassetid://" .. tostring(uploaded)
	end
	local def = defs[key]
	return def and def.Fallback or ""
end

Sounds.Defs = defs

return Sounds
