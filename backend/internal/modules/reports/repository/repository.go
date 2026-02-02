package repository

import (
"analytics-app/internal/modules/reports/models"
"context"
"encoding/json"

"github.com/jackc/pgx/v5/pgxpool"
)

type ReportRepository struct {
db *pgxpool.Pool
}

func NewReportRepository(db *pgxpool.Pool) *ReportRepository {
return &ReportRepository{db: db}
}

func (r *ReportRepository) Create(ctx context.Context, report *models.SavedReport) error {
filtersJSON, _ := json.Marshal(report.Filters)
query := `
INSERT INTO saved_reports (website_id, user_id, name, filters)
VALUES ($1, $2, $3, $4)
RETURNING id, created_at, updated_at`

return r.db.QueryRow(ctx, query,
report.WebsiteID,
report.UserID,
report.Name,
filtersJSON,
).Scan(&report.ID, &report.CreatedAt, &report.UpdatedAt)
}

func (r *ReportRepository) List(ctx context.Context, websiteID string) ([]models.SavedReport, error) {
query := `
SELECT id, website_id, user_id, name, filters, created_at, updated_at
FROM saved_reports
WHERE website_id = $1
ORDER BY created_at DESC`

rows, err := r.db.Query(ctx, query, websiteID)
if err != nil {
return nil, err
}
defer rows.Close()

var reports []models.SavedReport
for rows.Next() {
var repo models.SavedReport
var filters []byte
err := rows.Scan(
&repo.ID, &repo.WebsiteID, &repo.UserID, &repo.Name, &filters, &repo.CreatedAt, &repo.UpdatedAt,
)
if err != nil {
return nil, err
}
json.Unmarshal(filters, &repo.Filters)
reports = append(reports, repo)
}

return reports, nil
}

func (r *ReportRepository) Delete(ctx context.Context, id, websiteID string) error {
query := `DELETE FROM saved_reports WHERE id = $1 AND website_id = $2`
_, err := r.db.Exec(ctx, query, id, websiteID)
return err
}
