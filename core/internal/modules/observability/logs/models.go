package logs

import "time"

// LogEntry represents a single structured log line ingested from a service.
type LogEntry struct {
	Timestamp   time.Time         `json:"timestamp"`
	ProjectID   string            `json:"project_id"`
	Service     string            `json:"service"`
	Level       string            `json:"level"` // debug | info | warn | error | fatal
	Message     string            `json:"message"`
	TraceID     string            `json:"trace_id,omitempty"`
	SpanID      string            `json:"span_id,omitempty"`
	Attributes  map[string]string `json:"attributes,omitempty"`
	Host        string            `json:"host,omitempty"`
	Environment string            `json:"environment,omitempty"`
}

// IngestRequest is the payload for POST /observability/logs/ingest.
type IngestRequest struct {
	Logs []LogEntry `json:"logs"`
}

// QueryParams holds filters for GET /observability/logs.
type QueryParams struct {
	ProjectID string
	Service   string
	Level     string
	Search    string
	From      time.Time
	To        time.Time
	Limit     int
	Offset    int
}
