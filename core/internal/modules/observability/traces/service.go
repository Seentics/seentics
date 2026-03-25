package traces

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
	spanStream    = "sn:stream:obs:spans"
	spanGroup     = "obs-spans"
	spanWorker    = "obs-spans-worker"
	spanBatchSize = 5000
	spanFlush     = 2 * time.Second
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
	if err := rdb.XGroupCreateMkStream(bgCtx, spanStream, spanGroup, "$").Err(); err != nil {
		if !strings.Contains(err.Error(), "BUSYGROUP") {
			logger.Error().Err(err).Msg("Failed to create obs-spans consumer group")
		}
	}
	s.startConsumer()
	return s
}

// Ingest queues spans for batch writing to ClickHouse.
func (s *Service) Ingest(ctx context.Context, spans []Span) error {
	if len(spans) == 0 {
		return nil
	}
	pipe := s.rdb.Pipeline()
	now := time.Now()
	for i := range spans {
		if spans[i].Timestamp.IsZero() {
			spans[i].Timestamp = now
		}
		// Compute DurationMS from StartTime/EndTime if not provided.
		if spans[i].DurationMS == 0 && !spans[i].StartTime.IsZero() && !spans[i].EndTime.IsZero() {
			spans[i].DurationMS = spans[i].EndTime.Sub(spans[i].StartTime).Milliseconds()
		}
		data, err := json.Marshal(&spans[i])
		if err != nil {
			continue
		}
		pipe.XAdd(ctx, &redis.XAddArgs{
			Stream: spanStream,
			MaxLen: 200000,
			Approx: true,
			Values: map[string]interface{}{"d": string(data)},
		})
	}
	_, err := pipe.Exec(ctx)
	return err
}

func (s *Service) ListTraces(ctx context.Context, projectID, service string, from, to *time.Time, limit, offset int) ([]TraceListItem, error) {
	if projectID == "" {
		return nil, fmt.Errorf("project_id is required")
	}
	return s.repo.ListTraces(ctx, projectID, service, from, to, limit, offset)
}

func (s *Service) GetTrace(ctx context.Context, projectID, traceID string) ([]Span, error) {
	if projectID == "" {
		return nil, fmt.Errorf("project_id is required")
	}
	return s.repo.GetTrace(ctx, projectID, traceID)
}

func (s *Service) Shutdown(timeout time.Duration) error {
	s.cancel()
	done := make(chan struct{})
	go func() { s.wg.Wait(); close(done) }()
	select {
	case <-done:
		return nil
	case <-time.After(timeout):
		return fmt.Errorf("obs-spans shutdown timed out")
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
				Group:    spanGroup,
				Consumer: spanWorker,
				Streams:  []string{spanStream, ">"},
				Count:    spanBatchSize,
				Block:    spanFlush,
			}).Result()

			if err != nil {
				if stderrors.Is(err, context.Canceled) {
					return
				}
				if stderrors.Is(err, redis.Nil) {
					continue
				}
				s.logger.Error().Err(err).Msg("obs-spans stream read error")
				time.Sleep(time.Second)
				continue
			}

			if len(msgs) == 0 || len(msgs[0].Messages) == 0 {
				continue
			}

			rawMsgs := msgs[0].Messages
			batch := make([]Span, 0, len(rawMsgs))
			ids := make([]string, 0, len(rawMsgs))

			for _, msg := range rawMsgs {
				ids = append(ids, msg.ID)
				data, ok := msg.Values["d"].(string)
				if !ok {
					continue
				}
				var span Span
				if err := json.Unmarshal([]byte(data), &span); err != nil {
					continue
				}
				batch = append(batch, span)
			}

			if len(batch) > 0 {
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				if err := s.repo.BatchInsert(ctx, batch); err != nil {
					s.logger.Error().Err(err).Int("count", len(batch)).Msg("obs-spans batch insert failed")
				} else {
					s.logger.Debug().Int("count", len(batch)).Msg("obs-spans batch flushed to ClickHouse")
				}
				cancel()
			}

			if len(ids) > 0 {
				s.rdb.XAck(context.Background(), spanStream, spanGroup, ids...)
			}
		}
	}()
}
