// Package seentics is the official Go SDK for Seentics observability.
// It buffers logs, errors, spans, and metrics in memory and flushes them
// to your Seentics instance in the background.
//
// Quick start:
//
//	client := seentics.New(seentics.Config{
//	    APIKey:    "sk_proj_...",
//	    ProjectID: "proj_abc123",
//	    Service:   "checkout-service",
//	})
//	defer client.Shutdown(context.Background())
//
//	// Logs
//	client.Info("order placed", seentics.LogOptions{Attributes: map[string]string{"order_id": "42"}})
//
//	// Errors
//	client.CaptureError(err)
//
//	// Traces
//	ctx, span := client.StartSpan(ctx, "process-payment")
//	defer span.End()
//
//	// Metrics
//	client.Histogram("payment.duration_ms", float64(elapsed.Milliseconds()))
//
//	// zerolog integration
//	log := zerolog.New(client.Writer()).With().Timestamp().Logger()
package seentics

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

const (
	defaultBaseURL      = "https://api.seentics.io"
	defaultFlushInterval = 5 * time.Second
	defaultMaxSize      = 100
)

// Config holds all SDK configuration.
type Config struct {
	// APIKey is the project API key (sk_proj_...). Required.
	APIKey string
	// ProjectID is the Seentics project/website ID. Required.
	ProjectID string
	// Service is the logical service name shown in the dashboard. Required.
	Service string
	// Environment tags every event (e.g. "production", "staging").
	Environment string
	// BaseURL of your Seentics instance. Default: https://api.seentics.io
	BaseURL string
	// FlushInterval controls how often buffered data is sent. Default: 5s.
	FlushInterval time.Duration
	// FlushMaxSize triggers an immediate flush when the buffer reaches this size.
	// Default: 100.
	FlushMaxSize int
}

// Client is the main SDK entry point. Create one per service with New().
// It is safe for concurrent use.
type Client struct {
	cfg Config
	hc  *http.Client

	logBuf    *buffer[LogEntry]
	errorBuf  *buffer[ErrorEvent]
	spanBuf   *buffer[SpanData]
	metricBuf *buffer[MetricPoint]

	flushCh chan struct{}
	ctx     context.Context
	cancel  context.CancelFunc
	wg      sync.WaitGroup
}

// New creates and starts a Seentics client. It launches a background goroutine
// that periodically flushes buffered telemetry to the API.
func New(cfg Config) *Client {
	if cfg.BaseURL == "" {
		cfg.BaseURL = defaultBaseURL
	}
	if cfg.FlushInterval <= 0 {
		cfg.FlushInterval = defaultFlushInterval
	}
	if cfg.FlushMaxSize <= 0 {
		cfg.FlushMaxSize = defaultMaxSize
	}

	ctx, cancel := context.WithCancel(context.Background())
	c := &Client{
		cfg:       cfg,
		hc:        &http.Client{Timeout: 15 * time.Second},
		logBuf:    newBuffer[LogEntry](cfg.FlushMaxSize),
		errorBuf:  newBuffer[ErrorEvent](cfg.FlushMaxSize),
		spanBuf:   newBuffer[SpanData](cfg.FlushMaxSize),
		metricBuf: newBuffer[MetricPoint](cfg.FlushMaxSize),
		flushCh:   make(chan struct{}, 1),
		ctx:       ctx,
		cancel:    cancel,
	}
	c.wg.Add(1)
	go c.flusher()
	return c
}

// triggerFlush signals the background flusher to send immediately.
// It is non-blocking; if a flush is already pending the signal is dropped.
func (c *Client) triggerFlush() {
	select {
	case c.flushCh <- struct{}{}:
	default:
	}
}

// flusher is the background goroutine that drains all buffers.
func (c *Client) flusher() {
	defer c.wg.Done()
	ticker := time.NewTicker(c.cfg.FlushInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			c.flushAll()
		case <-c.flushCh:
			c.flushAll()
		case <-c.ctx.Done():
			c.flushAll() // final drain
			return
		}
	}
}

func (c *Client) flushAll() {
	c.sendLogs()
	c.sendErrors()
	c.sendSpans()
	c.sendMetrics()
}

func (c *Client) sendLogs() {
	items := c.logBuf.drain()
	if len(items) == 0 {
		return
	}
	_ = c.post(c.ctx, "/api/v1/observability/logs/ingest", map[string]interface{}{"logs": items})
}

func (c *Client) sendErrors() {
	items := c.errorBuf.drain()
	if len(items) == 0 {
		return
	}
	_ = c.post(c.ctx, "/api/v1/observability/errors/ingest", map[string]interface{}{"errors": items})
}

func (c *Client) sendSpans() {
	items := c.spanBuf.drain()
	if len(items) == 0 {
		return
	}
	_ = c.post(c.ctx, "/api/v1/observability/traces/ingest", map[string]interface{}{"spans": items})
}

func (c *Client) sendMetrics() {
	items := c.metricBuf.drain()
	if len(items) == 0 {
		return
	}
	_ = c.post(c.ctx, "/api/v1/observability/metrics/ingest", map[string]interface{}{"metrics": items})
}

// Flush sends all buffered telemetry to the API synchronously.
// It blocks until the flush is complete or ctx is cancelled.
func (c *Client) Flush(ctx context.Context) error {
	done := make(chan struct{})
	go func() {
		c.flushAll()
		close(done)
	}()
	select {
	case <-done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Shutdown flushes all buffered data and stops the background goroutine.
// Call with defer in main() or your service shutdown handler.
//
//	defer client.Shutdown(context.Background())
func (c *Client) Shutdown(ctx context.Context) error {
	c.cancel()
	done := make(chan struct{})
	go func() {
		c.wg.Wait()
		close(done)
	}()
	select {
	case <-done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// post marshals body as JSON and sends it to the API.
func (c *Client) post(ctx context.Context, path string, body interface{}) error {
	b, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.cfg.BaseURL+path, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.cfg.APIKey)

	resp, err := c.hc.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("seentics: API returned %d for %s", resp.StatusCode, path)
	}
	return nil
}
