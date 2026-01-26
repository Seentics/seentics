package repository

import (
	"analytics-app/internal/modules/websites/models"
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrWebsiteNotFound = errors.New("website not found")
)

type WebsiteRepository struct {
	db *pgxpool.Pool
}

func NewWebsiteRepository(db *pgxpool.Pool) *WebsiteRepository {
	return &WebsiteRepository{db: db}
}

// Create inserts a new website into the database
func (r *WebsiteRepository) Create(ctx context.Context, website *models.Website) error {
	query := `
		INSERT INTO websites (site_id, user_id, name, url, tracking_id, is_active, is_verified, verification_token, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id
	`

	err := r.db.QueryRow(ctx, query,
		website.SiteID,
		website.UserID,
		website.Name,
		website.URL,
		website.TrackingID,
		website.IsActive,
		website.IsVerified,
		website.VerificationToken,
		website.CreatedAt,
		website.UpdatedAt,
	).Scan(&website.ID)

	if err != nil {
		return fmt.Errorf("failed to create website: %w", err)
	}

	return nil
}

// ListByUserID returns all websites owned by a user
func (r *WebsiteRepository) ListByUserID(ctx context.Context, userID uuid.UUID) ([]models.Website, error) {
	query := `
		SELECT id, site_id, user_id, name, url, tracking_id, is_active, is_verified, verification_token, created_at, updated_at
		FROM websites
		WHERE user_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to list websites: %w", err)
	}
	defer rows.Close()

	var websites []models.Website
	for rows.Next() {
		var w models.Website
		err := rows.Scan(
			&w.ID,
			&w.SiteID,
			&w.UserID,
			&w.Name,
			&w.URL,
			&w.TrackingID,
			&w.IsActive,
			&w.IsVerified,
			&w.VerificationToken,
			&w.CreatedAt,
			&w.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan website: %w", err)
		}
		websites = append(websites, w)
	}

	return websites, nil
}

// GetByID returns a website by internal UUID
func (r *WebsiteRepository) GetByID(ctx context.Context, id uuid.UUID, userID uuid.UUID) (*models.Website, error) {
	query := `
		SELECT id, site_id, user_id, name, url, tracking_id, is_active, is_verified, verification_token, created_at, updated_at
		FROM websites
		WHERE id = $1 AND user_id = $2
	`

	var w models.Website
	err := r.db.QueryRow(ctx, query, id, userID).Scan(
		&w.ID,
		&w.SiteID,
		&w.UserID,
		&w.Name,
		&w.URL,
		&w.TrackingID,
		&w.IsActive,
		&w.IsVerified,
		&w.VerificationToken,
		&w.CreatedAt,
		&w.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrWebsiteNotFound
		}
		return nil, fmt.Errorf("failed to get website: %w", err)
	}

	return &w, nil
}

// GetBySiteID returns a website by public site_id
func (r *WebsiteRepository) GetBySiteID(ctx context.Context, siteID string) (*models.Website, error) {
	query := `
		SELECT id, site_id, user_id, name, url, tracking_id, is_active, is_verified, verification_token, created_at, updated_at
		FROM websites
		WHERE site_id = $1
	`

	var w models.Website
	err := r.db.QueryRow(ctx, query, siteID).Scan(
		&w.ID,
		&w.SiteID,
		&w.UserID,
		&w.Name,
		&w.URL,
		&w.TrackingID,
		&w.IsActive,
		&w.IsVerified,
		&w.VerificationToken,
		&w.CreatedAt,
		&w.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrWebsiteNotFound
		}
		return nil, fmt.Errorf("failed to get website by site_id: %w", err)
	}

	return &w, nil
}

// Delete removes a website
func (r *WebsiteRepository) Delete(ctx context.Context, id string, userID uuid.UUID) error {
	// id can be UUID string or SiteID string. We'll try both for safety but frontend usually sends public site_id or UUID
	query := `DELETE FROM websites WHERE (id::text = $1 OR site_id = $1) AND user_id = $2`
	result, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("failed to delete website: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrWebsiteNotFound
	}

	return nil
}

// Update updates website fields
func (r *WebsiteRepository) Update(ctx context.Context, website *models.Website) error {
	query := `
		UPDATE websites
		SET name = $1, url = $2, is_active = $3, updated_at = $4
		WHERE id = $5 AND user_id = $6
	`

	_, err := r.db.Exec(ctx, query,
		website.Name,
		website.URL,
		website.IsActive,
		time.Now(),
		website.ID,
		website.UserID,
	)

	if err != nil {
		return fmt.Errorf("failed to update website: %w", err)
	}

	return nil
}
