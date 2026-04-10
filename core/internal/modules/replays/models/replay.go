package models

import "time"

// Session represents a recorded user session
type Session struct {
	SessionID     string    `json:"sessionId"`
	WebsiteID     string    `json:"websiteId"`
	Browser       string    `json:"browser"`
	Device        string    `json:"device"`
	OS            string    `json:"os"`
	Country       string    `json:"country"`
	EntryPage     string    `json:"entryPage"`
	StartedAt     time.Time `json:"startedAt"`
	ChunkCount    int       `json:"chunkCount"`
	HasRageClicks   bool      `json:"hasRageClicks"`
	HasErrors       bool      `json:"hasErrors"`
	DurationSeconds int       `json:"durationSeconds"`
	PagesViewed     int       `json:"pagesViewed"`
}


// ReplayChunk represents a single chunk of recorded event data for a session
type ReplayChunk struct {
	Sequence  int                    `json:"sequence"`
	Data      []map[string]interface{} `json:"data"` // raw event data stored as JSON array
	Timestamp time.Time              `json:"timestamp"`
}

// SessionMeta holds metadata collected at the start of a session
type SessionMeta struct {
	Browser   string
	Device    string
	OS        string
	Country   string
	EntryPage string
}

// SessionReplayAccess tells the client how to load recording data: in-memory chunks while recording
// is spooled, or a presigned URL to fetch bundle.json.gz directly from object storage.
type SessionReplayAccess struct {
	WarmChunks         []ReplayChunk `json:"warm_chunks,omitempty"`
	ReplayURL          string        `json:"replay_url,omitempty"`
	ReplayURLExpiresAt *time.Time    `json:"replay_url_expires_at,omitempty"`
}
