package cache

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

// RateLimitOptions configures sliding-window rate limiting.
type RateLimitOptions struct {
	Limit  int64
	Window time.Duration
}

// RateLimitState is the result of a rate-limit check.
type RateLimitState struct {
	Allowed   bool
	Remaining int64
	Limit     int64
	ResetsAt  time.Time
}

// rateLimitScript implements a Redis sliding-window counter using a sorted set.
//
//	KEYS[1] = key
//	ARGV[1] = now (unix ms)
//	ARGV[2] = window (ms)
//	ARGV[3] = limit
//
// Returns {allowed (1/0), remaining, limit}.
var rateLimitScript = redis.NewScript(`
local key    = KEYS[1]
local now    = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit  = tonumber(ARGV[3])
local cutoff = now - window

redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)
local count = tonumber(redis.call('ZCARD', key))

if count < limit then
    local member = now .. ':' .. math.random(999999)
    redis.call('ZADD', key, now, member)
    redis.call('PEXPIRE', key, window * 2)
    return {1, limit - count - 1, limit}
end
return {0, 0, limit}
`)

// RateLimit checks a sliding-window rate limit for the given key.
// Fails open (allows request) when Redis is unavailable.
func (c *Cache) RateLimit(key string, opts RateLimitOptions) (bool, RateLimitState) {
	ctx := context.Background()
	nowMs := time.Now().UnixMilli()
	windowMs := opts.Window.Milliseconds()
	resetsAt := time.Now().Add(opts.Window)

	res, err := rateLimitScript.Run(ctx, c.rdb,
		[]string{c.k(key)},
		nowMs, windowMs, opts.Limit,
	).Slice()

	if err != nil || len(res) < 3 {
		// Fail open: Redis unavailable → allow request
		return true, RateLimitState{
			Allowed:   true,
			Remaining: opts.Limit,
			Limit:     opts.Limit,
			ResetsAt:  resetsAt,
		}
	}

	allowed := asInt64(res[0]) == 1
	remaining := asInt64(res[1])
	return allowed, RateLimitState{
		Allowed:   allowed,
		Remaining: remaining,
		Limit:     opts.Limit,
		ResetsAt:  resetsAt,
	}
}

func asInt64(v interface{}) int64 {
	switch x := v.(type) {
	case int64:
		return x
	case int:
		return int64(x)
	}
	return 0
}
