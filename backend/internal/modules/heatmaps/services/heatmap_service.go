package services

import (
	"analytics-app/internal/modules/heatmaps/models"
	"analytics-app/internal/modules/heatmaps/repository"
	"context"
	"time"
)

type HeatmapService interface {
	RecordHeatmapData(req models.HeatmapRecordRequest) error
	GetHeatmapData(ctx context.Context, websiteID string, url string, heatmapType string, from, to time.Time) ([]models.HeatmapPoint, error)
	GetHeatmapPages(ctx context.Context, websiteID string) ([]string, error)
}

type heatmapService struct {
	repo repository.HeatmapRepository
}

func NewHeatmapService(repo repository.HeatmapRepository) HeatmapService {
	return &heatmapService{repo: repo}
}

func (s *heatmapService) RecordHeatmapData(req models.HeatmapRecordRequest) error {
	return s.repo.RecordHeatmap(context.Background(), req.WebsiteID, req.Points)
}

func (s *heatmapService) GetHeatmapData(ctx context.Context, websiteID string, url string, heatmapType string, from, to time.Time) ([]models.HeatmapPoint, error) {
	return s.repo.GetHeatmapData(ctx, websiteID, url, heatmapType, from, to)
}

func (s *heatmapService) GetHeatmapPages(ctx context.Context, websiteID string) ([]string, error) {
	return s.repo.GetHeatmapPages(ctx, websiteID)
}
