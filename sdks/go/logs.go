package seentics

import "time"

// LogLevel represents the severity of a log entry.
type LogLevel string

const (
	LevelDebug LogLevel = "debug"
	LevelInfo  LogLevel = "info"
	LevelWarn  LogLevel = "warn"
	LevelError LogLevel = "error"
	LevelFatal LogLevel = "fatal"
)

// LogEntry is the payload sent to POST /api/v1/observability/logs/ingest.
type LogEntry struct {
	Timestamp   time.Time         `json:"timestamp"`
	ProjectID   string            `json:"project_id"`
	Service     string            `json:"service"`
	Level       LogLevel          `json:"level"`
	Message     string            `json:"message"`
	TraceID     string            `json:"trace_id,omitempty"`
	SpanID      string            `json:"span_id,omitempty"`
	Attributes  map[string]string `json:"attributes,omitempty"`
	Host        string            `json:"host,omitempty"`
	Environment string            `json:"environment,omitempty"`
}

// LogOptions are optional fields for a log entry.
type LogOptions struct {
	TraceID    string
	SpanID     string
	Attributes map[string]string
}

// Debug logs a debug-level message.
func (c *Client) Debug(msg string, opts ...LogOptions) { c.pushLog(LevelDebug, msg, opts) }

// Info logs an info-level message.
func (c *Client) Info(msg string, opts ...LogOptions) { c.pushLog(LevelInfo, msg, opts) }

// Warn logs a warning message.
func (c *Client) Warn(msg string, opts ...LogOptions) { c.pushLog(LevelWarn, msg, opts) }

// Error logs an error-level message (does NOT capture a stack trace — use CaptureError for that).
func (c *Client) Error(msg string, opts ...LogOptions) { c.pushLog(LevelError, msg, opts) }

// Fatal logs a fatal-level message.
func (c *Client) Fatal(msg string, opts ...LogOptions) { c.pushLog(LevelFatal, msg, opts) }

func (c *Client) pushLog(level LogLevel, msg string, opts []LogOptions) {
	e := LogEntry{
		Timestamp:   time.Now().UTC(),
		ProjectID:   c.cfg.ProjectID,
		Service:     c.cfg.Service,
		Environment: c.cfg.Environment,
		Level:       level,
		Message:     msg,
	}
	if len(opts) > 0 {
		e.TraceID    = opts[0].TraceID
		e.SpanID     = opts[0].SpanID
		e.Attributes = opts[0].Attributes
	}
	if c.logBuf.add(e) {
		c.triggerFlush()
	}
}
