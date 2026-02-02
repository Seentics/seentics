package services

import (
"analytics-app/internal/modules/audit/models"
"analytics-app/internal/modules/audit/repository"
"context"
)

type AuditService interface {
CreateLog(ctx context.Context, log *models.AuditLog) error
GetWebsiteLogs(ctx context.Context, websiteID string, page, pageSize int) ([]models.AuditLog, error)
}

type auditService struct {
repo *repository.AuditRepository
}

func NewAuditService(repo *repository.AuditRepository) AuditService {
return &auditService{repo: repo}
}

func (s *auditService) CreateLog(ctx context.Context, log *models.AuditLog) error {
return s.repo.Create(ctx, log)
}

func (s *auditService) GetWebsiteLogs(ctx context.Context, websiteID string, page, pageSize int) ([]models.AuditLog, error) {
if page < 1 {
page = 1
}
if pageSize < 1 || pageSize > 100 {
pageSize = 20
}
offset := (page - 1) * pageSize
return s.repo.GetByWebsite(ctx, websiteID, pageSize, offset)
}
