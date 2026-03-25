package metrics

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
	metricStream    = "sn:stream:obs:metrics"
	metricGroup     = "obs-metrics"
	metricWorker    = "obs-metrics-worker"
	metricBatchSize = 10000
	metricFlush     = 2 * time.Second
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
	if err := rdb.XGroupCreateMkStream(bgCtx, metricStream, metricGroup, "$").Err(); err != nil {
		if !strings.Contains(err.Error(), "BUSYGROUP") {
			logger.Error().Err(err).Msg("Failed to create obs-metrics consumer group")
		}
	}
	s.startConsumer()
	return s
}

// Ingest queues metric points for batch writing to ClickHouse.
func (s *Service) Ingest(ctx context.Context, points []MetricPoint) error {
	if len(points) == 0 {
		return nil
	}
	pipe := s.rdb.Pipeline()
	now := time.Now()
	for i := range points {
		if points[i].Timestamp.IsZero() {
			points[i].Timestamp = now
		}
		data, err := json.Marshal(&points[i])
		if err != nil {
			continue
		}
		pipe.XAdd(ctx, &redis.XAddArgs{
			Stream: metricStream,
			MaxLen: 500000,
			Approx: true,
			Values: map[string]interface{}{"d": string(data)},
		})
	}
	_, err := pipe.Exec(ctx)
	return err
}

func (s *Service) Query(ctx context.Context, p QueryParams) ([]MetricBucket, error) {
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
		return fmt.Errorf("obs-metrics shutdown timed out")
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
				Group:    metricGroup,
				Consumer: metricWorker,
				Streams:  []string{metricStream, ">"},
				Count:    metricBatchSize,
				Block:    metricFlush,
			}).Result()

			if err != nil {
				if stderrors.Is(err, context.Canceled) {
					return
				}
				if stderrors.Is(err, redis.Nil) {
					continue
				}
				s.logger.Error().Err(err).Msg("obs-metrics stream read error")
				time.Sleep(time.Second)
				continue
			}

			if len(msgs) == 0 || len(msgs[0].Messages) == 0 {
				continue
			}

			rawMsgs := msgs[0].Messages
			batch := make([]MetricPoint, 0, len(rawMsgs))
			ids := make([]string, 0, len(rawMsgs))

			for _, msg := range rawMsgs {
				ids = append(ids, msg.ID)
				data, ok := msg.Values["d"].(string)
				if !ok {
					continue
				}
				var pt MetricPoint
				if err := json.Unmarshal([]byte(data), &pt); err != nil {
					continue
				}
				batch = append(batch, pt)
			}

			if len(batch) > 0 {
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				if err := s.repo.BatchInsert(ctx, batch); err != nil {
					s.logger.Error().Err(err).Int("count", len(batch)).Msg("obs-metrics batch insert failed")
				} else {
					s.logger.Debug().Int("count", len(batch)).Msg("obs-metrics batch flushed to ClickHouse")
				}
				cancel()
			}

			if len(ids) > 0 {
				s.rdb.XAck(context.Background(), metricStream, metricGroup, ids...)
			}
		}
	}()
}
