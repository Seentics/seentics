package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/Seentics/seentics/internal/modules/funnels/models"

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
	return r.listFunnelsInternal(ctx, websiteID, false, 0, 0)
}

// ListFunnelsPaginated retrieves funnels with pagination and total count
func (r *FunnelRepository) ListFunnelsPaginated(ctx context.Context, websiteID string, limit, offset int) ([]models.Funnel, int, error) {
	// Get total count first
	var total int
	countQuery := `SELECT COUNT(*) FROM funnels WHERE website_id = $1`
	err := r.db.QueryRow(ctx, countQuery, websiteID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count funnels: %w", err)
	}

	funnels, err := r.listFunnelsInternal(ctx, websiteID, false, limit, offset)
	return funnels, total, err
}

// GetActiveFunnels retrieves only active funnels for a website
func (r *FunnelRepository) GetActiveFunnels(ctx context.Context, websiteID string) ([]models.Funnel, error) {
	return r.listFunnelsInternal(ctx, websiteID, true, 0, 0)
}

func (r *FunnelRepository) listFunnelsInternal(ctx context.Context, websiteID string, onlyActive bool, limit, offset int) ([]models.Funnel, error) {
	query := `
		SELECT id, website_id, user_id, name, description, is_active, created_at, updated_at
		FROM funnels
		WHERE website_id = $1
	`
	if onlyActive {
		query += " AND is_active = true"
	}
	query += " ORDER BY created_at DESC"

	args := []interface{}{websiteID}
	if limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", len(args)+1)
		args = append(args, limit)
	}
	if offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", len(args)+1)
		args = append(args, offset)
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query funnels: %w", err)
	}
	defer rows.Close()

	var funnels []models.Funnel
	var funnelIDs []string
	funnelIndex := make(map[string]int)

	for rows.Next() {
		var f models.Funnel
		err := rows.Scan(
			&f.ID, &f.WebsiteID, &f.UserID, &f.Name, &f.Description,
			&f.IsActive, &f.CreatedAt, &f.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan funnel: %w", err)
		}

		funnelIndex[f.ID] = len(funnels)
		funnelIDs = append(funnelIDs, f.ID)
		funnels = append(funnels, f)
	}

	// Batch load all steps in one query (fixes N+1)
	if len(funnelIDs) > 0 {
		stepQuery := `
			SELECT id, funnel_id, name, step_order, step_type, page_path, event_type, match_type
			FROM funnel_steps
			WHERE funnel_id = ANY($1)
			ORDER BY funnel_id, step_order ASC
		`
		stepRows, err := r.db.Query(ctx, stepQuery, funnelIDs)
		if err == nil {
			defer stepRows.Close()
			for stepRows.Next() {
				var s models.FunnelStep
				if err := stepRows.Scan(&s.ID, &s.FunnelID, &s.Name, &s.Order, &s.StepType, &s.PagePath, &s.EventType, &s.MatchType); err == nil {
					if idx, ok := funnelIndex[s.FunnelID]; ok {
						funnels[idx].Steps = append(funnels[idx].Steps, s)
					}
				}
			}
		}
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

// DeleteFunnels removes multiple funnels at once
func (r *FunnelRepository) DeleteFunnels(ctx context.Context, ids []string) error {
	if len(ids) == 0 {
		return nil
	}

	query := `DELETE FROM funnels WHERE id = ANY($1)`
	_, err := r.db.Exec(ctx, query, ids)
	if err != nil {
		return fmt.Errorf("failed to delete funnels: %w", err)
	}

	return nil
}

func (r *FunnelRepository) DeleteAllByWebsiteID(ctx context.Context, websiteID string) error {
	query := `DELETE FROM funnels WHERE website_id = $1`
	_, err := r.db.Exec(ctx, query, websiteID)
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

// TrackFunnelEvent upserts a single funnel progression event into funnel_analytics.
func (r *FunnelRepository) TrackFunnelEvent(ctx context.Context, req *models.TrackFunnelEventRequest) error {
	var entries, completions, dropoffs int
	switch req.EventType {
	case "conversion":
		completions = 1
	case "dropoff":
		dropoffs = 1
	default:
		entries = 1
	}

	eventDate := req.Timestamp.UTC().Truncate(24 * time.Hour)
	if eventDate.IsZero() {
		eventDate = time.Now().UTC().Truncate(24 * time.Hour)
	}

	const q = `
		INSERT INTO funnel_analytics (funnel_id, date, step_order, entries, completions, dropoffs, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
		ON CONFLICT (funnel_id, date, step_order)
		DO UPDATE SET
			entries     = funnel_analytics.entries     + EXCLUDED.entries,
			completions = funnel_analytics.completions + EXCLUDED.completions,
			dropoffs    = funnel_analytics.dropoffs    + EXCLUDED.dropoffs,
			updated_at  = NOW()
	`
	_, err := r.db.Exec(ctx, q, req.FunnelID, eventDate, req.CurrentStep, entries, completions, dropoffs)
	if err != nil {
		return fmt.Errorf("failed to track funnel event: %w", err)
	}
	return nil
}

// BatchTrackFunnelEvents upserts multiple funnel progression events in a single pgx batch.
func (r *FunnelRepository) BatchTrackFunnelEvents(ctx context.Context, events []models.TrackFunnelEventRequest) error {
	if len(events) == 0 {
		return nil
	}

	const q = `
		INSERT INTO funnel_analytics (funnel_id, date, step_order, entries, completions, dropoffs, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
		ON CONFLICT (funnel_id, date, step_order)
		DO UPDATE SET
			entries     = funnel_analytics.entries     + EXCLUDED.entries,
			completions = funnel_analytics.completions + EXCLUDED.completions,
			dropoffs    = funnel_analytics.dropoffs    + EXCLUDED.dropoffs,
			updated_at  = NOW()
	`

	now := time.Now().UTC()
	batch := &pgx.Batch{}
	for _, req := range events {
		var entries, completions, dropoffs int
		switch req.EventType {
		case "conversion":
			completions = 1
		case "dropoff":
			dropoffs = 1
		default:
			entries = 1
		}
		eventDate := req.Timestamp.UTC().Truncate(24 * time.Hour)
		if eventDate.IsZero() {
			eventDate = now.Truncate(24 * time.Hour)
		}
		batch.Queue(q, req.FunnelID, eventDate, req.CurrentStep, entries, completions, dropoffs)
	}

	br := r.db.SendBatch(ctx, batch)
	defer br.Close()
	for range events {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("batch funnel event insert failed: %w", err)
		}
	}
	return nil
}

// GetBatchFunnelSummaryStats fetches summary stats for multiple funnels in one Postgres query
// by reading from the funnel_analytics aggregate table (last 30 days).
func (r *FunnelRepository) GetBatchFunnelSummaryStats(ctx context.Context, funnelIDs []string) (map[string]*models.FunnelStats, error) {
	if len(funnelIDs) == 0 {
		return nil, nil
	}

	query := `
		WITH step_bounds AS (
			SELECT funnel_id, MIN(step_order) AS first_step, MAX(step_order) AS last_step
			FROM funnel_steps
			WHERE funnel_id = ANY($1)
			GROUP BY funnel_id
		)
		SELECT
			fa.funnel_id::text,
			COALESCE(SUM(CASE WHEN fa.step_order = sb.first_step THEN fa.entries ELSE 0 END), 0) AS total_entries,
			COALESCE(SUM(CASE WHEN fa.step_order = sb.last_step THEN fa.completions ELSE 0 END), 0) AS total_completions
		FROM funnel_analytics fa
		JOIN step_bounds sb ON sb.funnel_id = fa.funnel_id
		WHERE fa.funnel_id = ANY($1)
		  AND fa.date >= CURRENT_DATE - INTERVAL '30 days'
		GROUP BY fa.funnel_id
	`

	rows, err := r.db.Query(ctx, query, funnelIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to get batch funnel stats: %w", err)
	}
	defer rows.Close()

	result := make(map[string]*models.FunnelStats)
	for rows.Next() {
		var funnelID string
		var totalEntries, completions int
		if err := rows.Scan(&funnelID, &totalEntries, &completions); err != nil {
			continue
		}
		stats := &models.FunnelStats{
			TotalEntries: totalEntries,
			Completions:  completions,
		}
		if totalEntries > 0 {
			stats.ConversionRate = float64(completions) / float64(totalEntries) * 100.0
		}
		result[funnelID] = stats
	}
	return result, nil
}

// FilterIDsByUser returns only the funnel IDs from ids that belong to userID.
func (r *FunnelRepository) FilterIDsByUser(ctx context.Context, ids []string, userID string) ([]string, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	query := `SELECT id FROM funnels WHERE id = ANY($1) AND user_id = $2`
	rows, err := r.db.Query(ctx, query, ids, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to filter funnel ids: %w", err)
	}
	defer rows.Close()
	var validIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			validIDs = append(validIDs, id)
		}
	}
	return validIDs, nil
}

