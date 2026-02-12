package repository

import (
"analytics-app/internal/modules/notifications/models"
"context"

"github.com/jackc/pgx/v5/pgxpool"
)

type NotificationRepository struct {
db *pgxpool.Pool
}

func NewNotificationRepository(db *pgxpool.Pool) *NotificationRepository {
return &NotificationRepository{db: db}
}

func (r *NotificationRepository) Create(ctx context.Context, n *models.Notification) error {
query := `
INSERT INTO notifications (user_id, type, title, message, link)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, is_read, created_at`

return r.db.QueryRow(ctx, query, n.UserID, n.Type, n.Title, n.Message, n.Link).
Scan(&n.ID, &n.IsRead, &n.CreatedAt)
}

func (r *NotificationRepository) List(ctx context.Context, userID string) ([]models.Notification, error) {
query := `
SELECT id, user_id, type, title, message, is_read, link, created_at
FROM notifications
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 50`

rows, err := r.db.Query(ctx, query, userID)
if err != nil {
return nil, err
}
defer rows.Close()

var list []models.Notification
for rows.Next() {
var n models.Notification
err := rows.Scan(&n.ID, &n.UserID, &n.Type, &n.Title, &n.Message, &n.IsRead, &n.Link, &n.CreatedAt)
if err != nil {
return nil, err
}
list = append(list, n)
}
return list, nil
}

func (r *NotificationRepository) MarkAsRead(ctx context.Context, id, userID string) error {
query := `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`
_, err := r.db.Exec(ctx, query, id, userID)
return err
}

func (r *NotificationRepository) MarkAllAsRead(ctx context.Context, userID string) error {
query := `UPDATE notifications SET is_read = true WHERE user_id = $1`
_, err := r.db.Exec(ctx, query, userID)
return err
}
