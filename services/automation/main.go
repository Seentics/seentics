package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/segmentio/kafka-go"
)

func main() {
	fmt.Println("Seentics Automation Service starting...")

	bootstrapServers := os.Getenv("KAFKA_BOOTSTRAP_SERVERS")
	if bootstrapServers == "" {
		bootstrapServers = "localhost:9092"
	}

	// Consumer for user registration events
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:     []string{bootstrapServers},
		GroupID:     "automation-group-new", // New group to force re-reading
		Topic:       "user_events",
		MinBytes:    10,   // Small for testing
		MaxBytes:    10e6, // 10MB
		StartOffset: kafka.FirstOffset,
	})
	defer reader.Close()

	fmt.Printf("Connected to Kafka at %s, consuming from 'user_events'\n", bootstrapServers)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		for {
			m, err := reader.ReadMessage(ctx)
			if err != nil {
				if ctx.Err() != nil {
					return
				}
				log.Printf("Error reading message: %v", err)
				continue
			}

			fmt.Printf("Automation Service: Received event on topic %s, partition %d, offset %d\n", m.Topic, m.Partition, m.Offset)

			var event map[string]interface{}
			if err := json.Unmarshal(m.Value, &event); err != nil {
				log.Printf("Error unmarshaling event: %v", err)
				continue
			}

			fmt.Printf("Processing automation for event: %+v\n", event)

			// Simulate automation logic (e.g. sending welcome email)
			if event["email"] != nil {
				fmt.Printf(">>> Sending welcome email to %s...\n", event["email"])
				time.Sleep(1 * time.Second)
				fmt.Println(">>> Welcome email sent!")
			}
		}
	}()

	<-sigChan
	fmt.Println("Automation Service shutting down...")
}
