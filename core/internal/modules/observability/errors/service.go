package errors

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	stderrors "errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
)

const (
	errStream    = "sn:stream:obs:errors"
	errGroup     = "obs-errors"
	errWorker    = "obs-errors-worker"
	errBatchSize = 2000
	errFlush     = 2 * time.Second
)

// Valid status values for error groups.
const (
	StatusOpen     = "open"
	StatusResolved = "resolved"
	StatusIgnored  = "ignored"
)

type Service struct {
	repo   *Repository
	rdb    *redis.Client
	logger zerolog.Logger

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

func NewService(repo *Repository, rdb *redis.Client, logger zerolog.Logger) *Service {
	ctx, cancel := context.WithCancel(context.Background())
	s := &Service{repo: repo, rdb: rdb, logger: logger, ctx: ctx, cancel: cancel}

	bgCtx := context.Background()
	if err := rdb.XGroupCreateMkStream(bgCtx, errStream, errGroup, "$").Err(); err != nil {
		if !strings.Contains(err.Error(), "BUSYGROUP") {
			logger.Error().Err(err).Msg("Failed to create obs-errors consumer group")
		}
	}
	s.startConsumer()
	return s
}

// Ingest validates, fingerprints, and queues error events.
func (s *Service) Ingest(ctx context.Context, events []ErrorEvent) error {
	if len(events) == 0 {
		return nil
	}
	pipe := s.rdb.Pipeline()
	now := time.Now()
	for i := range events {
		if events[i].Timestamp.IsZero() {
			events[i].Timestamp = now
		}
		if events[i].Fingerprint == "" {
			events[i].Fingerprint = computeFingerprint(&events[i])
		}
		data, err := json.Marshal(&events[i])
		if err != nil {
			continue
		}
		pipe.XAdd(ctx, &redis.XAddArgs{
			Stream: errStream,
			MaxLen: 100000,
			Approx: true,
			Values: map[string]interface{}{"d": string(data)},
		})
	}
	_, err := pipe.Exec(ctx)
	return err
}

func (s *Service) ListGroups(ctx context.Context, projectID, service, status string, limit, offset int) ([]ErrorGroup, error) {
	if projectID == "" {
		return nil, fmt.Errorf("project_id is required")
	}
	return s.repo.ListGroups(ctx, projectID, service, status, limit, offset)
}

func (s *Service) UpdateGroupStatus(ctx context.Context, fingerprint, projectID, status string) error {
	switch status {
	case StatusOpen, StatusResolved, StatusIgnored:
	default:
		return fmt.Errorf("invalid status %q: must be open, resolved, or ignored", status)
	}
	return s.repo.UpdateGroupStatus(ctx, fingerprint, projectID, status)
}

func (s *Service) ListEvents(ctx context.Context, fingerprint, projectID string, limit int) ([]ErrorEvent, error) {
	if projectID == "" {
		return nil, fmt.Errorf("project_id is required")
	}
	return s.repo.ListEvents(ctx, fingerprint, projectID, limit)
}

func (s *Service) Shutdown(timeout time.Duration) error {
	s.cancel()
	done := make(chan struct{})
	go func() { s.wg.Wait(); close(done) }()
	select {
	case <-done:
		return nil
	case <-time.After(timeout):
		return fmt.Errorf("obs-errors shutdown timed out")
	}
}

// computeFingerprint produces a stable 16-char hex ID from the error's key fields.
// Strips transient data (hex addresses, IDs) so the same logical error always
// maps to the same group.
func computeFingerprint(e *ErrorEvent) string {
	msg := e.Message
	if idx := strings.IndexByte(msg, '\n'); idx >= 0 {
		msg = msg[:idx]
	}
	// Strip hex addresses like 0x7f3a...
	for {
		start := strings.Index(msg, "0x")
		if start < 0 {
			break
		}
		end := start + 2
		for end < len(msg) && isHexDigit(msg[end]) {
			end++
		}
		msg = msg[:start] + "0x?" + msg[end:]
	}
	h := sha256.Sum256([]byte(e.ProjectID + "|" + e.Service + "|" + e.ErrorType + "|" + msg))
	return hex.EncodeToString(h[:8]) // 16 hex characters
}

func isHexDigit(c byte) bool {
	return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')
}

func (s *Service) startConsumer() {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		for {
			select {
			case <-s.ctx.Done():
				return
			default:
			}

			msgs, err := s.rdb.XReadGroup(s.ctx, &redis.XReadGroupArgs{
				Group:    errGroup,
				Consumer: errWorker,
				Streams:  []string{errStream, ">"},
				Count:    errBatchSize,
				Block:    errFlush,
			}).Result()

			if err != nil {
				if stderrors.Is(err, context.Canceled) {
					return
				}
				if stderrors.Is(err, redis.Nil) {
					continue
				}
				s.logger.Error().Err(err).Msg("obs-errors stream read error")
				time.Sleep(time.Second)
				continue
			}

			if len(msgs) == 0 || len(msgs[0].Messages) == 0 {
				continue
			}

			rawMsgs := msgs[0].Messages
			batch := make([]ErrorEvent, 0, len(rawMsgs))
			ids := make([]string, 0, len(rawMsgs))

			for _, msg := range rawMsgs {
				ids = append(ids, msg.ID)
				data, ok := msg.Values["d"].(string)
				if !ok {
					continue
				}
				var e ErrorEvent
				if err := json.Unmarshal([]byte(data), &e); err != nil {
					continue
				}
				batch = append(batch, e)
			}

			if len(batch) > 0 {
				ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
				if err := s.repo.BatchInsertEvents(ctx, batch); err != nil {
					s.logger.Error().Err(err).Int("count", len(batch)).Msg("obs-errors batch insert failed")
				} else {
					s.logger.Debug().Int("count", len(batch)).Msg("obs-errors batch flushed to ClickHouse")
				}
				cancel()
			}

			if len(ids) > 0 {
				s.rdb.XAck(context.Background(), errStream, errGroup, ids...)
			}
		}
	}()
}
