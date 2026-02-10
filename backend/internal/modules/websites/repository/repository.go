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
		INSERT INTO websites (site_id, user_id, name, url, tracking_id, is_active, is_verified, automation_enabled, funnel_enabled, heatmap_enabled, verification_token, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
		website.AutomationEnabled,
		website.FunnelEnabled,
		website.HeatmapEnabled,
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
		SELECT id, site_id, user_id, name, url, tracking_id, is_active, is_verified, automation_enabled, funnel_enabled, heatmap_enabled, verification_token, created_at, updated_at
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
			&w.AutomationEnabled,
			&w.FunnelEnabled,
			&w.HeatmapEnabled,
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
		SELECT id, site_id, user_id, name, url, tracking_id, is_active, is_verified, automation_enabled, funnel_enabled, heatmap_enabled, verification_token, created_at, updated_at
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
		&w.AutomationEnabled,
		&w.FunnelEnabled,
		&w.HeatmapEnabled,
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
		SELECT id, site_id, user_id, name, url, tracking_id, is_active, is_verified, automation_enabled, funnel_enabled, heatmap_enabled, verification_token, created_at, updated_at
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
		&w.AutomationEnabled,
		&w.FunnelEnabled,
		&w.HeatmapEnabled,
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

// GetByUUIDOnly returns a website by internal UUID without user_id check (use with caution)
func (r *WebsiteRepository) GetByUUIDOnly(ctx context.Context, id uuid.UUID) (*models.Website, error) {
	query := `
		SELECT id, site_id, user_id, name, url, tracking_id, is_active, is_verified, automation_enabled, funnel_enabled, heatmap_enabled, verification_token, created_at, updated_at
		FROM websites
		WHERE id = $1
	`

	var w models.Website
	err := r.db.QueryRow(ctx, query, id).Scan(
		&w.ID,
		&w.SiteID,
		&w.UserID,
		&w.Name,
		&w.URL,
		&w.TrackingID,
		&w.IsActive,
		&w.IsVerified,
		&w.AutomationEnabled,
		&w.FunnelEnabled,
		&w.HeatmapEnabled,
		&w.VerificationToken,
		&w.CreatedAt,
		&w.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrWebsiteNotFound
		}
		return nil, fmt.Errorf("failed to get website by uuid: %w", err)
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
		SET name = $1, url = $2, is_active = $3, automation_enabled = $4, funnel_enabled = $5, heatmap_enabled = $6, updated_at = $7
		WHERE id = $8 AND user_id = $9
	`

	_, err := r.db.Exec(ctx, query,
		website.Name,
		website.URL,
		website.IsActive,
		website.AutomationEnabled,
		website.FunnelEnabled,
		website.HeatmapEnabled,
		time.Now(),
		website.ID,
		website.UserID,
	)

	if err != nil {
		return fmt.Errorf("failed to update website: %w", err)
	}

	return nil
}

// --- Goals ---

func (r *WebsiteRepository) ListGoals(ctx context.Context, websiteID uuid.UUID) ([]models.Goal, error) {
	query := `SELECT id, website_id, name, type, identifier, selector, created_at, updated_at FROM goals WHERE website_id = $1 ORDER BY created_at DESC`
	rows, err := r.db.Query(ctx, query, websiteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var goals []models.Goal
	for rows.Next() {
		var g models.Goal
		if err := rows.Scan(&g.ID, &g.WebsiteID, &g.Name, &g.Type, &g.Identifier, &g.Selector, &g.CreatedAt, &g.UpdatedAt); err != nil {
			return nil, err
		}
		goals = append(goals, g)
	}
	return goals, nil
}

func (r *WebsiteRepository) CreateGoal(ctx context.Context, goal *models.Goal) error {
	query := `INSERT INTO goals (website_id, name, type, identifier, selector, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`
	return r.db.QueryRow(ctx, query, goal.WebsiteID, goal.Name, goal.Type, goal.Identifier, goal.Selector, time.Now(), time.Now()).Scan(&goal.ID)
}

func (r *WebsiteRepository) DeleteGoal(ctx context.Context, id uuid.UUID, websiteID uuid.UUID) error {
	query := `DELETE FROM goals WHERE id = $1 AND website_id = $2`
	_, err := r.db.Exec(ctx, query, id, websiteID)
	return err
}

// --- Members ---

func (r *WebsiteRepository) ListMembers(ctx context.Context, websiteID uuid.UUID) ([]models.WebsiteMember, error) {
	query := `
		SELECT m.id, m.website_id, m.user_id, m.role, m.created_at, m.updated_at, u.name as user_name, u.email as user_email
		FROM website_members m
		JOIN users u ON m.user_id = u.id
		WHERE m.website_id = $1
		ORDER BY m.created_at ASC
	`
	rows, err := r.db.Query(ctx, query, websiteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []models.WebsiteMember
	for rows.Next() {
		var m models.WebsiteMember
		if err := rows.Scan(&m.ID, &m.WebsiteID, &m.UserID, &m.Role, &m.CreatedAt, &m.UpdatedAt, &m.UserName, &m.UserEmail); err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	return members, nil
}

func (r *WebsiteRepository) AddMember(ctx context.Context, member *models.WebsiteMember) error {
	query := `INSERT INTO website_members (website_id, user_id, role, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) RETURNING id`
	return r.db.QueryRow(ctx, query, member.WebsiteID, member.UserID, member.Role, time.Now(), time.Now()).Scan(&member.ID)
}

func (r *WebsiteRepository) UpdateMemberRole(ctx context.Context, websiteID, userID uuid.UUID, role string) error {
	query := `UPDATE website_members SET role = $1, updated_at = $2 WHERE website_id = $3 AND user_id = $4`
	_, err := r.db.Exec(ctx, query, role, time.Now(), websiteID, userID)
	return err
}

func (r *WebsiteRepository) RemoveMember(ctx context.Context, websiteID, userID uuid.UUID) error {
	query := `DELETE FROM website_members WHERE website_id = $1 AND user_id = $2`
	_, err := r.db.Exec(ctx, query, websiteID, userID)
	return err
}

func (r *WebsiteRepository) GetMember(ctx context.Context, websiteID, userID uuid.UUID) (*models.WebsiteMember, error) {
	query := `SELECT id, website_id, user_id, role, created_at, updated_at FROM website_members WHERE website_id = $1 AND user_id = $2`
	var m models.WebsiteMember
	err := r.db.QueryRow(ctx, query, websiteID, userID).Scan(&m.ID, &m.WebsiteID, &m.UserID, &m.Role, &m.CreatedAt, &m.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &m, nil
}
