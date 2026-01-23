package handlers

import (
	"github.com/seentics/seentics/services/gateway/kafka"
)

var kafkaService *kafka.KafkaService

func SetKafkaService(s *kafka.KafkaService) {
	kafkaService = s
}
