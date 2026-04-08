// Package repository handles session replay storage.
// Metadata → Postgres.  Recording chunks → MinIO/S3.
package repository

import (
	"context"
	"fmt"
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
func (r *ReplayRepository) SaveChunk(ctx context.Context, websiteID, sessionID string, tsMs int64, events interface{}, meta *models.SessionMeta, pageIncrements, durationInBatch int, hasRageClicks bool) error {

	key := storage.SessionKey(websiteID, sessionID, tsMs)
	if err := r.s3.PutJSON(ctx, key, events); err != nil {
		return fmt.Errorf("replay upload: %w", err)
	}

	lastTs := time.UnixMilli(tsMs)

	// Robust UPSERT logic:
	// If the session row exists, we accumulate duration and page views.
	// has_rage_clicks is a latch — once true, never cleared.
	const q = `
		INSERT INTO session_replays (
			website_id, session_id, sequence, data,
			browser, device, os, country, entry_page,
			timestamp, pages_viewed, duration_seconds, has_rage_clicks
		)
		VALUES ($1, $2, 0, '{}', $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (website_id, session_id, sequence) DO UPDATE SET
			duration_seconds = GREATEST(session_replays.duration_seconds, $10, (EXTRACT(EPOCH FROM (EXCLUDED.timestamp - session_replays.timestamp))::INT + $10)),
			pages_viewed = session_replays.pages_viewed + EXCLUDED.pages_viewed,
			has_rage_clicks = CASE WHEN EXCLUDED.has_rage_clicks THEN TRUE ELSE session_replays.has_rage_clicks END,
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

	_, err := r.db.Exec(ctx, q, websiteID, sessionID, b, d, o, c, u, lastTs, pageIncrements, durationInBatch, hasRageClicks)
	return err
}

// ListSessions returns paginated session metadata.
func (r *ReplayRepository) ListSessions(ctx context.Context, siteID, websiteUUID string, limit, offset int) ([]models.Session, error) {
	const q = `
		SELECT 
			session_id, website_id,
			COALESCE(browser,''), COALESCE(device,''), COALESCE(os,''),
			COALESCE(country,''), COALESCE(entry_page,''),
			timestamp, has_rage_clicks, duration_seconds, pages_viewed
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
		if err := rows.Scan(&s.SessionID, &s.WebsiteID, &s.Browser, &s.Device, &s.OS, &s.Country, &s.EntryPage, &s.StartedAt, &s.HasRageClicks, &s.DurationSeconds, &s.PagesViewed); err != nil {
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
		timestamp, has_rage_clicks, duration_seconds, pages_viewed
		FROM session_replays
		WHERE (website_id=$1 OR website_id=$2) AND session_id=$3 AND sequence=0
		LIMIT 1`
	row := r.db.QueryRow(ctx, q, siteID, websiteUUID, sessionID)
	var s models.Session
	if err := row.Scan(&s.SessionID, &s.WebsiteID, &s.Browser, &s.Device, &s.OS,
		&s.Country, &s.EntryPage, &s.StartedAt, &s.HasRageClicks, &s.DurationSeconds, &s.PagesViewed); err != nil {
		return nil, err
	}

	return &s, nil
}

// GetChunks downloads all recording chunks for a session from S3, in timestamp order.
// Uses concurrent goroutines to avoid 15+ second load times on sessions with many chunks.
func (r *ReplayRepository) GetChunks(ctx context.Context, websiteID, sessionID string) ([]models.ReplayChunk, error) {
	prefix := storage.SessionPrefix(websiteID, sessionID)
	keys, err := r.s3.ListKeys(ctx, prefix)
	if err != nil {
		return nil, fmt.Errorf("replay list keys: %w", err)
	}
	if len(keys) == 0 {
		return nil, nil
	}

	// Concurrent fetch with bounded parallelism
	const maxWorkers = 20
	sem := make(chan struct{}, maxWorkers)

	type result struct {
		idx   int
		chunk models.ReplayChunk
		ok    bool
	}

	results := make([]result, len(keys))
	var wg sync.WaitGroup

	for i, key := range keys {
		wg.Add(1)
		go func(idx int, k string) {
			defer wg.Done()
			sem <- struct{}{}        // acquire
			defer func() { <-sem }() // release

			var events []map[string]interface{}
			if err := r.s3.GetJSON(ctx, k, &events); err != nil {
				r.logger.Warn().Err(err).Str("key", k).Msg("replay: failed to fetch chunk from S3, skipping")
				results[idx] = result{idx: idx, ok: false}
				return
			}
			results[idx] = result{idx: idx, chunk: models.ReplayChunk{Sequence: idx, Data: events}, ok: true}
		}(i, key)
	}
	wg.Wait()

	chunks := make([]models.ReplayChunk, 0, len(keys))
	for _, res := range results {
		if res.ok {
			chunks = append(chunks, res.chunk)
		}
	}
	return chunks, nil
}

// DeleteSession removes all S3 objects and the Postgres row for a session.
func (r *ReplayRepository) DeleteSession(ctx context.Context, websiteID, sessionID string) error {
	if err := r.s3.DeletePrefix(ctx, storage.SessionPrefix(websiteID, sessionID)); err != nil {
		return err
	}
	_, err := r.db.Exec(ctx, `DELETE FROM session_replays WHERE website_id=$1 AND session_id=$2`, websiteID, sessionID)
	return err
}
