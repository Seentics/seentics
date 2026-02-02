package repository

import (
"analytics-app/internal/modules/abtests/models"
"context"

"github.com/jackc/pgx/v5/pgxpool"
)

type ABTestRepository struct {
db *pgxpool.Pool
}

func NewABTestRepository(db *pgxpool.Pool) *ABTestRepository {
return &ABTestRepository{db: db}
}

func (r *ABTestRepository) Create(ctx context.Context, test *models.ABTest) error {
tx, err := r.db.Begin(ctx)
if err != nil {
return err
}
defer tx.Rollback(ctx)

query := `
INSERT INTO ab_tests (website_id, name, description, status, goal)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, created_at, updated_at`

err = tx.QueryRow(ctx, query, test.WebsiteID, test.Name, test.Description, test.Status, test.Goal).
Scan(&test.ID, &test.CreatedAt, &test.UpdatedAt)
if err != nil {
return err
}

for i := range test.Variants {
v := &test.Variants[i]
vQuery := `
INSERT INTO ab_test_variants (ab_test_id, name, url, weight, is_control)
VALUES ($1, $2, $3, $4, $5)
RETURNING id`
err = tx.QueryRow(ctx, vQuery, test.ID, v.Name, v.URL, v.Weight, v.IsControl).Scan(&v.ID)
if err != nil {
return err
}
}

return tx.Commit(ctx)
}

func (r *ABTestRepository) List(ctx context.Context, websiteID string) ([]models.ABTest, error) {
query := `
SELECT id, website_id, name, description, status, goal, created_at, updated_at
FROM ab_tests
WHERE website_id = $1
ORDER BY created_at DESC`

rows, err := r.db.Query(ctx, query, websiteID)
if err != nil {
return nil, err
}
defer rows.Close()

var tests []models.ABTest
for rows.Next() {
var t models.ABTest
err := rows.Scan(&t.ID, &t.WebsiteID, &t.Name, &t.Description, &t.Status, &t.Goal, &t.CreatedAt, &t.UpdatedAt)
if err != nil {
return nil, err
}
tests = append(tests, t)
}

return tests, nil
}

func (r *ABTestRepository) GetByID(ctx context.Context, id, websiteID string) (*models.ABTest, error) {
var t models.ABTest
query := `
SELECT id, website_id, name, description, status, goal, created_at, updated_at
FROM ab_tests
WHERE id = $1 AND website_id = $2`

err := r.db.QueryRow(ctx, query, id, websiteID).Scan(
&t.ID, &t.WebsiteID, &t.Name, &t.Description, &t.Status, &t.Goal, &t.CreatedAt, &t.UpdatedAt,
)
if err != nil {
return nil, err
}

vQuery := `SELECT id, name, url, weight, is_control FROM ab_test_variants WHERE ab_test_id = $1`
vRows, err := r.db.Query(ctx, vQuery, t.ID)
if err != nil {
return nil, err
}
defer vRows.Close()

for vRows.Next() {
var v models.Variant
v.ABTestID = t.ID
err := vRows.Scan(&v.ID, &v.Name, &v.URL, &v.Weight, &v.IsControl)
if err != nil {
return nil, err
}
t.Variants = append(t.Variants, v)
}

return &t, nil
}
