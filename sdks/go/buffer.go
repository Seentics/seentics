package seentics

import "sync"

// buffer is a generic, mutex-protected accumulator.
// Items are appended with add() and drained atomically with drain().
type buffer[T any] struct {
	mu    sync.Mutex
	items []T
	max   int
}

func newBuffer[T any](max int) *buffer[T] {
	return &buffer[T]{max: max}
}

// add appends item and returns true when the buffer has reached capacity.
func (b *buffer[T]) add(item T) bool {
	b.mu.Lock()
	b.items = append(b.items, item)
	full := len(b.items) >= b.max
	b.mu.Unlock()
	return full
}

// drain atomically swaps out all items and returns them.
func (b *buffer[T]) drain() []T {
	b.mu.Lock()
	items := b.items
	b.items = nil
	b.mu.Unlock()
	return items
}