// GetFunnelStats calculates real-time statistics for a funnel using a single ClickHouse query
func (r *FunnelRepository) GetFunnelStats(ctx context.Context, funnelID string, websiteID string) (*models.FunnelStats, error) {
	steps, err := r.GetStepsByFunnelID(ctx, funnelID)
	if err != nil {
		return nil, err
	}

	if len(steps) == 0 {
		return &models.FunnelStats{}, nil
	}

	if r.ch == nil {
		return nil, fmt.Errorf("ClickHouse connection required for funnel stats")
	}

	// Build a single query with conditional aggregation for all steps
	var selectClauses []string
	var args []interface{}
	args = append(args, websiteID)

	for i, step := range steps {
		var condition string
		if step.StepType == "page_view" {
			if step.MatchType == "exact" {
				condition = "event_type = 'pageview' AND page = ?"
				args = append(args, step.PagePath)
			} else {
				condition = "event_type = 'pageview' AND page LIKE ?"
				args = append(args, "%"+step.PagePath+"%")
			}
		} else {
			condition = "event_type = 'custom' AND page = ?"
			args = append(args, step.EventType)
		}
		selectClauses = append(selectClauses,
			fmt.Sprintf("count(DISTINCT IF(%s, visitor_id, NULL)) AS step_%d", condition, i))
	}

	query := fmt.Sprintf(`
		SELECT %s
		FROM events
		WHERE website_id = ?
		AND timestamp >= now() - interval 30 day`,
		strings.Join(selectClauses, ", "))

	// Scan results
	counts := make([]uint64, len(steps))
	scanDest := make([]interface{}, len(steps))
	for i := range counts {
		scanDest[i] = &counts[i]
	}

	err = r.ch.QueryRow(ctx, query, args...).Scan(scanDest...)
	if err != nil {
		return nil, fmt.Errorf("failed to get funnel stats from ClickHouse: %w", err)
	}

	stats := &models.FunnelStats{
		StepBreakdown: make([]models.StepStats, len(steps)),
	}

	for i, step := range steps {
		count := int(counts[i])
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
