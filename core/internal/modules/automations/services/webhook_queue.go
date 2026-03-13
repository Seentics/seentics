package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/Seentics/seentics/internal/shared/cache"
	"github.com/rs/zerolog"
)

const (
	webhookQueueKey  = "queue:webhooks"
	webhookDLQKey    = "queue:webhooks:dlq"
	maxWebhookRetry  = 3
	webhookTimeout   = 10 * time.Second
	workerPollTimeout = 5 * time.Second
)

// WebhookJob represents a webhook delivery task stored in the Redis queue.
type WebhookJob struct {
	URL     string                 `json:"url"`
	Method  string                 `json:"method"`
	Headers map[string]string      `json:"headers,omitempty"`
	Payload map[string]interface{} `json:"payload"`
	Retry   int                    `json:"retry"`
}

// WebhookQueue provides Redis-backed FIFO webhook delivery with retries.
type WebhookQueue struct {
	cache  *cache.Cache
	logger zerolog.Logger
}

// NewWebhookQueue creates a queue backed by the given Redis cache.
func NewWebhookQueue(c *cache.Cache, logger zerolog.Logger) *WebhookQueue {
	return &WebhookQueue{cache: c, logger: logger}
}

// validateWebhookURL checks that the URL is safe to call (no SSRF).
func validateWebhookURL(rawURL string) error {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}

	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" {
		return fmt.Errorf("unsupported scheme %q, only http/https allowed", scheme)
	}

	host := parsed.Hostname()
	if host == "" {
		return fmt.Errorf("empty hostname")
	}

	// Block known internal/private hostnames
	blockedHosts := []string{"localhost", "127.0.0.1", "0.0.0.0", "::1", "metadata.google.internal", "169.254.169.254"}
	for _, blocked := range blockedHosts {
		if strings.EqualFold(host, blocked) {
			return fmt.Errorf("blocked host: %s", host)
		}
	}

	// Resolve and block private/loopback IPs
	ips, err := net.LookupHost(host)
	if err != nil {
		return fmt.Errorf("DNS lookup failed for %s: %w", host, err)
	}
	for _, ipStr := range ips {
		ip := net.ParseIP(ipStr)
		if ip == nil {
			continue
		}
		if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified() {
			return fmt.Errorf("resolved to private/internal IP: %s", ipStr)
		}
	}

	return nil
}

// Enqueue pushes a webhook job onto the queue for async delivery.
func (q *WebhookQueue) Enqueue(job WebhookJob) error {
	if err := validateWebhookURL(job.URL); err != nil {
		return fmt.Errorf("webhook URL rejected: %w", err)
	}

	data, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("marshal webhook job: %w", err)
	}
	return q.cache.LPush(webhookQueueKey, string(data))
}

// StartWorker launches a blocking loop that processes webhook jobs.
// Call this in a goroutine. It stops when ctx is cancelled.
func (q *WebhookQueue) StartWorker(ctx context.Context) {
	q.logger.Info().Msg("Webhook queue worker started")
	for {
		select {
		case <-ctx.Done():
			q.logger.Info().Msg("Webhook queue worker stopped")
			return
		default:
		}

		_, raw, err := q.cache.BRPop(workerPollTimeout, webhookQueueKey)
		if err != nil {
			// Timeout or Redis error — just retry
			continue
		}

		var job WebhookJob
		if err := json.Unmarshal([]byte(raw), &job); err != nil {
			q.logger.Error().Err(err).Str("raw", raw).Msg("Invalid webhook job in queue")
			continue
		}

		if err := q.deliver(job); err != nil {
			q.logger.Warn().
				Err(err).
				Str("url", job.URL).
				Int("retry", job.Retry).
				Msg("Webhook delivery failed")

			job.Retry++
			if job.Retry >= maxWebhookRetry {
				// Move to dead-letter queue
				if dlqData, e := json.Marshal(job); e == nil {
					q.cache.LPush(webhookDLQKey, string(dlqData))
				}
				q.logger.Error().
					Str("url", job.URL).
					Msg("Webhook moved to DLQ after max retries")
			} else {
				// Re-enqueue for retry
				if err := q.Enqueue(job); err != nil {
					q.logger.Error().Err(err).Msg("Failed to re-enqueue webhook")
				}
			}
		} else {
			q.logger.Debug().Str("url", job.URL).Msg("Webhook delivered")
		}
	}
}

// deliver sends the HTTP request for a webhook job.
func (q *WebhookQueue) deliver(job WebhookJob) error {
	jsonData, err := json.Marshal(job.Payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	req, err := http.NewRequest(job.Method, job.URL, bytes.NewReader(jsonData))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	for k, v := range job.Headers {
		req.Header.Set(k, v)
	}

	client := &http.Client{Timeout: webhookTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()
	// Drain the body so the underlying TCP connection can be reused by the pool.
	_, _ = io.Copy(io.Discard, resp.Body)

	if resp.StatusCode >= 400 {
		return fmt.Errorf("webhook returned status %d", resp.StatusCode)
	}
	return nil
}
