package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/segmentio/kafka-go"
)

type KafkaService struct {
	writer *kafka.Writer
	addr   string
}

func NewKafkaService(bootstrapServers string) *KafkaService {
	return &KafkaService{
		writer: &kafka.Writer{
			Addr:     kafka.TCP(bootstrapServers),
			Balancer: &kafka.LeastBytes{},
			Async:    true,
		},
		addr: bootstrapServers,
	}
}

func (k *KafkaService) ProduceEvent(ctx context.Context, topic string, key string, data interface{}) error {
	payload, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	err = k.writer.WriteMessages(ctx, kafka.Message{
		Topic: topic,
		Key:   []byte(key),
		Value: payload,
		Time:  time.Now(),
	})

	return err
}

func (k *KafkaService) Close() error {
	return k.writer.Close()
}
