package logs

import (
	"context"
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
	logStream    = "sn:stream:obs:logs"
	logGroup     = "obs-logs"
	logWorker    = "obs-logs-worker"
	logBatchSize = 5000
	logFlush     = 2 * time.Second
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
	if err := rdb.XGroupCreateMkStream(bgCtx, logStream, logGroup, "$").Err(); err != nil {
		if !strings.Contains(err.Error(), "BUSYGROUP") {
			logger.Error().Err(err).Msg("Failed to create obs-logs consumer group")
		}
	}
	s.startConsumer()
	return s
}

// Ingest publishes log entries onto the Redis Stream. Returns 202 immediately.
func (s *Service) Ingest(ctx context.Context, entries []LogEntry) error {
	if len(entries) == 0 {
		return nil
	}
	pipe := s.rdb.Pipeline()
	now := time.Now()
	for i := range entries {
		if entries[i].Timestamp.IsZero() {
			entries[i].Timestamp = now
		}
		data, err := json.Marshal(&entries[i])
		if err != nil {
			continue
		}
		pipe.XAdd(ctx, &redis.XAddArgs{
			Stream: logStream,
			MaxLen: 200000,
			Approx: true,
			Values: map[string]interface{}{"d": string(data)},
		})
	}
	_, err := pipe.Exec(ctx)
	return err
}

func (s *Service) Query(ctx context.Context, p QueryParams) ([]LogEntry, error) {
	if p.ProjectID == "" {
		return nil, fmt.Errorf("project_id is required")
	}
	return s.repo.Query(ctx, p)
}

func (s *Service) Shutdown(timeout time.Duration) error {
	s.cancel()
	done := make(chan struct{})
	go func() { s.wg.Wait(); close(done) }()
	select {
	case <-done:
		return nil
	case <-time.After(timeout):
		return fmt.Errorf("obs-logs shutdown timed out")
	}
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
				Group:    logGroup,
				Consumer: logWorker,
				Streams:  []string{logStream, ">"},
				Count:    logBatchSize,
				Block:    logFlush,
			}).Result()

			if err != nil {
				if stderrors.Is(err, context.Canceled) {
					return
				}
				if stderrors.Is(err, redis.Nil) {
					continue
				}
				s.logger.Error().Err(err).Msg("obs-logs stream read error")
				time.Sleep(time.Second)
				continue
			}

			if len(msgs) == 0 || len(msgs[0].Messages) == 0 {
				continue
			}

			rawMsgs := msgs[0].Messages
			batch := make([]LogEntry, 0, len(rawMsgs))
			ids := make([]string, 0, len(rawMsgs))

			for _, msg := range rawMsgs {
				ids = append(ids, msg.ID)
				data, ok := msg.Values["d"].(string)
				if !ok {
					continue
				}
				var entry LogEntry
				if err := json.Unmarshal([]byte(data), &entry); err != nil {
					continue
				}
				batch = append(batch, entry)
			}

			if len(batch) > 0 {
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				if err := s.repo.BatchInsert(ctx, batch); err != nil {
					s.logger.Error().Err(err).Int("count", len(batch)).Msg("obs-logs batch insert failed")
				} else {
					s.logger.Debug().Int("count", len(batch)).Msg("obs-logs batch flushed to ClickHouse")
				}
				cancel()
			}

			// ACK regardless — same as the analytics event service pattern.
			if len(ids) > 0 {
				s.rdb.XAck(context.Background(), logStream, logGroup, ids...)
			}
		}
	}()
}
