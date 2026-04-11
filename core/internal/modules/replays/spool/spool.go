// Package spool buffers in-flight replay events in memory until idle or max age,
// then uploads a single gzipped JSON bundle per session to object storage.
package spool

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/Seentics/seentics/internal/modules/replays/models"
	"github.com/Seentics/seentics/internal/modules/replays/repository"
	"github.com/Seentics/seentics/internal/shared/utils"
	"github.com/rs/zerolog"
)

const maxEventsPerSession = 500_000

// Manager holds hot session buffers keyed by website storage id + session id.
type Manager struct {
	repo      *repository.ReplayRepository
	logger    zerolog.Logger
	idleFlush time.Duration
	maxAge    time.Duration
	mu        sync.RWMutex
	sessions  map[string]*sessionState
	stop      chan struct{}
	stopOnce  sync.Once
}

type sessionState struct {
	mu           sync.Mutex
	siteID       string
	sessionID    string
	events       []map[string]interface{}
	dirty        bool
	finalizing   bool // true while an upload goroutine owns this session
	created      time.Time
	lastActivity time.Time
}

// New creates a spool manager. Call Run to start the periodic finalizer.
func New(repo *repository.ReplayRepository, logger zerolog.Logger, idleFlush, maxAge time.Duration) *Manager {
	if idleFlush <= 0 {
		idleFlush = 15 * time.Minute
	}
	if maxAge <= 0 {
		maxAge = 30 * time.Minute
	}
	return &Manager{
		repo:      repo,
		logger:    logger.With().Str("component", "replay_spool").Logger(),
		idleFlush: idleFlush,
		maxAge:    maxAge,
		sessions:  make(map[string]*sessionState),
		stop:      make(chan struct{}),
	}
}

func mapKey(siteID, sessionID string) string {
	return siteID + "\x00" + sessionID
}

// Push appends an event batch for a session (same shape as one S3 chunk).
func (m *Manager) Push(siteID, sessionID string, events []map[string]interface{}) error {
	if siteID == "" || sessionID == "" {
		return nil
	}
	if len(events) == 0 {
		return nil
	}
	k := mapKey(siteID, sessionID)
	m.mu.Lock()
	st, ok := m.sessions[k]
	if !ok {
		now := time.Now()
		st = &sessionState{
			siteID: siteID, sessionID: sessionID,
			created: now, lastActivity: now,
		}
		m.sessions[k] = st
	}
	m.mu.Unlock()

	st.mu.Lock()
	defer st.mu.Unlock()
	if len(st.events)+len(events) > maxEventsPerSession {
		return fmt.Errorf("replay spool: session %q exceeds %d events", sessionID, maxEventsPerSession)
	}
	st.events = append(st.events, events...)
	st.dirty = true
	st.lastActivity = time.Now()
	return nil
}

// WarmChunks returns merged in-memory events as a single chunk when the session is still spooled.
// Returns false when a bundle upload is in progress with no buffered events yet — the caller
// should fall through to the S3 presigned-URL path rather than serving empty replay data.
func (m *Manager) WarmChunks(siteID, sessionID string) ([]models.ReplayChunk, bool) {
	if siteID == "" || sessionID == "" {
		return nil, false
	}
	k := mapKey(siteID, sessionID)
	m.mu.RLock()
	st, ok := m.sessions[k]
	m.mu.RUnlock()
	if !ok {
		return nil, false
	}
	st.mu.Lock()
	defer st.mu.Unlock()
	if st.dirty {
		sortEvents(st.events)
		st.dirty = false
	}
	// Upload in progress and no new events have accumulated yet.
	// Returning (nil, false) lets GetSession fall through to S3 instead of
	// serving an empty replay during the upload window (up to 90 s).
	if st.finalizing && len(st.events) == 0 {
		return nil, false
	}
	if len(st.events) == 0 {
		// Do not claim "warm" with no data — let GetSession fall through to the S3 bundle path.
		return nil, false
	}
	cp := make([]map[string]interface{}, len(st.events))
	copy(cp, st.events)
	return []models.ReplayChunk{{Sequence: 0, Data: cp}}, true
}

