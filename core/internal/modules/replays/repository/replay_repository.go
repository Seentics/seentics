package repository

import (
	"analytics-app/internal/modules/replays/models"
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ReplayRepository interface {
	SaveChunk(ctx context.Context, websiteID, sessionID string, data json.RawMessage, sequence int, meta *models.SessionMeta) error
	GetChunks(ctx context.Context, websiteID, sessionID string) ([]models.SessionReplayChunk, error)
	ListSessionsWithMetadata(ctx context.Context, websiteID string, limit, offset int) ([]models.ReplaySessionMetadata, error)
	DeleteSessionReplay(ctx context.Context, websiteID, sessionID string) ([]string, error)
	BulkDeleteReplays(ctx context.Context, websiteID string, sessionIDs []string) ([]string, error)
	GetPageSnapshot(ctx context.Context, websiteID, siteID, url string) (json.RawMessage, error)
	FindSessionIDForPage(ctx context.Context, websiteID, url string) (string, error)
}

type replayRepository struct {
	db *pgxpool.Pool
}

func NewReplayRepository(db *pgxpool.Pool) ReplayRepository {
	return &replayRepository{db: db}
}

func (r *replayRepository) SaveChunk(ctx context.Context, websiteID, sessionID string, data json.RawMessage, sequence int, meta *models.SessionMeta) error {
	if meta != nil {
		// First chunk — store session metadata alongside the row
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

func (r *replayRepository) ListSessionsWithMetadata(ctx context.Context, websiteID string, limit, offset int) ([]models.ReplaySessionMetadata, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	// Metadata (browser/device/OS/country/entry_page) is stored on the sequence=0 row.
	// Self-join avoids querying the analytics events table which lives in ClickHouse.
	query := `
		SELECT
			r.session_id,
			MIN(r.timestamp)  AS start_time,
			MAX(r.timestamp)  AS end_time,
			EXTRACT(EPOCH FROM (MAX(r.timestamp) - MIN(r.timestamp))) AS duration,
			COUNT(r.id)       AS chunk_count,
			COALESCE(m.browser,    'Unknown') AS browser,
			COALESCE(m.device,     'Unknown') AS device,
			COALESCE(m.os,         'Unknown') AS os,
			COALESCE(m.country,    'Unknown') AS country,
			COALESCE(m.entry_page, 'Unknown') AS entry_page
		FROM session_replays r
		LEFT JOIN session_replays m
			ON  m.website_id = r.website_id
			AND m.session_id = r.session_id
			AND m.sequence   = 0
		WHERE r.website_id = $1
		GROUP BY r.session_id, m.browser, m.device, m.os, m.country, m.entry_page
		ORDER BY start_time DESC
		LIMIT $2 OFFSET $3
	`
	rows, err := r.db.Query(ctx, query, websiteID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []models.ReplaySessionMetadata
	for rows.Next() {
		var s models.ReplaySessionMetadata
		err := rows.Scan(
			&s.SessionID, &s.StartTime, &s.EndTime, &s.Duration, &s.ChunkCount,
			&s.Browser, &s.Device, &s.OS, &s.Country, &s.EntryPage,
		)
		if err != nil {
			return nil, err
		}
		s.WebsiteID = websiteID
		sessions = append(sessions, s)
	}

	return sessions, nil
}

// DeleteSessionReplay removes all DB rows and returns the S3 keys that should be deleted.
func (r *replayRepository) DeleteSessionReplay(ctx context.Context, websiteID, sessionID string) ([]string, error) {
	// Collect sequence numbers before deleting so we can build S3 keys.
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

	keys := make([]string, len(sequences))
	for i, seq := range sequences {
		keys[i] = fmt.Sprintf("replays/%s/%s/%d.json", websiteID, sessionID, seq)
	}
	return keys, nil
}

func (r *replayRepository) GetPageSnapshot(ctx context.Context, websiteID, siteID, url string) (json.RawMessage, error) {
	return nil, nil
}

func (r *replayRepository) FindSessionIDForPage(ctx context.Context, websiteID, url string) (string, error) {
	// Look up by entry_page stored on the sequence=0 metadata row.
	query := `
		SELECT session_id
		FROM session_replays
		WHERE website_id = $1 AND entry_page = $2 AND sequence = 0
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

	// 1. Get all sequence numbers for these sessions to build S3 keys
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
		// Build Both Gzip and Non-Gzip keys just to be safe
		keys = append(keys, fmt.Sprintf("replays/%s/%s/%d.json.gz", websiteID, sID, seq))
		keys = append(keys, fmt.Sprintf("replays/%s/%s/%d.json", websiteID, sID, seq))
	}

	// 2. Delete from DB
	deleteQuery := `DELETE FROM session_replays WHERE website_id = $1 AND session_id = ANY($2)`
	if _, err := r.db.Exec(ctx, deleteQuery, websiteID, sessionIDs); err != nil {
		return nil, err
	}

	return keys, nil
}
