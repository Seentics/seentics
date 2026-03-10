package models

import (
	"encoding/json"
	"time"
)

type SessionReplayChunk struct {
	ID        string          `json:"id"`
	WebsiteID string          `json:"website_id"`
	SessionID string          `json:"session_id"`
	Data      json.RawMessage `json:"data"`
	Sequence  int             `json:"sequence"`
	Timestamp time.Time       `json:"timestamp"`
	CreatedAt time.Time       `json:"created_at"`
}

type ReplaySessionMetadata struct {
	SessionID     string    `json:"session_id"`
	WebsiteID     string    `json:"website_id"`
	StartTime     time.Time `json:"start_time"`
	EndTime       time.Time `json:"end_time"`
	Duration      float64   `json:"duration_seconds"`
	ChunkCount    int       `json:"chunk_count"`
	Browser       string    `json:"browser"`
	Device        string    `json:"device"`
	OS            string    `json:"os"`
	Country       string    `json:"country"`
	EntryPage     string    `json:"entry_page"`
	HasRageClicks bool      `json:"has_rage_clicks"`
}

// SessionMeta holds browser/device/OS info captured on the first chunk of a session.
type SessionMeta struct {
	Browser   string
	Device    string
	OS        string
	Country   string
	EntryPage string
}

type RecordReplayRequest struct {
	WebsiteID string            `json:"website_id"`
	SessionID string            `json:"session_id"`
	Events    []json.RawMessage `json:"events"`
	Sequence  int               `json:"sequence"`
	Page      string            `json:"page"` // Current page path — stored as entry_page for sequence=0
}

type BulkDeleteReplaysRequest struct {
	WebsiteID  string   `json:"website_id" binding:"required"`
	SessionIDs []string `json:"session_ids" binding:"required"`
}

// PresignedManifest is returned by GET /replays/presigned-manifest/:session_id.
// When the full-replay cache exists in S3, only FullURL is set (fastest path).
// Otherwise Chunks lists presigned URLs for individual gzip chunks.
type PresignedManifest struct {
	// FullURL is a presigned URL for the pre-stitched full.json.gz cache (if available).
	// The browser fetches this and receives a decompressed JSON array of rrweb events.
	FullURL string `json:"full_url,omitempty"`
	// Chunks always contains per-chunk presigned URLs so the frontend can start
	// playback from chunk 0 immediately (progressive streaming).
	Chunks      []PresignedChunk `json:"chunks,omitempty"`
	TotalChunks int              `json:"total_chunks"`
	ExpiresAt   time.Time        `json:"expires_at"`
}

type PresignedChunk struct {
	Seq int    `json:"seq"`
	URL string `json:"url"`
}

// UnprocessedSession is returned by the rage-click worker query.
type UnprocessedSession struct {
	WebsiteID string
	SessionID string
	Timestamp time.Time
}
