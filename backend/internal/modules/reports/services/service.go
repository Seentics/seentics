package services

import (
	"analytics-app/internal/modules/reports/models"
	"analytics-app/internal/modules/reports/repository"
	"context"
)

type ReportService struct {
	repo *repository.ReportRepository
}

func NewReportService(repo *repository.ReportRepository) *ReportService {
	return &ReportService{repo: repo}
}

func (s *ReportService) CreateReport(ctx context.Context, websiteID, userID string, req models.CreateReportRequest) (*models.SavedReport, error) {
	report := &models.SavedReport{
		WebsiteID: websiteID,
		UserID:    userID,
		Name:      req.Name,
		Filters:   req.Filters,
	}

	if err := s.repo.Create(ctx, report); err != nil {
		return nil, err
	}

	return report, nil
}

func (s *ReportService) ListReports(ctx context.Context, websiteID string) ([]models.SavedReport, error) {
	return s.repo.List(ctx, websiteID)
}

func (s *ReportService) DeleteReport(ctx context.Context, id, websiteID string) error {
	return s.repo.Delete(ctx, id, websiteID)
}
