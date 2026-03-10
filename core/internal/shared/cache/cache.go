package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

// Config controls Redis cache behaviour.
type Config struct {
	// RedisURL is the Redis connection URL (redis://[:password@]host[:port][/db]).
	// Defaults to REDIS_URL env var, then "redis://localhost:6379".
	RedisURL string
	// Prefix is prepended to every key. Defaults to "sn:".
	Prefix string
}

// Cache wraps a Redis client with a Set/Get/Delete/Incr/RateLimit API
// that mirrors the previous in-process sharded-LRU implementation.
type Cache struct {
	rdb    *redis.Client
	prefix string
}

// incrScript atomically increments a numeric key, preserving the existing TTL.
// Supports values stored as plain integers (via INCR) or JSON-encoded numbers.
var incrScript = redis.NewScript(`
local v   = redis.call('GET', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
local n   = 0
if v then n = tonumber(v) or 0 end
n = n + tonumber(ARGV[1])
if ttl > 0 then
    redis.call('SET', KEYS[1], n, 'PX', ttl)
else
    redis.call('SET', KEYS[1], n)
end
return n
`)

// New creates a Cache from cfg. It pings Redis and returns an error if unreachable.
func New(cfg Config) (*Cache, error) {
	if cfg.RedisURL == "" {
		cfg.RedisURL = os.Getenv("REDIS_URL")
	}
	if cfg.RedisURL == "" {
		cfg.RedisURL = "redis://localhost:6379"
	}
	if cfg.Prefix == "" {
		cfg.Prefix = "sn:"
	}

	opts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		return nil, fmt.Errorf("cache: invalid redis URL: %w", err)
	}

	rdb := redis.NewClient(opts)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		rdb.Close()
		return nil, fmt.Errorf("cache: redis ping failed: %w", err)
	}

	return &Cache{rdb: rdb, prefix: cfg.Prefix}, nil
}

// NewWithClient builds a Cache around an already-connected Redis client.
// Useful when the caller wants to share a single connection pool across services.
func NewWithClient(rdb *redis.Client, prefix string) *Cache {
	if prefix == "" {
		prefix = "sn:"
	}
	return &Cache{rdb: rdb, prefix: prefix}
}

// NewDefault creates a Cache using defaults (reads REDIS_URL from env).
func NewDefault() (*Cache, error) {
	return New(Config{})
}

func (c *Cache) k(key string) string { return c.prefix + key }

// Set stores value (JSON-encoded) under key with optional TTL (0 = no expiry).
func (c *Cache) Set(key string, value interface{}, ttl time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	ctx := context.Background()
	return c.rdb.Set(ctx, c.k(key), data, ttl).Err()
}

// Get retrieves and JSON-decodes the value for key into dest.
// Returns false on cache miss or decode error.
func (c *Cache) Get(key string, dest interface{}) bool {
	ctx := context.Background()
	data, err := c.rdb.Get(ctx, c.k(key)).Bytes()
	if err != nil {
		return false
	}
	return json.Unmarshal(data, dest) == nil
}

// Delete removes key from the cache.
func (c *Cache) Delete(key string) {
	ctx := context.Background()
	c.rdb.Del(ctx, c.k(key))
}

// Exists returns true if the key is present in Redis.
func (c *Cache) Exists(key string) bool {
	ctx := context.Background()
	n, err := c.rdb.Exists(ctx, c.k(key)).Result()
	return err == nil && n > 0
}

// Incr atomically increments the integer stored at key by delta.
// The existing TTL is preserved. Creates the key at 0 if missing.
func (c *Cache) Incr(key string, delta int64) (int64, error) {
	ctx := context.Background()
	n, err := incrScript.Run(ctx, c.rdb, []string{c.k(key)}, delta).Int64()
	if err != nil {
		// Fallback: plain INCRBY (TTL not preserved, but counter stays accurate)
		n, err = c.rdb.IncrBy(ctx, c.k(key), delta).Result()
	}
	return n, err
}

// PFAdd adds elements to a HyperLogLog key. Sets TTL on first add.
func (c *Cache) PFAdd(key string, ttl time.Duration, elements ...string) error {
	ctx := context.Background()
	k := c.k(key)
	args := make([]interface{}, len(elements))
	for i, e := range elements {
		args[i] = e
	}
	added, err := c.rdb.PFAdd(ctx, k, args...).Result()
	if err != nil {
		return err
	}
	// Set TTL only when the key was first created (added > 0 and no existing TTL)
	if added > 0 && ttl > 0 {
		curTTL := c.rdb.TTL(ctx, k).Val()
		if curTTL < 0 {
			c.rdb.Expire(ctx, k, ttl)
		}
	}
	return nil
}

// PFCount returns the approximate cardinality of a HyperLogLog key.
func (c *Cache) PFCount(key string) (int64, error) {
	ctx := context.Background()
	return c.rdb.PFCount(ctx, c.k(key)).Result()
}

// SAdd adds members to a Redis set. Sets TTL on first add.
func (c *Cache) SAdd(key string, ttl time.Duration, members ...string) error {
	ctx := context.Background()
	k := c.k(key)
	args := make([]interface{}, len(members))
	for i, m := range members {
		args[i] = m
	}
	err := c.rdb.SAdd(ctx, k, args...).Err()
	if err != nil {
		return err
	}
	if ttl > 0 {
		curTTL := c.rdb.TTL(ctx, k).Val()
		if curTTL < 0 {
			c.rdb.Expire(ctx, k, ttl)
		}
	}
	return nil
}

// SIsMember returns true if member is in the set.
func (c *Cache) SIsMember(key, member string) bool {
	ctx := context.Background()
	val, err := c.rdb.SIsMember(ctx, c.k(key), member).Result()
	return err == nil && val
}

// AcquireLock attempts to acquire a distributed lock using SET NX EX.
// Returns true if the lock was acquired.
func (c *Cache) AcquireLock(key string, ttl time.Duration) bool {
	ctx := context.Background()
	ok, err := c.rdb.SetNX(ctx, c.k(key), "1", ttl).Result()
	return err == nil && ok
}

// ReleaseLock releases a distributed lock.
func (c *Cache) ReleaseLock(key string) {
	ctx := context.Background()
	c.rdb.Del(ctx, c.k(key))
}

// LPush pushes one or more values to the left of a Redis list.
func (c *Cache) LPush(key string, values ...string) error {
	ctx := context.Background()
	args := make([]interface{}, len(values))
	for i, v := range values {
		args[i] = v
	}
	return c.rdb.LPush(ctx, c.k(key), args...).Err()
}

// BRPop blocks until an element is available on one of the given lists or timeout expires.
// Returns the key and value, or empty strings on timeout.
func (c *Cache) BRPop(timeout time.Duration, keys ...string) (string, string, error) {
	ctx := context.Background()
	prefixed := make([]string, len(keys))
	for i, k := range keys {
		prefixed[i] = c.k(k)
	}
	result, err := c.rdb.BRPop(ctx, timeout, prefixed...).Result()
	if err != nil {
		return "", "", err
	}
	if len(result) == 2 {
		return result[0], result[1], nil
	}
	return "", "", fmt.Errorf("unexpected BRPop result")
}

// LLen returns the length of a Redis list.
func (c *Cache) LLen(key string) (int64, error) {
	ctx := context.Background()
	return c.rdb.LLen(ctx, c.k(key)).Result()
}

// Shutdown closes the underlying Redis client.
func (c *Cache) Shutdown() error {
	return c.rdb.Close()
}

// Client returns the underlying Redis client so callers can share the connection pool.
func (c *Cache) Client() *redis.Client { return c.rdb }
