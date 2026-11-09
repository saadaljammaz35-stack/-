-- Service registry: Main.server fills this table so services can reach each other at
-- runtime without circular requires (Registry.DataService, Registry.SectorService, ...).
local Registry: { [string]: any } = {}
return Registry
