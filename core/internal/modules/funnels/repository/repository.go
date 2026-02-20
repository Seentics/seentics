package repository

import (
	"analytics-app/internal/modules/funnels/models"
	"context"
	"fmt"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type FunnelRepository struct {
	db *pgxpool.Pool
	ch driver.Conn
}

func NewFunnelRepository(db *pgxpool.Pool, ch driver.Conn) *FunnelRepository {
	return &FunnelRepository{
		db: db,
		ch: ch,
	}
}

// ListFunnels retrieves all funnels for a website
func (r *FunnelRepository) ListFunnels(ctx context.Context, websiteID string) ([]models.Funnel, error) {
	return r.listFunnelsInternal(ctx, websiteID, false)
}

// GetActiveFunnels retrieves only active funnels for a website
func (r *FunnelRepository) GetActiveFunnels(ctx context.Context, websiteID string) ([]models.Funnel, error) {
	return r.listFunnelsInternal(ctx, websiteID, true)
}

func (r *FunnelRepository) listFunnelsInternal(ctx context.Context, websiteID string, onlyActive bool) ([]models.Funnel, error) {
	query := `
		SELECT id, website_id, user_id, name, description, is_active, created_at, updated_at
		FROM funnels
		WHERE website_id = $1
	`
	if onlyActive {
		query += " AND is_active = true"
	}
	query += " ORDER BY created_at DESC"

	rows, err := r.db.Query(ctx, query, websiteID)
	if err != nil {
		return nil, fmt.Errorf("failed to query funnels: %w", err)
	}
	defer rows.Close()

	var funnels []models.Funnel
	for rows.Next() {
		var f models.Funnel
		err := rows.Scan(
			&f.ID, &f.WebsiteID, &f.UserID, &f.Name, &f.Description,
			&f.IsActive, &f.CreatedAt, &f.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan funnel: %w", err)
		}

		// Load steps for each funnel
		f.Steps, _ = r.GetStepsByFunnelID(ctx, f.ID)

		funnels = append(funnels, f)
	}

	return funnels, nil
}

// GetFunnelByID retrieves a single funnel by ID
func (r *FunnelRepository) GetFunnelByID(ctx context.Context, id string) (*models.Funnel, error) {
	query := `
		SELECT id, website_id, user_id, name, description, is_active, created_at, updated_at
		FROM funnels
		WHERE id = $1
	`

	var f models.Funnel
	err := r.db.QueryRow(ctx, query, id).Scan(
		&f.ID, &f.WebsiteID, &f.UserID, &f.Name, &f.Description,
		&f.IsActive, &f.CreatedAt, &f.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("funnel not found")
		}
		return nil, fmt.Errorf("failed to get funnel: %w", err)
	}

	// Load steps
	f.Steps, _ = r.GetStepsByFunnelID(ctx, f.ID)

	return &f, nil
}

