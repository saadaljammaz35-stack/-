--!strict
-- Table helpers used by data/profile code.

local TableUtil = {}

function TableUtil.DeepCopy<T>(t: T): T
	if type(t) ~= "table" then
		return t
	end
	local out = {}
	for k, v in t :: any do
		out[k] = TableUtil.DeepCopy(v)
	end
	return (out :: any) :: T
end

-- Fill keys missing in `target` from `template` (recursive for dictionaries).
function TableUtil.Reconcile(target: { [any]: any }, template: { [any]: any })
	for k, v in template do
		if target[k] == nil then
			target[k] = TableUtil.DeepCopy(v)
		elseif type(v) == "table" and type(target[k]) == "table" and next(v) ~= nil and #v == 0 then
			-- only reconcile dictionaries, never arrays
			TableUtil.Reconcile(target[k], v)
		end
	end
end

function TableUtil.Count(t: { [any]: any }): number
	local n = 0
	for _ in t do
		n += 1
	end
	return n
end

function TableUtil.Keys<K>(t: { [K]: any }): { K }
	local out = {}
	for k in t do
		table.insert(out, k)
	end
	return out
end

function TableUtil.Shuffle<T>(arr: { T }, rng: Random?): { T }
	local r = rng or Random.new()
	for i = #arr, 2, -1 do
		local j = r:NextInteger(1, i)
		arr[i], arr[j] = arr[j], arr[i]
	end
	return arr
end

-- Weighted random pick from { {Weight = n, ...}, ... }
function TableUtil.WeightedPick<T>(list: { T }, weightOf: (T) -> number, rng: Random?): T?
	local total = 0
	for _, item in list do
		total += math.max(0, weightOf(item))
	end
	if total <= 0 then
		return nil
	end
	local r = (rng or Random.new()):NextNumber() * total
	for _, item in list do
		r -= math.max(0, weightOf(item))
		if r <= 0 then
			return item
		end
	end
	return list[#list]
end

function TableUtil.Sum(t: { [any]: number }): number
	local s = 0
	for _, v in t do
		s += v
	end
	return s
end

return TableUtil
