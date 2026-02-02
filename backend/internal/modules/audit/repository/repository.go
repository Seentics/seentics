package repository

import (
"analytics-app/internal/modules/audit/models"
"context"

"github.com/jackc/pgx/v5/pgxpool"
)

type AuditRepository struct {
db *pgxpool.Pool
}

func NewAuditRepository(db *pgxpool.Pool) *AuditRepository {
return &AuditRepository{db: db}
}

func (r *AuditRepository) Create(ctx context.Context, log *models.AuditLog) error {
query := `
INSERT INTO audit_logs (website_id, user_id, action, entity_type, entity_id, details, ip_address, user_agent)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id, created_at`

return r.db.QueryRow(ctx, query,
log.WebsiteID, log.UserID, log.Action, log.ResourceType, log.ResourceID,
log.Metadata, log.IPAddress, log.UserAgent,
).Scan(&log.ID, &log.CreatedAt)
}

func (r *AuditRepository) GetByWebsite(ctx context.Context, websiteID string, limit, offset int) ([]models.AuditLog, error) {
query := `
SELECT id, website_id, user_id, action, entity_type, entity_id, details, ip_address, user_agent, created_at
FROM audit_logs
WHERE website_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3`

rows, err := r.db.Query(ctx, query, websiteID, limit, offset)
if err != nil {
return nil, err
}
defer rows.Close()

var logs []models.AuditLog
for rows.Next() {
var l models.AuditLog
err := rows.Scan(
&l.ID, &l.WebsiteID, &l.UserID, &l.Action, &l.ResourceType, &l.ResourceID,
&l.Metadata, &l.IPAddress, &l.UserAgent, &l.CreatedAt,
)
if err != nil {
return nil, err
}
logs = append(logs, l)
}
return logs, nil
}
