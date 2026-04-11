// Package repository handles session replay storage.
// Metadata → Postgres.  Recording chunks → MinIO/S3.
package repository

import (
	"context"
	"fmt"
	"hash/fnv"
	"sort"
	"sync"
	"time"

	"github.com/Seentics/seentics/internal/modules/replays/models"
	"github.com/Seentics/seentics/internal/shared/storage"
	"github.com/Seentics/seentics/internal/shared/utils"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
)

type ReplayRepository struct {
	db     *pgxpool.Pool
	s3     *storage.S3Client
	logger zerolog.Logger
	// bundleShard serializes read-modify-write bundle merges for keys mapping to the same slot.
	// Same session always shares a slot; different sessions may share one (less parallelism, safe).
	bundleShard [32]sync.Mutex
}

func New(db *pgxpool.Pool, s3 *storage.S3Client, logger zerolog.Logger) *ReplayRepository {
	return &ReplayRepository{db: db, s3: s3, logger: logger}
}

// SessionUpsertRow holds everything needed for one row in UpsertSessionMetaBatch.
type SessionUpsertRow struct {
	WebsiteID       string
	SessionID       string
	TsMs            int64
	// LatestEventMs is the max tracker envelope ts (epoch ms) in this batch — used so duration_seconds
	// tracks (latest_event - session_start) without double-counting batch spans.
	LatestEventMs   int64
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
	dataJSON := make([]string, len(rows))

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
		endMs := row.LatestEventMs
		if endMs == 0 {
			endMs = row.TsMs
		}
		dataJSON[i] = fmt.Sprintf(`{"_snc_re_end":%d}`, endMs)
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
			unnest($13::text[])::jsonb,
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
				GREATEST(0, EXTRACT(EPOCH FROM (
					COALESCE(
						CASE WHEN EXCLUDED.data ? '_snc_re_end' THEN
							to_timestamp((EXCLUDED.data->>'_snc_re_end')::bigint / 1000.0)
						ELSE NULL END,
						EXCLUDED.timestamp
					) - session_replays.timestamp
				))::INT)
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
		dataJSON,
	)
	if err != nil {
		return fmt.Errorf("replay upsert batch(%d): %w", len(rows), err)
	}
	return nil
}

// CountDistinctReplaySessionsSince counts distinct replay sessions for the user's sites since `since` (UTC calendar month boundary for billing caps).
func (r *ReplayRepository) CountDistinctReplaySessionsSince(ctx context.Context, siteIDs, uuidStrings []string, since time.Time) (int, error) {
	if len(siteIDs) == 0 {
		return 0, nil
	}
	var n int
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(DISTINCT session_id) FROM session_replays
		WHERE (website_id = ANY($1) OR website_id = ANY($2)) AND timestamp >= $3`,
		siteIDs, uuidStrings, since,
	).Scan(&n)
	return n, err
}

// CountNewReplaySessionsInBatch returns how many distinct session IDs in batchSessionIDs
// are not yet present in session_replays for those sites since `since`.
func (r *ReplayRepository) CountNewReplaySessionsInBatch(ctx context.Context, siteIDs, uuidStrings []string, since time.Time, batchSessionIDs []string) (int, error) {
	if len(siteIDs) == 0 || len(batchSessionIDs) == 0 {
		return 0, nil
	}
	seen := make(map[string]struct{}, len(batchSessionIDs))
	uniq := make([]string, 0, len(batchSessionIDs))
	for _, sid := range batchSessionIDs {
		if sid == "" {
			continue
		}
		if _, ok := seen[sid]; ok {
			continue
		}
		seen[sid] = struct{}{}
		uniq = append(uniq, sid)
	}
	if len(uniq) == 0 {
		return 0, nil
	}
	var n int
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM unnest($1::text[]) AS x(sid)
		WHERE NOT EXISTS (
			SELECT 1 FROM session_replays sr
			WHERE sr.session_id = x.sid
			  AND (sr.website_id = ANY($2) OR sr.website_id = ANY($3))
			  AND sr.timestamp >= $4
		)`,
		uniq, siteIDs, uuidStrings, since,
	).Scan(&n)
	return n, err
}

