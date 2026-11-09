--!nonstrict
-- Sound effects (pooled) and zone music with cross-fades. Volumes come from Settings.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local SoundService = game:GetService("SoundService")
local TweenService = game:GetService("TweenService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Sounds = require(Shared.Config.Sounds)

local SoundController = {}

local sfxGroup: SoundGroup
local musicGroup: SoundGroup
local cache: { [string]: Sound } = {}
local currentMusic: Sound? = nil
local currentMusicKey: string? = nil
local lastPlay: { [string]: number } = {}

local function make(key: string, group: SoundGroup): Sound?
	local id = Sounds.Resolve(key)
	local def = Sounds.Get(key)
	if id == "" or not def then
		return nil
	end
	local s = Instance.new("Sound")
	s.Name = key
	s.SoundId = id
	s.Volume = def.Volume
	s.PlaybackSpeed = def.Pitch or 1
	s.Looped = def.Looped == true
	s.SoundGroup = group
	s.Parent = SoundService
	return s
end

function SoundController:Play(key: string, pitchJitter: number?)
	local now = os.clock()
	if lastPlay[key] and now - lastPlay[key] < 0.05 then
		return
	end
	lastPlay[key] = now
	local s = cache[key]
	if s == nil then
		s = make(key, sfxGroup)
		cache[key] = s or false :: any
	end
	if not s then
		return
	end
	if pitchJitter then
		local def = Sounds.Get(key)
		s.PlaybackSpeed = (def and def.Pitch or 1) * (1 + (math.random() - 0.5) * pitchJitter)
	end
	SoundService:PlayLocalSound(s)
end

-- positional one-shot (other players' actions, meteors)
function SoundController:PlayAt(key: string, pos: Vector3, volumeMult: number?)
	local id = Sounds.Resolve(key)
	local def = Sounds.Get(key)
	if id == "" or not def then
		return
	end
	local part = Instance.new("Part")
	part.Anchored = true
	part.CanCollide = false
	part.CanQuery = false
	part.CanTouch = false
	part.Transparency = 1
	part.Size = Vector3.one
	part.Position = pos
	part.Parent = Workspace
	local s = Instance.new("Sound")
	s.SoundId = id
	s.Volume = def.Volume * (volumeMult or 1)
	s.PlaybackSpeed = def.Pitch or 1
	s.RollOffMaxDistance = 220
	s.SoundGroup = sfxGroup
	s.Parent = part
	s:Play()
	task.delay(6, function()
		part:Destroy()
	end)
end

function SoundController:Loop(key: string, on: boolean)
	local s = cache[key]
	if s == nil then
		s = make(key, sfxGroup)
		cache[key] = s or false :: any
	end
	if not s then
		return
	end
	if on and not s.IsPlaying then
		s:Play()
	elseif not on and s.IsPlaying then
		s:Stop()
	end
end

function SoundController:SetMusic(key: string?)
	if key == currentMusicKey then
		return
	end
	currentMusicKey = key
	local old = currentMusic
	if old then
		TweenService:Create(old, TweenInfo.new(1.5), { Volume = 0 }):Play()
		task.delay(1.6, function()
			old:Destroy()
		end)
	end
	currentMusic = nil
	if not key then
		return
	end
	local s = make(key, musicGroup)
	if not s then
		return
	end
	local target = s.Volume
	s.Volume = 0
	s:Play()
	TweenService:Create(s, TweenInfo.new(2), { Volume = target }):Play()
	currentMusic = s
end

function SoundController:ApplyVolumes(settings)
	sfxGroup.Volume = math.clamp(settings.Sfx or 0.8, 0, 1)
	musicGroup.Volume = math.clamp(settings.Music or 0.5, 0, 1)
end

function SoundController:Init(ctx)
	sfxGroup = Instance.new("SoundGroup")
	sfxGroup.Name = "SFX"
	sfxGroup.Parent = SoundService
	musicGroup = Instance.new("SoundGroup")
	musicGroup.Name = "Music"
	musicGroup.Parent = SoundService
	ctx.Data:Watch({ "Settings" }, function()
		self:ApplyVolumes(ctx.Data.Profile.Settings)
	end)
	-- ambience bed
	task.delay(2, function()
		local amb = make("ambience", sfxGroup)
		if amb then
			amb:Play()
		end
	end)
end

return SoundController
