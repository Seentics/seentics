package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/Seentics/seentics/internal/modules/replays/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ReplayRepository interface {
	SaveChunk(ctx context.Context, websiteID, sessionID string, data json.RawMessage, sequence int, meta *models.SessionMeta) error
	GetChunks(ctx context.Context, websiteID, sessionID string) ([]models.SessionReplayChunk, error)
	GetChunkSequences(ctx context.Context, websiteID, sessionID string) ([]int, error)
	// ListSessionsWithMetadata returns sessions ordered by start_time DESC.
	// before: optional cursor — only sessions whose start_time < before are returned.
	// Returns the sessions, the total session count for the website (for pagination UI), and any error.
	ListSessionsWithMetadata(ctx context.Context, websiteID string, limit int, before *time.Time) ([]models.ReplaySessionMetadata, int64, error)
	DeleteSessionReplay(ctx context.Context, websiteID, sessionID string) ([]string, error)
	BulkDeleteReplays(ctx context.Context, websiteID string, sessionIDs []string) ([]string, error)
	DeleteAllByWebsiteID(ctx context.Context, websiteID string) ([]string, error)
	GetPageSnapshot(ctx context.Context, websiteID, siteID, url string) (json.RawMessage, error)
	FindSessionIDForPage(ctx context.Context, websiteID, url string) (string, error)
	SessionExists(ctx context.Context, websiteID, sessionID string) (bool, error)
	// CountSessionsForUser counts distinct sessions across ALL websites owned by the given user.
	// Used for global quota enforcement across multi-website accounts.
	CountSessionsForUser(ctx context.Context, userID uuid.UUID) (int64, error)
	// GetUnprocessedSessions returns up to limit sessions whose root chunk (sequence=0)
	// was recorded before olderThan and has not yet been processed for rage-clicks.
	GetUnprocessedSessions(ctx context.Context, olderThan time.Time, limit int) ([]models.UnprocessedSession, error)
	// MarkRageClicksProcessed records the result of rage-click detection for a session.
	MarkRageClicksProcessed(ctx context.Context, websiteID, sessionID string, hasRageClicks bool) error
}

type replayRepository struct {
	db *pgxpool.Pool
}

func NewReplayRepository(db *pgxpool.Pool) ReplayRepository {
	return &replayRepository{db: db}
}

func (r *replayRepository) SaveChunk(ctx context.Context, websiteID, sessionID string, data json.RawMessage, sequence int, meta *models.SessionMeta) error {
	if meta != nil {
		query := `
			INSERT INTO session_replays (website_id, session_id, data, sequence, browser, device, os, country, entry_page)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			ON CONFLICT (website_id, session_id, sequence) DO NOTHING
		`
		_, err := r.db.Exec(ctx, query,
			websiteID, sessionID, data, sequence,
			meta.Browser, meta.Device, meta.OS, meta.Country, meta.EntryPage,
		)
		return err
	}

	query := `
		INSERT INTO session_replays (website_id, session_id, data, sequence)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (website_id, session_id, sequence) DO NOTHING
	`
	_, err := r.db.Exec(ctx, query, websiteID, sessionID, data, sequence)
	return err
}

