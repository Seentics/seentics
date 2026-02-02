package models

import "time"

type Notification struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Type      string    `json:"type"` // 'info', 'warning', 'error', 'billing'
	Title     string    `json:"title"`
	Message   string    `json:"message"`
	IsRead    bool      `json:"is_read"`
	Link      string    `json:"link,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type CreateNotificationRequest struct {
	UserID  string `json:"user_id"`
	Type    string `json:"type"`
	Title   string `json:"title"`
	Message string `json:"message"`
	Link    string `json:"link,omitempty"`
}
