package seentics

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// logWriter implements io.Writer and translates zerolog JSON lines into
// structured Seentics log entries.
//
// Use with zerolog:
//
//	log := zerolog.New(client.Writer()).With().Timestamp().Logger()
type logWriter struct {
	c *Client
}

// Writer returns an io.Writer compatible with zerolog (and any logger that
// emits one JSON object per line).
func (c *Client) Writer() *logWriter {
	return &logWriter{c: c}
}

func (w *logWriter) Write(p []byte) (int, error) {
	line := strings.TrimSpace(string(p))
	if line == "" {
		return len(p), nil
	}

	var m map[string]interface{}
	if err := json.Unmarshal([]byte(line), &m); err != nil {
		// Not JSON — forward as raw info log.
		w.c.Info(line)
		return len(p), nil
	}

	msg := stringField(m, "message", stringField(m, "msg", line))
	lvl := parseLevel(stringField(m, "level", "info"))

	var ts time.Time
	if t, ok := m["time"]; ok {
		switch v := t.(type) {
		case string:
			if parsed, err := time.Parse(time.RFC3339, v); err == nil {
				ts = parsed
			}
		case float64:
			ts = time.Unix(int64(v), 0).UTC()
		}
	}
	if ts.IsZero() {
		ts = time.Now().UTC()
	}

	attrs := make(map[string]string)
	skip := map[string]bool{"level": true, "message": true, "msg": true, "time": true}
	for k, v := range m {
		if skip[k] {
			continue
		}
		switch vv := v.(type) {
		case string:
			attrs[k] = vv
		case float64:
			attrs[k] = strings.TrimRight(strings.TrimRight(
				fmt.Sprintf("%f", vv), "0"), ".")
		default:
			if b, err := json.Marshal(v); err == nil {
				attrs[k] = string(b)
			}
		}
	}

	entry := LogEntry{
		Timestamp:   ts,
		ProjectID:   w.c.cfg.ProjectID,
		Service:     w.c.cfg.Service,
		Environment: w.c.cfg.Environment,
		Level:       lvl,
		Message:     msg,
		TraceID:     attrs["trace_id"],
		SpanID:      attrs["span_id"],
	}
	delete(attrs, "trace_id")
	delete(attrs, "span_id")
	if len(attrs) > 0 {
		entry.Attributes = attrs
	}

	if w.c.logBuf.add(entry) {
		w.c.triggerFlush()
	}
	return len(p), nil
}

func stringField(m map[string]interface{}, key, fallback string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return fallback
}

func parseLevel(s string) LogLevel {
	switch strings.ToLower(s) {
	case "debug", "trace":
		return LevelDebug
	case "warn", "warning":
		return LevelWarn
	case "error":
		return LevelError
	case "fatal", "panic":
		return LevelFatal
	default:
		return LevelInfo
	}
}
