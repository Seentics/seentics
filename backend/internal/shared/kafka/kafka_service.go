package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"analytics-app/internal/modules/analytics/models"

	"github.com/rs/zerolog"
	"github.com/segmentio/kafka-go"
)

type KafkaService struct {
	producer *kafka.Writer
	reader   *kafka.Reader
	logger   zerolog.Logger
	topic    string
}

func NewKafkaService(bootstrapServers string, topic string, logger zerolog.Logger) *KafkaService {
	producer := &kafka.Writer{
		Addr:     kafka.TCP(bootstrapServers),
		Topic:    topic,
		Balancer: &kafka.LeastBytes{},
		// Async production for performance
		Async: true,
	}

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:  []string{bootstrapServers},
		GroupID:  "analytics-consumer-group",
		Topic:    topic,
		MinBytes: 10e3, // 10KB
		MaxBytes: 10e6, // 10MB
		// Commit messages after they are processed
		StartOffset: kafka.LastOffset,
	})

	return &KafkaService{
		producer: producer,
		reader:   reader,
		logger:   logger,
		topic:    topic,
	}
}

func (k *KafkaService) ProduceEvent(ctx context.Context, event models.Event) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	err = k.producer.WriteMessages(ctx, kafka.Message{
		Key:   []byte(event.WebsiteID),
		Value: payload,
		Time:  time.Now(),
	})

	if err != nil {
		k.logger.Error().Err(err).Msg("Failed to produce Kafka message")
		return err
	}

	return nil
}

func (k *KafkaService) ConsumeEvents(ctx context.Context, handler func(models.Event) error) {
	k.logger.Info().Str("topic", k.topic).Msg("Starting Kafka consumer")

	for {
		select {
		case <-ctx.Done():
			k.logger.Info().Msg("Kafka consumer stopping due to context cancellation")
			return
		default:
			m, err := k.reader.FetchMessage(ctx)
			if err != nil {
				if ctx.Err() != nil {
					return
				}
				k.logger.Error().Err(err).Msg("Failed to fetch message from Kafka")
				continue
			}

			var event models.Event
			if err := json.Unmarshal(m.Value, &event); err != nil {
				k.logger.Error().Err(err).Msg("Failed to unmarshal Kafka message")
				_ = k.reader.CommitMessages(ctx, m)
				continue
			}

			if err := handler(event); err != nil {
				k.logger.Error().Err(err).Msg("Failed to process event from Kafka")
				// We might want to retry or DLQ here, but for now we'll just log
			}

			if err := k.reader.CommitMessages(ctx, m); err != nil {
				k.logger.Error().Err(err).Msg("Failed to commit Kafka message")
			}
		}
	}
}

func (k *KafkaService) Close() error {
	if err := k.producer.Close(); err != nil {
		k.logger.Error().Err(err).Msg("Failed to close Kafka producer")
	}
	if err := k.reader.Close(); err != nil {
		k.logger.Error().Err(err).Msg("Failed to close Kafka reader")
	}
	return nil
}
