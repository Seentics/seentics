package cache

import (
	"sync"
	"time"
)

// RateLimitOptions configures token bucket rate limiting.
type RateLimitOptions struct {
	Limit  int64
	Window time.Duration
}

// RateLimitState is the result of a rate limit check.
type RateLimitState struct {
	Allowed   bool
	Remaining int64
	Limit     int64
	ResetsAt  time.Time
}

// RateLimit checks a token bucket rate limiter for the given key.
func (c *Cache) RateLimit(key string, opts RateLimitOptions) (bool, RateLimitState) {
	s := c.rl.allow(key, opts.Limit, opts.Window)
	return s.Allowed, s
}

// --- token bucket implementation ---

type bucket struct {
	tokens   float64
	limit    int64
	lastFill time.Time
	window   time.Duration
}

type tokenBucket struct {
	mu      sync.Mutex
	buckets map[string]*bucket
}

func newTokenBucket() *tokenBucket {
	return &tokenBucket{
		buckets: make(map[string]*bucket),
	}
}

func (tb *tokenBucket) allow(key string, limit int64, window time.Duration) RateLimitState {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	now := time.Now()
	b, ok := tb.buckets[key]
	if !ok {
		b = &bucket{
			tokens:   float64(limit),
			limit:    limit,
			lastFill: now,
			window:   window,
		}
		tb.buckets[key] = b
	}

	// Update limit/window if changed
	b.limit = limit
	b.window = window

	// Refill tokens based on elapsed time
	elapsed := now.Sub(b.lastFill)
	refillRate := float64(limit) / window.Seconds()
	b.tokens += elapsed.Seconds() * refillRate
	if b.tokens > float64(limit) {
		b.tokens = float64(limit)
	}
	b.lastFill = now

	resetsAt := now.Add(window)

	if b.tokens >= 1 {
		b.tokens--
		return RateLimitState{
			Allowed:   true,
			Remaining: int64(b.tokens),
			Limit:     limit,
			ResetsAt:  resetsAt,
		}
	}

	return RateLimitState{
		Allowed:   false,
		Remaining: 0,
		Limit:     limit,
		ResetsAt:  resetsAt,
	}
}

// cleanup removes stale buckets that haven't been used for 2x their window.
func (tb *tokenBucket) cleanup() {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	now := time.Now()
	for key, b := range tb.buckets {
		if now.Sub(b.lastFill) > 2*b.window {
			delete(tb.buckets, key)
		}
	}
}
