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
	SessionID  string    `json:"session_id"`
	WebsiteID  string    `json:"website_id"`
	StartTime  time.Time `json:"start_time"`
	EndTime    time.Time `json:"end_time"`
	Duration   float64   `json:"duration_seconds"`
	ChunkCount int       `json:"chunk_count"`
	Browser    string    `json:"browser"`
	Device     string    `json:"device"`
	OS         string    `json:"os"`
	Country    string    `json:"country"`
	EntryPage  string    `json:"entry_page"`
}

type RecordReplayRequest struct {
	WebsiteID string            `json:"website_id"`
	SessionID string            `json:"session_id"`
	Events    []json.RawMessage `json:"events"`
	Sequence  int               `json:"sequence"`
}
