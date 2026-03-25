package traces

import "time"

// Span represents a single span within a distributed trace.
type Span struct {
	Timestamp    time.Time         `json:"timestamp"`
	ProjectID    string            `json:"project_id"`
	TraceID      string            `json:"trace_id"`
	SpanID       string            `json:"span_id"`
	ParentSpanID string            `json:"parent_span_id,omitempty"`
	Service      string            `json:"service"`
	Operation    string            `json:"operation"`
	StartTime    time.Time         `json:"start_time"`
	EndTime      time.Time         `json:"end_time"`
	DurationMS   int64             `json:"duration_ms"`
	Status       string            `json:"status"` // ok | error | unset
	ErrorMessage string            `json:"error_message,omitempty"`
	Attributes   map[string]string `json:"attributes,omitempty"`
}

// Trace is a full trace with all its spans.
type Trace struct {
	TraceID    string    `json:"trace_id"`
	RootSpan   Span      `json:"root_span"`
	Spans      []Span    `json:"spans"`
	DurationMS int64     `json:"duration_ms"`
	Status     string    `json:"status"`
	StartTime  time.Time `json:"start_time"`
}

// IngestRequest is the payload for POST /observability/traces/ingest.
type IngestRequest struct {
	Spans []Span `json:"spans"`
}
