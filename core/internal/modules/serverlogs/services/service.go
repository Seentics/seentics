package services

import (
	"analytics-app/internal/modules/serverlogs/models"
	"analytics-app/internal/modules/serverlogs/repository"
	"context"
	"crypto/rand"
	"fmt"
	"time"
)

type LogsService struct {
	repo *repository.LogsRepository
}

func NewLogsService(repo *repository.LogsRepository) *LogsService {
	return &LogsService{repo: repo}
}

func generateID(prefix string) string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("%s_%x", prefix, b)
}

func (s *LogsService) IngestLog(ctx context.Context, level, message, source string, metadata []byte) (*models.LogEntry, error) {
	entry := &models.LogEntry{
		ID:        generateID("log"),
		Timestamp: time.Now(),
		Level:     level,
		Message:   message,
		Source:    source,
		Metadata:  metadata,
	}
	if err := s.repo.IngestLog(ctx, entry); err != nil {
		return nil, err
	}
	return entry, nil
}

func (s *LogsService) IngestMetric(ctx context.Context, name string, value float64, labels []byte) (*models.MetricEntry, error) {
	entry := &models.MetricEntry{
		ID:        generateID("met"),
		Timestamp: time.Now(),
		Name:      name,
		Value:     value,
		Labels:    labels,
	}
	if err := s.repo.IngestMetric(ctx, entry); err != nil {
		return nil, err
	}
	return entry, nil
}

func (s *LogsService) GetLogs(ctx context.Context, q models.LogQuery) ([]models.LogEntry, error) {
	if q.StartTime.IsZero() {
		q.StartTime = time.Now().Add(-24 * time.Hour)
	}
	if q.EndTime.IsZero() {
		q.EndTime = time.Now()
	}
	return s.repo.QueryLogs(ctx, q)
}

func (s *LogsService) GetMetrics(ctx context.Context, name string, start, end time.Time) ([]models.MetricEntry, error) {
	if start.IsZero() {
		start = time.Now().Add(-1 * time.Hour)
	}
	if end.IsZero() {
		end = time.Now()
	}
	return s.repo.QueryMetrics(ctx, models.MetricQuery{
		Name:      name,
		StartTime: start,
		EndTime:   end,
	})
}
