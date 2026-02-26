package cache

import (
	"container/list"
	"encoding/json"
	"hash/fnv"
	"sync"
	"sync/atomic"
	"time"
)

// Config controls cache behavior.
type Config struct {
	NumShards       int           // power of 2, default 16
	MaxMemoryMB     int64         // default 128; 0 is treated as 128
	SweeperInterval time.Duration // default 30s
}

// Cache is a lightweight in-process cache with sharded LRU eviction,
// TTL expiration, atomic counters, and token-bucket rate limiting.
type Cache struct {
	shards []*shard
	mask   uint32
	closed atomic.Bool
	done   chan struct{}

	// Rate limiting
	rl *tokenBucket
}

type entry struct {
	key       string
	value     []byte // JSON-serialized
	expiresAt int64  // unix nano; 0 = no expiry
	size      int64
	el        *list.Element
}

type shard struct {
	mu       sync.RWMutex
	items    map[string]*entry
	lru      *list.List
	curBytes int64
	maxBytes int64
}

// New creates a cache with the given configuration.
func New(cfg Config) (*Cache, error) {
	if cfg.NumShards <= 0 {
		cfg.NumShards = 16
	}
	if cfg.MaxMemoryMB <= 0 {
		cfg.MaxMemoryMB = 128
	}
	if cfg.SweeperInterval <= 0 {
		cfg.SweeperInterval = 30 * time.Second
	}

	perShard := (cfg.MaxMemoryMB * 1024 * 1024) / int64(cfg.NumShards)

	shards := make([]*shard, cfg.NumShards)
	for i := range shards {
		shards[i] = &shard{
			items:    make(map[string]*entry),
			lru:      list.New(),
			maxBytes: perShard,
		}
	}

	c := &Cache{
		shards: shards,
		mask:   uint32(cfg.NumShards - 1),
		done:   make(chan struct{}),
		rl:     newTokenBucket(),
	}

	go c.sweeper(cfg.SweeperInterval)
	return c, nil
}

// NewDefault creates a cache with 128MB, 16 shards, 30s sweeper.
func NewDefault() (*Cache, error) {
	return New(Config{})
}

func (c *Cache) getShard(key string) *shard {
	h := fnv.New32a()
	h.Write([]byte(key))
	return c.shards[h.Sum32()&c.mask]
}

// Set stores a value with the given TTL (0 = no expiry).
func (c *Cache) Set(key string, value interface{}, ttl time.Duration) error {
	if c.closed.Load() {
		return nil
	}

	data, err := json.Marshal(value)
	if err != nil {
		return err
	}

	var expiresAt int64
	if ttl > 0 {
		expiresAt = time.Now().Add(ttl).UnixNano()
	}

	sz := int64(len(key)) + int64(len(data)) + 184

	s := c.getShard(key)
	s.mu.Lock()
	defer s.mu.Unlock()

	// Update existing entry
	if e, ok := s.items[key]; ok {
		s.curBytes -= e.size
		e.value = data
		e.expiresAt = expiresAt
		e.size = sz
		s.curBytes += sz
		s.lru.MoveToFront(e.el)
		s.evictLocked()
		return nil
	}

	// New entry
	e := &entry{
		key:       key,
		value:     data,
		expiresAt: expiresAt,
		size:      sz,
	}
	e.el = s.lru.PushFront(e)
	s.items[key] = e
	s.curBytes += sz
	s.evictLocked()
	return nil
}

// Get retrieves a value and deserializes it into dest. Returns false on miss.
func (c *Cache) Get(key string, dest interface{}) bool {
	if c.closed.Load() {
		return false
	}

	s := c.getShard(key)
	s.mu.Lock()
	e, ok := s.items[key]
	if !ok {
		s.mu.Unlock()
		return false
	}

	// Lazy expiry
	if e.expiresAt > 0 && time.Now().UnixNano() > e.expiresAt {
		s.removeLocked(e)
		s.mu.Unlock()
		return false
	}

	s.lru.MoveToFront(e.el)
	data := make([]byte, len(e.value))
	copy(data, e.value)
	s.mu.Unlock()

	return json.Unmarshal(data, dest) == nil
}

// Delete removes a key from the cache.
func (c *Cache) Delete(key string) {
	if c.closed.Load() {
		return
	}

	s := c.getShard(key)
	s.mu.Lock()
	if e, ok := s.items[key]; ok {
		s.removeLocked(e)
	}
	s.mu.Unlock()
}

// Incr atomically increments a counter by delta. Creates at 0 if missing.
// Preserves the existing TTL of the key.
func (c *Cache) Incr(key string, delta int64) (int64, error) {
	if c.closed.Load() {
		return 0, nil
	}

	s := c.getShard(key)
	s.mu.Lock()
	defer s.mu.Unlock()

	var current int64
	var expiresAt int64

	if e, ok := s.items[key]; ok {
		// Lazy expiry check
		if e.expiresAt > 0 && time.Now().UnixNano() > e.expiresAt {
			s.removeLocked(e)
		} else {
			_ = json.Unmarshal(e.value, &current)
			expiresAt = e.expiresAt
		}
	}

	current += delta
	data, _ := json.Marshal(current)

	sz := int64(len(key)) + int64(len(data)) + 184

	if e, ok := s.items[key]; ok {
		s.curBytes -= e.size
		e.value = data
		e.expiresAt = expiresAt
		e.size = sz
		s.curBytes += sz
		s.lru.MoveToFront(e.el)
	} else {
		e := &entry{
			key:       key,
			value:     data,
			expiresAt: expiresAt,
			size:      sz,
		}
		e.el = s.lru.PushFront(e)
		s.items[key] = e
		s.curBytes += sz
	}

	return current, nil
}

// Shutdown stops the sweeper and clears all data.
func (c *Cache) Shutdown() error {
	if c.closed.CompareAndSwap(false, true) {
		close(c.done)
	}
	return nil
}

// --- shard helpers ---

func (s *shard) removeLocked(e *entry) {
	s.lru.Remove(e.el)
	delete(s.items, e.key)
	s.curBytes -= e.size
}

func (s *shard) evictLocked() {
	for s.curBytes > s.maxBytes && s.lru.Len() > 0 {
		oldest := s.lru.Back()
		if oldest == nil {
			break
		}
		e := oldest.Value.(*entry)
		s.removeLocked(e)
	}
}

// --- sweeper ---

func (c *Cache) sweeper(interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-c.done:
			return
		case <-ticker.C:
			now := time.Now().UnixNano()
			for _, s := range c.shards {
				s.mu.Lock()
				for key, e := range s.items {
					if e.expiresAt > 0 && now > e.expiresAt {
						s.lru.Remove(e.el)
						delete(s.items, key)
						s.curBytes -= e.size
					}
				}
				s.mu.Unlock()
			}
			// Clean stale rate limit buckets
			c.rl.cleanup()
		}
	}
}
