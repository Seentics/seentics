package repository

import (
	"analytics-app/internal/modules/replays/models"
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ReplayRepository interface {
	SaveChunk(ctx context.Context, websiteID, sessionID string, data json.RawMessage, sequence int) error
	GetChunks(ctx context.Context, websiteID, sessionID string) ([]models.SessionReplayChunk, error)
	ListSessionsWithMetadata(ctx context.Context, websiteID string) ([]models.ReplaySessionMetadata, error)
	DeleteSessionReplay(ctx context.Context, websiteID, sessionID string) error
	GetPageSnapshot(ctx context.Context, websiteID, siteID, url string) (json.RawMessage, error)
	FindSessionIDForPage(ctx context.Context, websiteID, url string) (string, error)
}

type replayRepository struct {
	db *pgxpool.Pool
}

func NewReplayRepository(db *pgxpool.Pool) ReplayRepository {
	return &replayRepository{db: db}
}

func (r *replayRepository) SaveChunk(ctx context.Context, websiteID, sessionID string, data json.RawMessage, sequence int) error {
	query := `
		INSERT INTO session_replays (website_id, session_id, data, sequence)
		VALUES ($1, $2, $3, $4)
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

func (r *replayRepository) ListSessionsWithMetadata(ctx context.Context, websiteID string) ([]models.ReplaySessionMetadata, error) {
	query := `
		SELECT 
			r.session_id,
			MIN(r.timestamp) as start_time,
			MAX(r.timestamp) as end_time,
			EXTRACT(EPOCH FROM (MAX(r.timestamp) - MIN(r.timestamp))) as duration,
			COUNT(r.id) as chunk_count,
			COALESCE(e.browser, 'Unknown') as browser,
			COALESCE(e.device, 'Unknown') as device,
			COALESCE(e.os, 'Unknown') as os,
			COALESCE(e.country, 'Unknown') as country,
			COALESCE(e.page, 'Unknown') as entry_page
		FROM session_replays r
		LEFT JOIN (
			SELECT DISTINCT ON (session_id) 
				session_id, browser, device, os, country, page, timestamp
			FROM events
			WHERE website_id = $1
			ORDER BY session_id, timestamp ASC
		) e ON r.session_id = e.session_id
		WHERE r.website_id = $1
		GROUP BY r.session_id, e.browser, e.device, e.os, e.country, e.page
		ORDER BY start_time DESC
	`
	rows, err := r.db.Query(ctx, query, websiteID)
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

func (r *replayRepository) DeleteSessionReplay(ctx context.Context, websiteID, sessionID string) error {
	query := `DELETE FROM session_replays WHERE website_id = $1 AND session_id = $2`
	_, err := r.db.Exec(ctx, query, websiteID, sessionID)
	return err
}

func (r *replayRepository) GetPageSnapshot(ctx context.Context, websiteID, siteID, url string) (json.RawMessage, error) {
	// Deprecated: This relies on data being in DB. New implementation uses FindSessionIDForPage + S3.
	// We keep this for backward compatibility if needed, or we can just replace it.
	// For S3 migration, we should use FindSessionIDForPage.
	return nil, nil
}

func (r *replayRepository) FindSessionIDForPage(ctx context.Context, websiteID, url string) (string, error) {
	// Find the most recent session that visited this URL
	query := `
		SELECT session_id
		FROM events
		WHERE website_id = $1 AND page = $2
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
