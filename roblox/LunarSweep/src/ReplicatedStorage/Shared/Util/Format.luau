--!strict
-- Number / time formatting helpers shared by client UI and server messages.

local Format = {}

local SUFFIXES = { "", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc" }

-- 1234 -> "1.23K", 15 -> "15", 0.5 -> "0.50"
function Format.Number(n: number, decimals: number?): string
	if n ~= n then
		return "0"
	end
	local neg = n < 0
	n = math.abs(n)
	local out: string
	if n < 10 and n ~= math.floor(n) then
		out = string.format("%.2f", n)
	elseif n < 1000 then
		out = tostring(math.floor(n + 0.5))
	else
		local idx = 1
		while n >= 1000 and idx < #SUFFIXES do
			n /= 1000
			idx += 1
		end
		local d = decimals or (n < 10 and 2 or (n < 100 and 1 or 0))
		out = string.format("%." .. d .. "f", n) .. SUFFIXES[idx]
	end
	return (neg and "-" or "") .. out
end

function Format.Credits(n: number): string
	return "$" .. Format.Number(n)
end

function Format.Kg(n: number): string
	if n < 10 then
		return string.format("%.2f kg", n)
	elseif n < 1000 then
		return string.format("%.1f kg", n)
	end
	return Format.Number(n) .. " kg"
end

-- 1234567 -> "1,234,567"
function Format.Commas(n: number): string
	local s = tostring(math.floor(n))
	local formatted = s
	while true do
		local k
		formatted, k = string.gsub(formatted, "^(-?%d+)(%d%d%d)", "%1,%2")
		if k == 0 then
			break
		end
	end
	return formatted
end

function Format.Percent(p: number, decimals: number?): string
	return string.format("%." .. tostring(decimals or 1) .. "f%%", p * 100)
end

-- seconds -> "1h 05m", "4m 12s", "9s"
function Format.Duration(seconds: number): string
	seconds = math.max(0, math.floor(seconds))
	local d = seconds // 86400
	local h = (seconds % 86400) // 3600
	local m = (seconds % 3600) // 60
	local s = seconds % 60
	if d > 0 then
		return string.format("%dd %02dh", d, h)
	elseif h > 0 then
		return string.format("%dh %02dm", h, m)
	elseif m > 0 then
		return string.format("%dm %02ds", m, s)
	end
	return string.format("%ds", s)
end

function Format.Clock(seconds: number): string
	seconds = math.max(0, math.floor(seconds))
	return string.format("%02d:%02d", seconds // 60, seconds % 60)
end

return Format
