--!strict
-- Token-bucket rate limiter keyed by player + action. Used by the request router and
-- remote handlers to stop spam / exploit flooding.

local RateLimiter = {}
RateLimiter.__index = RateLimiter

type Bucket = { Tokens: number, Last: number }

function RateLimiter.new(capacity: number, refillPerSecond: number)
	return setmetatable({ Capacity = capacity, Refill = refillPerSecond, Buckets = {} :: { [any]: Bucket } }, RateLimiter)
end

function RateLimiter.Check(self: any, key: any, cost: number?): boolean
	local now = os.clock()
	local b: Bucket? = self.Buckets[key]
	if not b then
		b = { Tokens = self.Capacity, Last = now }
		self.Buckets[key] = b
	end
	assert(b)
	b.Tokens = math.min(self.Capacity, b.Tokens + (now - b.Last) * self.Refill)
	b.Last = now
	local c = cost or 1
	if b.Tokens >= c then
		b.Tokens -= c
		return true
	end
	return false
end

function RateLimiter.Clear(self: any, key: any)
	self.Buckets[key] = nil
end

return RateLimiter