// CreateFunnel creates a new funnel with its steps
func (r *FunnelRepository) CreateFunnel(ctx context.Context, funnel *models.Funnel) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	if funnel.ID == "" {
		funnel.ID = uuid.New().String()
	}

	query := `
		INSERT INTO funnels (id, website_id, user_id, name, description, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	now := time.Now()
	_, err = tx.Exec(ctx, query,
		funnel.ID, funnel.WebsiteID, funnel.UserID, funnel.Name,
		funnel.Description, funnel.IsActive, now, now,
	)
	if err != nil {
		return fmt.Errorf("failed to insert funnel: %w", err)
	}

	// Insert steps — preserve the user-supplied order values
	for _, step := range funnel.Steps {
		step.ID = uuid.New().String()
		step.FunnelID = funnel.ID
		// Do NOT override step.Order — use the value from the request

		stepQuery := `
			INSERT INTO funnel_steps (id, funnel_id, name, step_order, step_type, page_path, event_type, match_type, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`
		_, err = tx.Exec(ctx, stepQuery,
			step.ID, step.FunnelID, step.Name, step.Order,
			step.StepType, step.PagePath, step.EventType, step.MatchType, now,
		)
		if err != nil {
			return fmt.Errorf("failed to insert funnel step: %w", err)
		}
	}

	return tx.Commit(ctx)
}

// UpdateFunnel updates an existing funnel
func (r *FunnelRepository) UpdateFunnel(ctx context.Context, id string, updates *models.UpdateFunnelRequest) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Build update query
	query := `UPDATE funnels SET updated_at = $1`
	args := []interface{}{time.Now()}
	argCount := 2

	if updates.Name != nil {
		query += fmt.Sprintf(", name = $%d", argCount)
		args = append(args, *updates.Name)
		argCount++
	}
	if updates.Description != nil {
		query += fmt.Sprintf(", description = $%d", argCount)
		args = append(args, *updates.Description)
		argCount++
	}
	if updates.IsActive != nil {
		query += fmt.Sprintf(", is_active = $%d", argCount)
		args = append(args, *updates.IsActive)
		argCount++
	}

	query += fmt.Sprintf(" WHERE id = $%d", argCount)
	args = append(args, id)

	_, err = tx.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to update funnel: %w", err)
	}

	// Update steps if provided
	if updates.Steps != nil {
		// Delete existing steps
		_, err = tx.Exec(ctx, "DELETE FROM funnel_steps WHERE funnel_id = $1", id)
		if err != nil {
			return fmt.Errorf("failed to delete old steps: %w", err)
		}

		// Insert new steps — preserve user-supplied order values
		now := time.Now()
		for _, step := range *updates.Steps {
			step.ID = uuid.New().String()
			step.FunnelID = id
			// Do NOT override step.Order

			stepQuery := `
				INSERT INTO funnel_steps (id, funnel_id, name, step_order, step_type, page_path, event_type, match_type, created_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			`
			_, err = tx.Exec(ctx, stepQuery,
				step.ID, step.FunnelID, step.Name, step.Order,
				step.StepType, step.PagePath, step.EventType, step.MatchType, now,
			)
			if err != nil {
				return fmt.Errorf("failed to update funnel step: %w", err)
			}
		}
	}

	return tx.Commit(ctx)
}

// DeleteFunnel deletes a funnel
func (r *FunnelRepository) DeleteFunnel(ctx context.Context, id string) error {
	query := `DELETE FROM funnels WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

// GetStepsByFunnelID retrieves steps for a funnel
func (r *FunnelRepository) GetStepsByFunnelID(ctx context.Context, funnelID string) ([]models.FunnelStep, error) {
	query := `
		SELECT id, funnel_id, name, step_order, step_type, page_path, event_type, match_type
		FROM funnel_steps
		WHERE funnel_id = $1
		ORDER BY step_order ASC
	`

	rows, err := r.db.Query(ctx, query, funnelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var steps []models.FunnelStep
	for rows.Next() {
		var s models.FunnelStep
		err := rows.Scan(
			&s.ID, &s.FunnelID, &s.Name, &s.Order,
			&s.StepType, &s.PagePath, &s.EventType, &s.MatchType,
		)
		if err != nil {
			return nil, err
		}
		steps = append(steps, s)
	}

	return steps, nil
}

// GetFunnelStats calculates real-time statistics for a funnel based on historical events
func (r *FunnelRepository) GetFunnelStats(ctx context.Context, funnelID string, websiteID string) (*models.FunnelStats, error) {
	steps, err := r.GetStepsByFunnelID(ctx, funnelID)
	if err != nil {
		return nil, err
	}

	if len(steps) == 0 {
		return &models.FunnelStats{}, nil
	}

	stats := &models.FunnelStats{
		StepBreakdown: make([]models.StepStats, len(steps)),
	}

	// For each step, count unique visitors who hit the page/event
	for i, step := range steps {
		var count int
		var query string
		var args []interface{}

		if r.ch != nil {
			if step.StepType == "page_view" {
				query = `
					SELECT count(DISTINCT visitor_id) 
					FROM events 
					WHERE website_id = ? 
					AND event_type = 'pageview'
				`
				if step.MatchType == "exact" {
					query += " AND page = ?"
				} else {
					query += " AND page LIKE ?"
				}

				path := step.PagePath
				if step.MatchType != "exact" {
					path = "%" + path + "%"
				}
				args = []interface{}{websiteID, path}
			} else {
				query = `
					SELECT count(DISTINCT visitor_id) 
					FROM events 
					WHERE website_id = ? 
					AND event_type = 'custom' 
					AND page = ?
				`
				args = []interface{}{websiteID, step.EventType}
			}

			var countUint64 uint64
			err := r.ch.QueryRow(ctx, query, args...).Scan(&countUint64)
			if err != nil {
				return nil, fmt.Errorf("failed to get count from CH for step %d: %w", i, err)
			}
			count = int(countUint64)
		} else {
			if step.StepType == "page_view" {
				query = `
					SELECT COUNT(DISTINCT visitor_id) 
					FROM events 
					WHERE website_id = $1 
					AND event_type = 'pageview'
				`
				if step.MatchType == "exact" {
					query += " AND page = $2"
				} else {
					query += " AND page LIKE $2"
				}

				path := step.PagePath
				if step.MatchType != "exact" {
					path = "%" + path + "%"
				}
				args = []interface{}{websiteID, path}
			} else {
				query = `
					SELECT COUNT(DISTINCT visitor_id) 
					FROM events 
					WHERE website_id = $1 
					AND event_type = 'custom' 
					AND page = $2
				`
				args = []interface{}{websiteID, step.EventType}
			}

			err := r.db.QueryRow(ctx, query, args...).Scan(&count)
			if err != nil {
				return nil, fmt.Errorf("failed to get count from PG for step %d: %w", i, err)
			}
		}

		stats.StepBreakdown[i] = models.StepStats{
			StepOrder: step.Order,
			StepName:  step.Name,
			Count:     count,
		}

		if i == 0 {
			stats.TotalEntries = count
		}
		if i == len(steps)-1 {
			stats.Completions = count
		}
	}

	// Calculate dropoffs and rates
	for i := range stats.StepBreakdown {
		if i == 0 {
			stats.StepBreakdown[i].ConversionRate = 100.0
			stats.StepBreakdown[i].DropoffRate = 0.0
			stats.StepBreakdown[i].DropoffCount = 0
			continue
		}

		prevCount := stats.StepBreakdown[i-1].Count
		currCount := stats.StepBreakdown[i].Count

		if prevCount > 0 {
			stats.StepBreakdown[i].ConversionRate = float64(currCount) / float64(prevCount) * 100.0
			stats.StepBreakdown[i].DropoffCount = prevCount - currCount
			stats.StepBreakdown[i].DropoffRate = float64(stats.StepBreakdown[i].DropoffCount) / float64(prevCount) * 100.0
		}
	}

	if stats.TotalEntries > 0 {
		stats.ConversionRate = float64(stats.Completions) / float64(stats.TotalEntries) * 100.0
	}

	return stats, nil
}
