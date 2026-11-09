--!nonstrict
-- Main menu orbit camera over the colony.

local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")

local CameraController = {}

local orbitConn: RBXScriptConnection? = nil

function CameraController:StartMenuOrbit()
	local cam = Workspace.CurrentCamera
	if not cam or orbitConn then
		return
	end
	cam.CameraType = Enum.CameraType.Scriptable
	local t = 0
	orbitConn = RunService.RenderStepped:Connect(function(dt)
		t += dt * 0.06
		local pos = Vector3.new(math.sin(t) * 150, 70 + math.sin(t * 0.7) * 12, math.cos(t) * 150)
		cam.CFrame = CFrame.lookAt(pos, Vector3.new(0, 8, 0))
	end)
end

function CameraController:StopMenuOrbit()
	if orbitConn then
		orbitConn:Disconnect()
		orbitConn = nil
	end
	local cam = Workspace.CurrentCamera
	if cam then
		cam.CameraType = Enum.CameraType.Custom
	end
end

function CameraController:Init(_ctx) end

return CameraController
