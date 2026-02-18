package nats

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"analytics-app/internal/modules/analytics/models"

	"github.com/nats-io/nats.go"
	"github.com/rs/zerolog"
)

type NATSService struct {
	conn    *nats.Conn
	js      nats.JetStreamContext
	logger  zerolog.Logger
	subject string
	stream  string
}

func NewNATSService(url, subject string, logger zerolog.Logger) (*NATSService, error) {
	// Connect to NATS with reconnect options
	conn, err := nats.Connect(url,
		nats.RetryOnFailedConnect(true),
		nats.MaxReconnects(-1),
		nats.ReconnectWait(2*time.Second),
		nats.DisconnectErrHandler(func(_ *nats.Conn, err error) {
			if err != nil {
				logger.Warn().Err(err).Msg("NATS disconnected")
			}
		}),
		nats.ReconnectHandler(func(_ *nats.Conn) {
			logger.Info().Msg("NATS reconnected")
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to NATS: %w", err)
	}

	// Create JetStream context
	js, err := conn.JetStream()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to create JetStream context: %w", err)
	}

	streamName := "ANALYTICS"

	// Create or update the stream
	_, err = js.AddStream(&nats.StreamConfig{
		Name:      streamName,
		Subjects:  []string{subject},
		Retention: nats.WorkQueuePolicy,
		MaxAge:    24 * time.Hour, // Keep messages for 24h max
		Storage:   nats.FileStorage,
		Replicas:  1,
	})
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to create/update JetStream stream: %w", err)
	}

	logger.Info().
		Str("url", url).
		Str("stream", streamName).
		Str("subject", subject).
		Msg("Connected to NATS JetStream")

	return &NATSService{
		conn:    conn,
		js:      js,
		logger:  logger,
		subject: subject,
		stream:  streamName,
	}, nil
}

func (n *NATSService) ProduceEvent(ctx context.Context, event models.Event) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	// Async publish for performance (fire-and-forget like Kafka async mode)
	_, err = n.js.PublishAsync(n.subject, payload)
	if err != nil {
		n.logger.Error().Err(err).Msg("Failed to publish NATS message")
		return err
	}

	return nil
}

func (n *NATSService) ConsumeEvents(ctx context.Context, handler func(models.Event) error) {
	n.logger.Info().Str("subject", n.subject).Msg("Starting NATS consumer")

	// Create a durable pull subscriber
	sub, err := n.js.PullSubscribe(n.subject, "analytics-consumer",
		nats.AckExplicit(),
		nats.MaxDeliver(3),
		nats.AckWait(30*time.Second),
	)
	if err != nil {
		n.logger.Error().Err(err).Msg("Failed to create NATS pull subscriber")
		return
	}

	for {
		select {
		case <-ctx.Done():
			n.logger.Info().Msg("NATS consumer stopping due to context cancellation")
			return
		default:
			// Fetch batch of messages (up to 100 at a time, 500ms timeout)
			msgs, err := sub.Fetch(100, nats.MaxWait(500*time.Millisecond))
			if err != nil {
				if err == nats.ErrTimeout {
					continue // No messages available, try again
				}
				if ctx.Err() != nil {
					return
				}
				n.logger.Error().Err(err).Msg("Failed to fetch messages from NATS")
				continue
			}

			for _, msg := range msgs {
				var event models.Event
				if err := json.Unmarshal(msg.Data, &event); err != nil {
					n.logger.Error().Err(err).Msg("Failed to unmarshal NATS message")
					_ = msg.Ack()
					continue
				}

				if err := handler(event); err != nil {
					n.logger.Error().Err(err).Msg("Failed to process event from NATS")
				}

				if err := msg.Ack(); err != nil {
					n.logger.Error().Err(err).Msg("Failed to ack NATS message")
				}
			}
		}
	}
}

func (n *NATSService) Close() error {
	// Drain ensures all buffered messages are processed before closing
	if err := n.conn.Drain(); err != nil {
		n.logger.Error().Err(err).Msg("Failed to drain NATS connection")
		n.conn.Close()
		return err
	}
	n.logger.Info().Msg("NATS connection closed")
	return nil
}
