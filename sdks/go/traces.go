package seentics

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"
)

type contextKey struct{}

// SpanStatus mirrors the backend values.
type SpanStatus string

const (
	SpanStatusOK    SpanStatus = "ok"
	SpanStatusError SpanStatus = "error"
	SpanStatusUnset SpanStatus = "unset"
)

// SpanData is the payload sent to POST /api/v1/observability/traces/ingest.
type SpanData struct {
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
	Status       SpanStatus        `json:"status"`
	ErrorMessage string            `json:"error_message,omitempty"`
	Attributes   map[string]string `json:"attributes,omitempty"`
}

// Span represents an in-progress distributed trace span.
type Span struct {
	TraceID      string
	SpanID       string
	ParentSpanID string

	client    *Client
	operation string
	startTime time.Time
	status    SpanStatus
	errMsg    string
	attrs     map[string]string
	mu        sync.Mutex
	ended     bool
}

// SetAttribute attaches a key-value attribute to the span.
func (s *Span) SetAttribute(key, value string) *Span {
	s.mu.Lock()
	if s.attrs == nil {
		s.attrs = make(map[string]string)
	}
	s.attrs[key] = value
	s.mu.Unlock()
	return s
}

// SetStatus sets the final status of the span.
func (s *Span) SetStatus(status SpanStatus, errMsg ...string) *Span {
	s.mu.Lock()
	s.status = status
	if len(errMsg) > 0 {
		s.errMsg = errMsg[0]
	}
	s.mu.Unlock()
	return s
}

// RecordError marks the span as errored and records the error message.
func (s *Span) RecordError(err error) *Span {
	if err == nil {
		return s
	}
	s.mu.Lock()
	s.status = SpanStatusError
	s.errMsg = err.Error()
	s.mu.Unlock()
	return s
}

// End finalises the span and enqueues it for sending.
// Calling End more than once is a no-op.
func (s *Span) End() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.ended {
		return
	}
	s.ended = true

	endTime := time.Now().UTC()
	status := s.status
	if status == SpanStatusUnset || status == "" {
		status = SpanStatusOK
	}

	var attrs map[string]string
	if len(s.attrs) > 0 {
		attrs = make(map[string]string, len(s.attrs))
		for k, v := range s.attrs {
			attrs[k] = v
		}
	}

	data := SpanData{
		Timestamp:    s.startTime,
		ProjectID:    s.client.cfg.ProjectID,
		TraceID:      s.TraceID,
		SpanID:       s.SpanID,
		ParentSpanID: s.ParentSpanID,
		Service:      s.client.cfg.Service,
		Operation:    s.operation,
		StartTime:    s.startTime,
		EndTime:      endTime,
		DurationMS:   endTime.Sub(s.startTime).Milliseconds(),
		Status:       status,
		ErrorMessage: s.errMsg,
		Attributes:   attrs,
	}
	if s.client.spanBuf.add(data) {
		s.client.triggerFlush()
	}
}

// StartSpan starts a new root span and returns an updated context carrying it.
//
//	ctx, span := client.StartSpan(ctx, "handle-request")
//	defer span.End()
func (c *Client) StartSpan(ctx context.Context, operation string) (context.Context, *Span) {
	span := &Span{
		TraceID:   randomHex(16),
		SpanID:    randomHex(8),
		client:    c,
		operation: operation,
		startTime: time.Now().UTC(),
		status:    SpanStatusUnset,
	}
	// Inherit trace from parent if present in context.
	if parent, ok := ctx.Value(contextKey{}).(*Span); ok && parent != nil {
		span.TraceID      = parent.TraceID
		span.ParentSpanID = parent.SpanID
	}
	return context.WithValue(ctx, contextKey{}, span), span
}

// SpanFromContext returns the active span stored in the context, if any.
func SpanFromContext(ctx context.Context) (*Span, bool) {
	s, ok := ctx.Value(contextKey{}).(*Span)
	return s, ok && s != nil
}

func randomHex(bytes int) string {
	b := make([]byte, bytes)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
