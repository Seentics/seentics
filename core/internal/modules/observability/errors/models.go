package errors

import "time"

// ErrorEvent represents a single error occurrence ingested from a service.
type ErrorEvent struct {
	Timestamp   time.Time         `json:"timestamp"`
	ProjectID   string            `json:"project_id"`
	Service     string            `json:"service"`
	ErrorType   string            `json:"error_type"`
	Message     string            `json:"message"`
	StackTrace  string            `json:"stack_trace,omitempty"`
	Fingerprint string            `json:"fingerprint,omitempty"` // computed if not provided
	Environment string            `json:"environment,omitempty"`
	Release     string            `json:"release,omitempty"`
	UserID      string            `json:"user_id,omitempty"`
	Attributes  map[string]string `json:"attributes,omitempty"`
}

// ErrorGroup is an aggregated view of errors sharing the same fingerprint.
type ErrorGroup struct {
	Fingerprint string    `json:"fingerprint"`
	ProjectID   string    `json:"project_id"`
	Service     string    `json:"service"`
	ErrorType   string    `json:"error_type"`
	Message     string    `json:"message"`
	Status      string    `json:"status"` // open | resolved | ignored
	FirstSeen   time.Time `json:"first_seen"`
	LastSeen    time.Time `json:"last_seen"`
	Count       int64     `json:"count"`
}

// IngestRequest is the payload for POST /observability/errors/ingest.
type IngestRequest struct {
	Errors []ErrorEvent `json:"errors"`
}
