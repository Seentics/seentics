// Package repository handles session replay storage.
// Metadata → Postgres.  Recording chunks → MinIO/S3.
package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/Seentics/seentics/internal/modules/replays/models"
	"github.com/Seentics/seentics/internal/shared/storage"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ReplayRepository struct {
	db *pgxpool.Pool
	s3 *storage.S3Client
}

func New(db *pgxpool.Pool, s3 *storage.S3Client) *ReplayRepository {
	return &ReplayRepository{db: db, s3: s3}
}

// SaveChunk writes one event batch for a session.
// When meta != nil (first chunk) it also upserts the Postgres metadata row.
func (r *ReplayRepository) SaveChunk(ctx context.Context, websiteID, sessionID string, tsMs int64, events interface{}, meta *models.SessionMeta) error {
	key := storage.SessionKey(websiteID, sessionID, tsMs)
	if err := r.s3.PutJSON(ctx, key, events); err != nil {
		return fmt.Errorf("replay upload: %w", err)
	}
	if meta == nil {
		return nil
	}
	const q = `INSERT INTO session_replays
		(website_id, session_id, sequence, data, browser, device, os, country, entry_page, timestamp)
		VALUES ($1,$2,0,'{}', $3,$4,$5,$6,$7,$8)
		ON CONFLICT (website_id, session_id, sequence) DO NOTHING`
	_, err := r.db.Exec(ctx, q, websiteID, sessionID, meta.Browser, meta.Device, meta.OS, meta.Country, meta.EntryPage, time.UnixMilli(tsMs))
	return err
}

// ListSessions returns paginated session metadata.
func (r *ReplayRepository) ListSessions(ctx context.Context, websiteID string, limit, offset int) ([]models.Session, error) {
	const q = `SELECT session_id, website_id,
		COALESCE(browser,''), COALESCE(device,''), COALESCE(os,''),
		COALESCE(country,''), COALESCE(entry_page,''),
		timestamp, has_rage_clicks
		FROM session_replays WHERE website_id=$1 AND sequence=0
		ORDER BY timestamp DESC LIMIT $2 OFFSET $3`
	rows, err := r.db.Query(ctx, q, websiteID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("replay list: %w", err)
	}
	defer rows.Close()
	var out []models.Session
	for rows.Next() {
		var s models.Session
		if err := rows.Scan(&s.SessionID, &s.WebsiteID, &s.Browser, &s.Device, &s.OS, &s.Country, &s.EntryPage, &s.StartedAt, &s.HasRageClicks); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// GetSessionMeta returns the Postgres metadata row for a single session.
func (r *ReplayRepository) GetSessionMeta(ctx context.Context, websiteID, sessionID string) (*models.Session, error) {
	const q = `SELECT session_id, website_id,
		COALESCE(browser,''), COALESCE(device,''), COALESCE(os,''),
		COALESCE(country,''), COALESCE(entry_page,''),
		timestamp, has_rage_clicks
		FROM session_replays
		WHERE website_id=$1 AND session_id=$2 AND sequence=0
		LIMIT 1`
	row := r.db.QueryRow(ctx, q, websiteID, sessionID)
	var s models.Session
	if err := row.Scan(&s.SessionID, &s.WebsiteID, &s.Browser, &s.Device, &s.OS,
		&s.Country, &s.EntryPage, &s.StartedAt, &s.HasRageClicks); err != nil {
		return nil, err
	}
	return &s, nil
}

// GetChunks downloads all recording chunks for a session from S3, in timestamp order.
func (r *ReplayRepository) GetChunks(ctx context.Context, websiteID, sessionID string) ([]models.ReplayChunk, error) {
	prefix := storage.SessionPrefix(websiteID, sessionID)
	keys, err := r.s3.ListKeys(ctx, prefix)
	if err != nil {
		return nil, fmt.Errorf("replay list keys: %w", err)
	}
	chunks := make([]models.ReplayChunk, 0, len(keys))
	for i, key := range keys {
		var events []map[string]interface{}
		if err := r.s3.GetJSON(ctx, key, &events); err != nil {
			continue // skip corrupted chunk
		}
		chunks = append(chunks, models.ReplayChunk{Sequence: i, Data: events})
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
