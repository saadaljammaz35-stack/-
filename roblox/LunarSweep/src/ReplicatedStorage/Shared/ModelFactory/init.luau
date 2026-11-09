--!strict
-- Facade over the procedural model builders (shared by server and client viewports).

local ToolModels = require(script.ToolModels)
local RobotModels = require(script.RobotModels)
local ItemModels = require(script.ItemModels)
local BuildingModels = require(script.BuildingModels)
local VehicleModels = require(script.VehicleModels)
local Builder = require(script.Builder)

local ModelFactory = {}

ModelFactory.Builder = Builder
ModelFactory.Tool = ToolModels.Tool
ModelFactory.ToolModel = ToolModels.Model
ModelFactory.Robot = RobotModels.Model
ModelFactory.Container = ItemModels.Container
ModelFactory.Pickup = ItemModels.Pickup
ModelFactory.Capsule = ItemModels.Capsule
ModelFactory.Helmet = ItemModels.Helmet
ModelFactory.Building = BuildingModels.Model
ModelFactory.Vehicle = VehicleModels.Model

-- Build a preview model of any catalog item (used by shop/inventory viewports)
function ModelFactory.Preview(kind: string, id: string): Model?
	if kind == "Tool" then
		return ToolModels.Model(id)
	elseif kind == "Container" then
		return ItemModels.Container(id)
	elseif kind == "Robot" then
		return RobotModels.Model(id, false)
	elseif kind == "Building" then
		return BuildingModels.Model(id, 1)
	elseif kind == "Vehicle" then
		return VehicleModels.Model(id, false)
	elseif kind == "Resource" then
		return ItemModels.Pickup(id)
	end
	return nil
end

return ModelFactory
