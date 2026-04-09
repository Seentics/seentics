// Package repository handles session replay storage.
// Metadata → Postgres.  Recording chunks → MinIO/S3.
package repository

import (
	"context"
	"fmt"
	"path"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Seentics/seentics/internal/modules/replays/models"
	"github.com/Seentics/seentics/internal/shared/storage"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
)

type ReplayRepository struct {
	db     *pgxpool.Pool
	s3     *storage.S3Client
	logger zerolog.Logger
}

func New(db *pgxpool.Pool, s3 *storage.S3Client, logger zerolog.Logger) *ReplayRepository {
	return &ReplayRepository{db: db, s3: s3, logger: logger}
}

// SaveChunk writes one event batch for a session.
func (r *ReplayRepository) SaveChunk(ctx context.Context, websiteID, sessionID string, tsMs int64, events interface{}, meta *models.SessionMeta, pageIncrements, durationInBatch int, hasRageClicks, hasErrors bool) error {

	key := storage.SessionKey(websiteID, sessionID, tsMs)
	if err := r.s3.PutJSON(ctx, key, events); err != nil {
		return fmt.Errorf("replay upload: %w", err)
	}

	lastTs := time.UnixMilli(tsMs)

	// Robust UPSERT logic:
	// If the session row exists, we accumulate duration and page views.
	// has_rage_clicks / has_errors are latches — once true, never cleared.
	const q = `
		INSERT INTO session_replays (
			website_id, session_id, sequence, data,
			browser, device, os, country, entry_page,
			timestamp, pages_viewed, duration_seconds, has_rage_clicks, has_errors
		)
		VALUES ($1, $2, 0, '{}', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		ON CONFLICT (website_id, session_id, sequence) DO UPDATE SET
			duration_seconds = GREATEST(session_replays.duration_seconds, $10, (EXTRACT(EPOCH FROM (EXCLUDED.timestamp - session_replays.timestamp))::INT + $10)),
			pages_viewed = session_replays.pages_viewed + EXCLUDED.pages_viewed,
			has_rage_clicks = CASE WHEN EXCLUDED.has_rage_clicks THEN TRUE ELSE session_replays.has_rage_clicks END,
			has_errors = CASE WHEN EXCLUDED.has_errors THEN TRUE ELSE session_replays.has_errors END,
			browser = CASE WHEN EXCLUDED.browser <> '' THEN EXCLUDED.browser ELSE session_replays.browser END,
			device = CASE WHEN EXCLUDED.device <> '' THEN EXCLUDED.device ELSE session_replays.device END,
			os = CASE WHEN EXCLUDED.os <> '' THEN EXCLUDED.os ELSE session_replays.os END,
			country = CASE WHEN EXCLUDED.country <> '' THEN EXCLUDED.country ELSE session_replays.country END,
			entry_page = CASE WHEN EXCLUDED.entry_page <> '' THEN EXCLUDED.entry_page ELSE session_replays.entry_page END
	`

	var b, d, o, c, u string
	if meta != nil {
		b, d, o, c, u = meta.Browser, meta.Device, meta.OS, meta.Country, meta.EntryPage
	}

	_, err := r.db.Exec(ctx, q, websiteID, sessionID, b, d, o, c, u, lastTs, pageIncrements, durationInBatch, hasRageClicks, hasErrors)
	return err
}

// ListSessions returns paginated session metadata.
func (r *ReplayRepository) ListSessions(ctx context.Context, siteID, websiteUUID string, limit, offset int) ([]models.Session, error) {
	const q = `
		SELECT 
			session_id, website_id,
			COALESCE(browser,''), COALESCE(device,''), COALESCE(os,''),
			COALESCE(country,''), COALESCE(entry_page,''),
			timestamp, has_rage_clicks, has_errors, duration_seconds, pages_viewed
		FROM session_replays
		WHERE (website_id = $1 OR website_id = $2) AND sequence = 0
		ORDER BY timestamp DESC 
		LIMIT $3 OFFSET $4`
	rows, err := r.db.Query(ctx, q, siteID, websiteUUID, limit, offset)

	if err != nil {
		return nil, fmt.Errorf("replay list: %w", err)
	}
	defer rows.Close()
	var out []models.Session
	for rows.Next() {
		var s models.Session
		if err := rows.Scan(&s.SessionID, &s.WebsiteID, &s.Browser, &s.Device, &s.OS, &s.Country, &s.EntryPage, &s.StartedAt, &s.HasRageClicks, &s.HasErrors, &s.DurationSeconds, &s.PagesViewed); err != nil {
			return nil, err
		}

		out = append(out, s)
	}
	return out, rows.Err()
}

