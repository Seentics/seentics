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

// SaveChunk writes one event batch for a session (S3 + Postgres in one call).
// Kept for compatibility — new code should use UploadChunk + UpsertSessionMetaBatch.
func (r *ReplayRepository) SaveChunk(ctx context.Context, websiteID, sessionID string, tsMs int64, events interface{}, meta *models.SessionMeta, pageIncrements, durationInBatch int, hasRageClicks, hasErrors bool) error {
	if err := r.UploadChunk(ctx, websiteID, sessionID, tsMs, events); err != nil {
		return err
	}
	var b, d, o, c, u string
	if meta != nil {
		b, d, o, c, u = meta.Browser, meta.Device, meta.OS, meta.Country, meta.EntryPage
	}
	return r.UpsertSessionMetaBatch(ctx, []SessionUpsertRow{{
		WebsiteID:       websiteID,
		SessionID:       sessionID,
		TsMs:            tsMs,
		Browser:         b,
		Device:          d,
		OS:              o,
		Country:         c,
		EntryPage:       u,
		PageIncrements:  pageIncrements,
		DurationSeconds: durationInBatch,
		HasRageClicks:   hasRageClicks,
		HasErrors:       hasErrors,
	}})
}

// UploadChunk writes the events JSON to S3 only — no Postgres touch.
func (r *ReplayRepository) UploadChunk(ctx context.Context, websiteID, sessionID string, tsMs int64, events interface{}) error {
	key := storage.SessionKey(websiteID, sessionID, tsMs)
	if err := r.s3.PutJSON(ctx, key, events); err != nil {
		return fmt.Errorf("replay upload: %w", err)
	}
	return nil
}

// SessionUpsertRow holds everything needed for one row in UpsertSessionMetaBatch.
type SessionUpsertRow struct {
	WebsiteID       string
	SessionID       string
	TsMs            int64
	Browser         string
	Device          string
	OS              string
	Country         string
	EntryPage       string
	PageIncrements  int
	DurationSeconds int
	HasRageClicks   bool
	HasErrors       bool
}

// UpsertSessionMetaBatch upserts up to N session metadata rows in a single Postgres
// round-trip using unnest arrays — drastically fewer queries vs. one UPSERT per row.
func (r *ReplayRepository) UpsertSessionMetaBatch(ctx context.Context, rows []SessionUpsertRow) error {
	if len(rows) == 0 {
		return nil
	}

	websiteIDs := make([]string, len(rows))
	sessionIDs := make([]string, len(rows))
	timestamps := make([]time.Time, len(rows))
	browsers := make([]string, len(rows))
	devices := make([]string, len(rows))
	oss := make([]string, len(rows))
	countries := make([]string, len(rows))
	entryPages := make([]string, len(rows))
	pageIncs := make([]int32, len(rows))
	durations := make([]int32, len(rows))
	rageClicks := make([]bool, len(rows))
	hasErrors := make([]bool, len(rows))

	for i, row := range rows {
		websiteIDs[i] = row.WebsiteID
		sessionIDs[i] = row.SessionID
		timestamps[i] = time.UnixMilli(row.TsMs)
		browsers[i] = row.Browser
		devices[i] = row.Device
		oss[i] = row.OS
		countries[i] = row.Country
		entryPages[i] = row.EntryPage
		pageIncs[i] = int32(row.PageIncrements)
		durations[i] = int32(row.DurationSeconds)
		rageClicks[i] = row.HasRageClicks
		hasErrors[i] = row.HasErrors
	}

	const q = `
		INSERT INTO session_replays (
			website_id, session_id, sequence, data,
			browser, device, os, country, entry_page,
			timestamp, pages_viewed, duration_seconds, has_rage_clicks, has_errors
		)
		SELECT
			unnest($1::text[]),  -- website_id
			unnest($2::text[]),  -- session_id
			0,                   -- sequence (always 0 for metadata row)
			'{}',                -- data placeholder
			unnest($3::text[]),  -- browser
			unnest($4::text[]),  -- device
			unnest($5::text[]),  -- os
			unnest($6::text[]),  -- country
			unnest($7::text[]),  -- entry_page
			unnest($8::timestamptz[]),  -- timestamp
			unnest($9::int[]),   -- pages_viewed
			unnest($10::int[]),  -- duration_seconds
			unnest($11::bool[]), -- has_rage_clicks
			unnest($12::bool[])  -- has_errors
		ON CONFLICT (website_id, session_id, sequence) DO UPDATE SET
			duration_seconds  = GREATEST(
				session_replays.duration_seconds,
				EXCLUDED.duration_seconds,
				(EXTRACT(EPOCH FROM (EXCLUDED.timestamp - session_replays.timestamp))::INT + EXCLUDED.duration_seconds)
			),
			pages_viewed      = session_replays.pages_viewed + EXCLUDED.pages_viewed,
			has_rage_clicks   = CASE WHEN EXCLUDED.has_rage_clicks THEN TRUE ELSE session_replays.has_rage_clicks END,
			has_errors        = CASE WHEN EXCLUDED.has_errors      THEN TRUE ELSE session_replays.has_errors      END,
			browser           = CASE WHEN EXCLUDED.browser    <> '' THEN EXCLUDED.browser    ELSE session_replays.browser    END,
			device            = CASE WHEN EXCLUDED.device     <> '' THEN EXCLUDED.device     ELSE session_replays.device     END,
			os                = CASE WHEN EXCLUDED.os         <> '' THEN EXCLUDED.os         ELSE session_replays.os         END,
			country           = CASE WHEN EXCLUDED.country    <> '' THEN EXCLUDED.country    ELSE session_replays.country    END,
			entry_page        = CASE WHEN EXCLUDED.entry_page <> '' THEN EXCLUDED.entry_page ELSE session_replays.entry_page END
	`

	_, err := r.db.Exec(ctx, q,
		websiteIDs, sessionIDs,
		browsers, devices, oss, countries, entryPages,
		timestamps, pageIncs, durations, rageClicks, hasErrors,
	)
	if err != nil {
		return fmt.Errorf("replay upsert batch(%d): %w", len(rows), err)
	}
	return nil
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