// Remove drops a session from the spool without uploading (e.g. privacy delete).
func (m *Manager) Remove(siteID, sessionID string) {
	if siteID == "" || sessionID == "" {
		return
	}
	m.mu.Lock()
	delete(m.sessions, mapKey(siteID, sessionID))
	m.mu.Unlock()
}

// Run starts the idle finalizer until Stop is called or ctx ends.
func (m *Manager) Run(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-m.stop:
			return
		case <-ticker.C:
			m.tickFinalize(context.Background())
		}
	}
}

// Stop ends the Run loop; does not flush — call FlushAll for that.
func (m *Manager) Stop() {
	m.stopOnce.Do(func() { close(m.stop) })
}

// FlushAll finalizes every spooled session concurrently (used on shutdown).
// Sessions upload in parallel since the global finalizeMu was replaced with per-session locking.
func (m *Manager) FlushAll(ctx context.Context) {
	m.mu.RLock()
	keys := make([]string, 0, len(m.sessions))
	for k := range m.sessions {
		keys = append(keys, k)
	}
	m.mu.RUnlock()

	var wg sync.WaitGroup
	for _, k := range keys {
		wg.Add(1)
		k := k
		go func() {
			defer wg.Done()
			m.finalizeKey(ctx, k, true)
		}()
	}
	wg.Wait()
}

func (m *Manager) tickFinalize(ctx context.Context) {
	now := time.Now()
	m.mu.RLock()
	candidates := make([]string, 0, len(m.sessions))
	for k, st := range m.sessions {
		st.mu.Lock()
		idle := now.Sub(st.lastActivity)
		age := now.Sub(st.created)
		should := idle >= m.idleFlush || age >= m.maxAge
		st.mu.Unlock()
		if should {
			candidates = append(candidates, k)
		}
	}
	m.mu.RUnlock()
	for _, k := range candidates {
		m.finalizeKey(ctx, k, false)
	}
}

// finalizeKey uploads a snapshot; if force, runs even if idle timer not satisfied.
// Uses a per-session finalizing flag instead of a global mutex so concurrent sessions
// can upload in parallel without blocking each other.
func (m *Manager) finalizeKey(ctx context.Context, key string, force bool) {
	m.mu.RLock()
	st := m.sessions[key]
	m.mu.RUnlock()
	if st == nil {
		return
	}

	st.mu.Lock()
	// Another goroutine is already uploading this session — skip.
	if st.finalizing {
		st.mu.Unlock()
		return
	}
	now := time.Now()
	if !force && now.Sub(st.lastActivity) < m.idleFlush && now.Sub(st.created) < m.maxAge {
		st.mu.Unlock()
		return
	}
	if st.dirty {
		sortEvents(st.events)
		st.dirty = false
	}
	if len(st.events) == 0 {
		st.mu.Unlock()
		m.mu.Lock()
		if cur := m.sessions[key]; cur == st {
			delete(m.sessions, key)
		}
		m.mu.Unlock()
		return
	}
	toUpload := append([]map[string]interface{}(nil), st.events...)
	st.events = st.events[:0]
	siteID, sessionID := st.siteID, st.sessionID
	st.finalizing = true
	st.mu.Unlock()

	uploadCtx, cancel := context.WithTimeout(ctx, 90*time.Second)
	err := m.repo.UploadSessionBundleGzip(uploadCtx, siteID, sessionID, toUpload)
	cancel()

	st.mu.Lock()
	st.finalizing = false
	if err != nil {
		m.logger.Warn().Err(err).Str("session_id", sessionID).Str("site_id", siteID).Msg("replay spool: bundle upload failed")
		st.events = append(toUpload, st.events...)
		st.dirty = true
		st.mu.Unlock()
		return
	}
	if len(st.events) == 0 {
		st.mu.Unlock()
		m.mu.Lock()
		if cur := m.sessions[key]; cur == st {
			delete(m.sessions, key)
		}
		m.mu.Unlock()
		return
	}
	st.lastActivity = time.Now()
	st.created = time.Now()
	st.mu.Unlock()
}

func sortEvents(events []map[string]interface{}) {
	sort.SliceStable(events, func(i, j int) bool {
		ti, tj := utils.EventTimestampMs(events[i]), utils.EventTimestampMs(events[j])
		if ti != tj {
			return ti < tj
		}
		return i < j
	})
}