func (r *replayRepository) GetChunks(ctx context.Context, websiteID, sessionID string) ([]models.SessionReplayChunk, error) {
	query := `
		SELECT id, website_id, session_id, data, sequence, timestamp, created_at
		FROM session_replays
		WHERE website_id = $1 AND session_id = $2
		ORDER BY sequence ASC
	`
	rows, err := r.db.Query(ctx, query, websiteID, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var chunks []models.SessionReplayChunk
	for rows.Next() {
		var c models.SessionReplayChunk
		if err := rows.Scan(&c.ID, &c.WebsiteID, &c.SessionID, &c.Data, &c.Sequence, &c.Timestamp, &c.CreatedAt); err != nil {
			return nil, err
		}
		chunks = append(chunks, c)
	}

	return chunks, nil
}

func (r *replayRepository) GetChunkSequences(ctx context.Context, websiteID, sessionID string) ([]int, error) {
	query := `
		SELECT sequence
		FROM session_replays
		WHERE website_id = $1 AND session_id = $2
		ORDER BY sequence ASC
	`
	rows, err := r.db.Query(ctx, query, websiteID, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var seqs []int
	for rows.Next() {
		var s int
		if err := rows.Scan(&s); err != nil {
			return nil, err
		}
		seqs = append(seqs, s)
	}
	return seqs, nil
}

func (r *replayRepository) ListSessionsWithMetadata(ctx context.Context, websiteID string, limit int, before *time.Time) ([]models.ReplaySessionMetadata, int64, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	// Total distinct sessions for this website (for pagination UI).
	var total int64
	countErr := r.db.QueryRow(ctx,
		`SELECT COUNT(DISTINCT session_id) FROM session_replays WHERE website_id = $1`,
		websiteID,
	).Scan(&total)
	if countErr != nil {
		total = 0
	}

	// Use CTEs to:
	// 1) compute duration & chunk_count per session
	// 2) pick the first chunk per session (lowest sequence) for metadata
	const baseSelect = `
		WITH chunk_stats AS (
			SELECT
				session_id,
				EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp)))::float8 AS duration,
				COUNT(*)::int AS chunk_count
			FROM session_replays
			WHERE website_id = $1
			GROUP BY session_id
		),
		first_chunks AS (
			SELECT DISTINCT ON (session_id)
				session_id, timestamp, browser, device, os, country, entry_page, has_rage_clicks
			FROM session_replays
			WHERE website_id = $1
			ORDER BY session_id, sequence ASC
		)
		SELECT
			r.session_id,
			r.timestamp AS start_time,
			r.timestamp AS end_time,
			COALESCE(cs.duration, 0) AS duration,
			COALESCE(cs.chunk_count, 1) AS chunk_count,
			COALESCE(NULLIF(r.browser, ''), 'Unknown') AS browser,
			COALESCE(NULLIF(r.device, ''), 'Unknown') AS device,
			COALESCE(NULLIF(r.os, ''), 'Unknown') AS os,
			COALESCE(NULLIF(r.country, ''), 'Unknown') AS country,
			COALESCE(NULLIF(r.entry_page, ''), 'Unknown') AS entry_page,
			COALESCE(r.has_rage_clicks, false) AS has_rage_clicks
		FROM first_chunks r
		LEFT JOIN chunk_stats cs ON r.session_id = cs.session_id
		WHERE 1=1
	`

	var (
		rows pgx.Rows
		err  error
	)

	if before != nil {
		rows, err = r.db.Query(ctx,
			baseSelect+` AND r.timestamp < $2 ORDER BY r.timestamp DESC LIMIT $3`,
			websiteID, *before, limit,
		)
	} else {
		rows, err = r.db.Query(ctx,
			baseSelect+` ORDER BY r.timestamp DESC LIMIT $2`,
			websiteID, limit,
		)
	}

	if err != nil {
		return nil, total, err
	}
	defer rows.Close()

	var sessions []models.ReplaySessionMetadata
	for rows.Next() {
		var s models.ReplaySessionMetadata
		if err := rows.Scan(
			&s.SessionID, &s.StartTime, &s.EndTime, &s.Duration, &s.ChunkCount,
			&s.Browser, &s.Device, &s.OS, &s.Country, &s.EntryPage, &s.HasRageClicks,
		); err != nil {
			return nil, total, err
		}
		s.WebsiteID = websiteID
		sessions = append(sessions, s)
	}

	return sessions, total, nil
}

// DeleteSessionReplay removes all DB rows and returns the S3 keys that should be deleted.
func (r *replayRepository) DeleteSessionReplay(ctx context.Context, websiteID, sessionID string) ([]string, error) {
	seqRows, err := r.db.Query(ctx,
		`SELECT sequence FROM session_replays WHERE website_id = $1 AND session_id = $2`,
		websiteID, sessionID,
	)
	if err != nil {
		return nil, err
	}
	defer seqRows.Close()

	var sequences []int
	for seqRows.Next() {
		var seq int
		if err := seqRows.Scan(&seq); err != nil {
			return nil, err
		}
		sequences = append(sequences, seq)
	}

	if _, err := r.db.Exec(ctx,
		`DELETE FROM session_replays WHERE website_id = $1 AND session_id = $2`,
		websiteID, sessionID,
	); err != nil {
		return nil, err
	}

	keys := make([]string, 0, len(sequences)*2+2)
	for _, seq := range sequences {
		keys = append(keys, fmt.Sprintf("replays/%s/%s/%d.json.gz", websiteID, sessionID, seq))
		keys = append(keys, fmt.Sprintf("replays/%s/%s/%d.json", websiteID, sessionID, seq))
	}
	// Also delete the stitched full-replay cache if it exists
	keys = append(keys,
		fmt.Sprintf("replays/%s/%s/full.json.gz", websiteID, sessionID),
	)
	return keys, nil
}

func (r *replayRepository) GetPageSnapshot(ctx context.Context, websiteID, siteID, url string) (json.RawMessage, error) {
	return nil, nil
}

func (r *replayRepository) FindSessionIDForPage(ctx context.Context, websiteID, url string) (string, error) {
	query := `
		SELECT session_id
		FROM session_replays
		WHERE website_id = $1 AND entry_page = $2
		ORDER BY timestamp DESC
		LIMIT 1
	`
	var sessionID string
	err := r.db.QueryRow(ctx, query, websiteID, url).Scan(&sessionID)
	if err != nil {
		return "", err
	}
	return sessionID, nil
}

func (r *replayRepository) BulkDeleteReplays(ctx context.Context, websiteID string, sessionIDs []string) ([]string, error) {
	if len(sessionIDs) == 0 {
		return nil, nil
	}

	query := `SELECT session_id, sequence FROM session_replays WHERE website_id = $1 AND session_id = ANY($2)`
	rows, err := r.db.Query(ctx, query, websiteID, sessionIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []string
	for rows.Next() {
		var sID string
		var seq int
		if err := rows.Scan(&sID, &seq); err != nil {
			return nil, err
		}
		keys = append(keys, fmt.Sprintf("replays/%s/%s/%d.json.gz", websiteID, sID, seq))
		keys = append(keys, fmt.Sprintf("replays/%s/%s/%d.json", websiteID, sID, seq))
	}
	// Add full-replay cache keys
	for _, sID := range sessionIDs {
		keys = append(keys, fmt.Sprintf("replays/%s/%s/full.json.gz", websiteID, sID))
	}

	deleteQuery := `DELETE FROM session_replays WHERE website_id = $1 AND session_id = ANY($2)`
	if _, err := r.db.Exec(ctx, deleteQuery, websiteID, sessionIDs); err != nil {
		return nil, err
	}

	return keys, nil
}

func (r *replayRepository) DeleteAllByWebsiteID(ctx context.Context, websiteID string) ([]string, error) {
	query := `SELECT session_id, sequence FROM session_replays WHERE website_id = $1`
	rows, err := r.db.Query(ctx, query, websiteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []string
	seen := map[string]bool{}
	for rows.Next() {
		var sID string
		var seq int
		if err := rows.Scan(&sID, &seq); err != nil {
			return nil, err
		}
		keys = append(keys, fmt.Sprintf("replays/%s/%s/%d.json.gz", websiteID, sID, seq))
		keys = append(keys, fmt.Sprintf("replays/%s/%s/%d.json", websiteID, sID, seq))
		if !seen[sID] {
			seen[sID] = true
			keys = append(keys, fmt.Sprintf("replays/%s/%s/full.json.gz", websiteID, sID))
		}
	}

	_, err = r.db.Exec(ctx, `DELETE FROM session_replays WHERE website_id = $1`, websiteID)
	if err != nil {
		return nil, err
	}

	return keys, nil
}

func (r *replayRepository) SessionExists(ctx context.Context, websiteID, sessionID string) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM session_replays WHERE website_id = $1 AND session_id = $2)`
	err := r.db.QueryRow(ctx, query, websiteID, sessionID).Scan(&exists)
	return exists, err
}

// CountSessionsForUser counts distinct sessions in the current billing month
// across every website owned by userID for quota enforcement.
func (r *replayRepository) CountSessionsForUser(ctx context.Context, userID uuid.UUID) (int64, error) {
	var count int64
	now := time.Now().UTC()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	query := `
		SELECT COUNT(DISTINCT sr.session_id)
		FROM session_replays sr
		JOIN websites w ON sr.website_id = w.site_id
		WHERE w.user_id = $1 AND sr.timestamp >= $2
	`
	err := r.db.QueryRow(ctx, query, userID, startOfMonth).Scan(&count)
	return count, err
}

// GetUnprocessedSessions returns sessions whose root chunk was recorded before
// olderThan and has not yet been scanned for rage clicks.
func (r *replayRepository) GetUnprocessedSessions(ctx context.Context, olderThan time.Time, limit int) ([]models.UnprocessedSession, error) {
	query := `
		SELECT DISTINCT ON (session_id) website_id, session_id, timestamp
		FROM session_replays
		WHERE rage_clicks_processed = FALSE
		  AND timestamp < $1
		ORDER BY session_id, timestamp ASC
		LIMIT $2
	`
	rows, err := r.db.Query(ctx, query, olderThan, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []models.UnprocessedSession
	for rows.Next() {
		var s models.UnprocessedSession
		if err := rows.Scan(&s.WebsiteID, &s.SessionID, &s.Timestamp); err != nil {
			return nil, err
		}
		sessions = append(sessions, s)
	}
	return sessions, nil
}

// MarkRageClicksProcessed records the result of rage-click detection for a session.
// Updates all chunks so the worker skips the entire session on future scans.
func (r *replayRepository) MarkRageClicksProcessed(ctx context.Context, websiteID, sessionID string, hasRageClicks bool) error {
	_, err := r.db.Exec(ctx, `
		UPDATE session_replays
		SET has_rage_clicks       = $1,
		    rage_clicks_processed = TRUE
		WHERE website_id = $2
		  AND session_id = $3
	`, hasRageClicks, websiteID, sessionID)
	return err
}