// ListSessions returns paginated session metadata.
// Uses UNION ALL so each branch can use the partial index on website_id directly,
// avoiding a bitmap OR scan on the leading index column.
func (r *ReplayRepository) ListSessions(ctx context.Context, siteID, websiteUUID string, limit, offset int) ([]models.Session, error) {
	const q = `
		SELECT session_id, website_id,
			COALESCE(browser,''), COALESCE(device,''), COALESCE(os,''),
			COALESCE(country,''), COALESCE(entry_page,''),
			timestamp, has_rage_clicks, has_errors, duration_seconds, pages_viewed
		FROM session_replays
		WHERE website_id = $1 AND sequence = 0
		UNION ALL
		SELECT session_id, website_id,
			COALESCE(browser,''), COALESCE(device,''), COALESCE(os,''),
			COALESCE(country,''), COALESCE(entry_page,''),
			timestamp, has_rage_clicks, has_errors, duration_seconds, pages_viewed
		FROM session_replays
		WHERE website_id = $2 AND sequence = 0 AND $2 <> $1
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
	const q = `
		SELECT session_id, website_id,
			COALESCE(browser,''), COALESCE(device,''), COALESCE(os,''),
			COALESCE(country,''), COALESCE(entry_page,''),
			timestamp, has_rage_clicks, has_errors, duration_seconds, pages_viewed
		FROM session_replays
		WHERE website_id=$1 AND session_id=$2 AND sequence=0
		UNION ALL
		SELECT session_id, website_id,
			COALESCE(browser,''), COALESCE(device,''), COALESCE(os,''),
			COALESCE(country,''), COALESCE(entry_page,''),
			timestamp, has_rage_clicks, has_errors, duration_seconds, pages_viewed
		FROM session_replays
		WHERE website_id=$3 AND session_id=$2 AND sequence=0 AND $3 <> $1
		LIMIT 1`
	row := r.db.QueryRow(ctx, q, siteID, sessionID, websiteUUID)
	var s models.Session
	if err := row.Scan(&s.SessionID, &s.WebsiteID, &s.Browser, &s.Device, &s.OS,
		&s.Country, &s.EntryPage, &s.StartedAt, &s.HasRageClicks, &s.HasErrors, &s.DurationSeconds, &s.PagesViewed); err != nil {
		return nil, err
	}

	return &s, nil
}

func sortReplayEvents(events []map[string]interface{}) {
	sort.SliceStable(events, func(i, j int) bool {
		return utils.EventTimestampMs(events[i]) < utils.EventTimestampMs(events[j])
	})
}

func (r *ReplayRepository) bundleMergeLock(bundleKey string) *sync.Mutex {
	h := fnv.New32a()
	_, _ = h.Write([]byte(bundleKey))
	return &r.bundleShard[h.Sum32()%uint32(len(r.bundleShard))]
}

// UploadSessionBundleGzip merges newEvents with an existing bundle object (if any),
// sorts by event ts, and writes one gzip JSON array to R2/S3.
func (r *ReplayRepository) UploadSessionBundleGzip(ctx context.Context, websiteID, sessionID string, newEvents []map[string]interface{}) error {
	if r.s3 == nil {
		return fmt.Errorf("replay bundle: s3 client nil")
	}
	if len(newEvents) == 0 {
		return nil
	}
	bundleKey := storage.SessionBundleKey(websiteID, sessionID)
	mu := r.bundleMergeLock(bundleKey)
	mu.Lock()
	defer mu.Unlock()

	exists, err := r.s3.ObjectExists(ctx, bundleKey)
	if err != nil {
		return fmt.Errorf("replay bundle head: %w", err)
	}
	var merged []map[string]interface{}
	if exists {
		if err := r.s3.GetJSONGzipWithRetry(ctx, bundleKey, &merged); err != nil {
			return fmt.Errorf("replay bundle get existing: %w", err)
		}
	}
	merged = append(merged, newEvents...)
	sortReplayEvents(merged)
	if err := r.s3.PutGzipJSON(ctx, bundleKey, merged); err != nil {
		return fmt.Errorf("replay bundle put: %w", err)
	}
	return nil
}

// ReplayBundleExists reports whether a finalized gzip bundle exists for the session.
func (r *ReplayRepository) ReplayBundleExists(ctx context.Context, websiteID, sessionID string) (bool, error) {
	if r.s3 == nil {
		return false, fmt.Errorf("replay bundle: s3 client nil")
	}
	key := storage.SessionBundleKey(websiteID, sessionID)
	return r.s3.ObjectExists(ctx, key)
}

// LocateReplayBundle returns the object key for an existing gzip bundle, checking site id first
// then website UUID (metadata may be stored under either form).
func (r *ReplayRepository) LocateReplayBundle(ctx context.Context, siteID, uuidStr, sessionID string) (string, error) {
	if r.s3 == nil {
		return "", fmt.Errorf("replay bundle: s3 client nil")
	}
	keys := []string{storage.SessionBundleKey(siteID, sessionID)}
	if uuidStr != "" && uuidStr != siteID {
		keys = append(keys, storage.SessionBundleKey(uuidStr, sessionID))
	}
	var firstErr error
	for _, key := range keys {
		ok, err := r.s3.ObjectExists(ctx, key)
		if err != nil {
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		if ok {
			return key, nil
		}
	}
	if firstErr != nil {
		return "", firstErr
	}
	return "", nil
}

// PresignReplayObject returns a time-limited GET URL for an already-resolved bundle key.
func (r *ReplayRepository) PresignReplayObject(ctx context.Context, key string, exp time.Duration) (string, error) {
	if r.s3 == nil {
		return "", fmt.Errorf("replay bundle: s3 client nil")
	}
	if key == "" {
		return "", fmt.Errorf("replay bundle: empty key")
	}
	return r.s3.PresignGetObject(ctx, key, exp)
}

// PresignReplayBundle returns a time-limited GET URL for the session bundle (browser loads R2/S3 directly).
func (r *ReplayRepository) PresignReplayBundle(ctx context.Context, websiteID, sessionID string, exp time.Duration) (string, error) {
	if r.s3 == nil {
		return "", fmt.Errorf("replay bundle: s3 client nil")
	}
	key := storage.SessionBundleKey(websiteID, sessionID)
	return r.s3.PresignGetObject(ctx, key, exp)
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

// DeleteSessionByEitherID deletes S3 objects (keyed by primaryID) and all Postgres rows
// matching either primaryID or fallbackID for the session. This handles the case where
// the row may have been written under a siteID or a UUID interchangeably.
func (r *ReplayRepository) DeleteSessionByEitherID(ctx context.Context, primaryID, fallbackID, sessionID string) error {
	if err := r.DeleteSessionChunks(ctx, primaryID, sessionID); err != nil {
		return err
	}
	_, err := r.db.Exec(ctx,
		`DELETE FROM session_replays WHERE (website_id=$1 OR website_id=$2) AND session_id=$3`,
		primaryID, fallbackID, sessionID)
	return err
}