// GetSessionMeta returns the Postgres metadata row for a single session.
func (r *ReplayRepository) GetSessionMeta(ctx context.Context, siteID, websiteUUID, sessionID string) (*models.Session, error) {
	const q = `SELECT session_id, website_id,
		COALESCE(browser,''), COALESCE(device,''), COALESCE(os,''),
		COALESCE(country,''), COALESCE(entry_page,''),
		timestamp, has_rage_clicks, has_errors, duration_seconds, pages_viewed
		FROM session_replays
		WHERE (website_id=$1 OR website_id=$2) AND session_id=$3 AND sequence=0
		LIMIT 1`
	row := r.db.QueryRow(ctx, q, siteID, websiteUUID, sessionID)
	var s models.Session
	if err := row.Scan(&s.SessionID, &s.WebsiteID, &s.Browser, &s.Device, &s.OS,
		&s.Country, &s.EntryPage, &s.StartedAt, &s.HasRageClicks, &s.HasErrors, &s.DurationSeconds, &s.PagesViewed); err != nil {
		return nil, err
	}

	return &s, nil
}

// parseReplayChunkSortKey extracts ordering from a chunk filename (with or without ".json").
// Legacy keys: {tsMs:016d}.json — secondary is 0.
// New keys:    {tsMs:016d}_{wallNanos:020d}.json — secondary disambiguates same tsMs.
func parseReplayChunkSortKey(base string) (primaryMs int64, secondary int64) {
	base = strings.TrimSuffix(base, ".json")
	if i := strings.LastIndex(base, "_"); i > 0 && i < len(base)-1 {
		p1, e1 := strconv.ParseInt(base[:i], 10, 64)
		p2, e2 := strconv.ParseInt(base[i+1:], 10, 64)
		if e1 == nil && e2 == nil {
			return p1, p2
		}
	}
	pri, _ := strconv.ParseInt(base, 10, 64)
	return pri, 0
}

func replayChunkKeyLess(a, b string) bool {
	pa, sa := parseReplayChunkSortKey(path.Base(a))
	pb, sb := parseReplayChunkSortKey(path.Base(b))
	if pa != pb {
		return pa < pb
	}
	if sa != sb {
		return sa < sb
	}
	return a < b
}

// GetChunks downloads all recording chunks for a session from S3, in ingest order.
// Uses concurrent goroutines to avoid 15+ second load times on sessions with many chunks.
// Any missing or failing chunk fails the whole read so playback never runs on a partial/holed stream.
func (r *ReplayRepository) GetChunks(ctx context.Context, websiteID, sessionID string) ([]models.ReplayChunk, error) {
	prefix := storage.SessionPrefix(websiteID, sessionID)
	keys, err := r.s3.ListKeys(ctx, prefix)
	if err != nil {
		return nil, fmt.Errorf("replay list keys: %w", err)
	}
	if len(keys) == 0 {
		return nil, nil
	}
	sort.Slice(keys, func(i, j int) bool { return replayChunkKeyLess(keys[i], keys[j]) })

	// Concurrent fetch with bounded parallelism
	const maxWorkers = 20
	sem := make(chan struct{}, maxWorkers)

	type fetchResult struct {
		events []map[string]interface{}
		err    error
	}

	results := make([]fetchResult, len(keys))
	var wg sync.WaitGroup

	for i, key := range keys {
		wg.Add(1)
		go func(idx int, k string) {
			defer wg.Done()
			sem <- struct{}{}        // acquire
			defer func() { <-sem }() // release

			var events []map[string]interface{}
			if err := r.s3.GetJSONWithRetry(ctx, k, &events); err != nil {
				results[idx] = fetchResult{err: fmt.Errorf("%s: %w", k, err)}
				return
			}
			results[idx] = fetchResult{events: events}
		}(i, key)
	}
	wg.Wait()

	chunks := make([]models.ReplayChunk, len(keys))
	for i := range keys {
		if results[i].err != nil {
			return nil, fmt.Errorf("replay fetch chunk: %w", results[i].err)
		}
		chunks[i] = models.ReplayChunk{Sequence: i, Data: results[i].events}
	}
	return chunks, nil
}

// DeleteSessionChunks removes all replay JSON chunks for a session from object storage only.
// Used by retention and privacy jobs before deleting Postgres metadata in bulk.
func (r *ReplayRepository) DeleteSessionChunks(ctx context.Context, websiteID, sessionID string) error {
	if r.s3 == nil {
		return nil
	}
	return r.s3.DeletePrefix(ctx, storage.SessionPrefix(websiteID, sessionID))
}

// DeleteSession removes all S3 objects and the Postgres row for a session.
func (r *ReplayRepository) DeleteSession(ctx context.Context, websiteID, sessionID string) error {
	if err := r.DeleteSessionChunks(ctx, websiteID, sessionID); err != nil {
		return err
	}
	_, err := r.db.Exec(ctx, `DELETE FROM session_replays WHERE website_id=$1 AND session_id=$2`, websiteID, sessionID)
	return err
}
