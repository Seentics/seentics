package repository

import (
	"github.com/Seentics/seentics/internal/modules/automations/models"
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AutomationRepository struct {
	db *pgxpool.Pool
}

func NewAutomationRepository(db *pgxpool.Pool) *AutomationRepository {
	return &AutomationRepository{
		db: db,
	}
}

// ListAutomations retrieves all automations for a website
func (r *AutomationRepository) ListAutomations(ctx context.Context, websiteID string) ([]models.Automation, error) {
	return r.listAutomationsInternal(ctx, websiteID, false, 0, 0)
}

// ListAutomationsPaginated retrieves automations with pagination and total count
func (r *AutomationRepository) ListAutomationsPaginated(ctx context.Context, websiteID string, limit, offset int) ([]models.Automation, int, error) {
	// Get total count first
	var total int
	countQuery := `SELECT COUNT(*) FROM automations WHERE website_id = $1`
	err := r.db.QueryRow(ctx, countQuery, websiteID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count automations: %w", err)
	}

	automations, err := r.listAutomationsInternal(ctx, websiteID, false, limit, offset)
	return automations, total, err
}

// GetActiveAutomations retrieves only active automations for a website
func (r *AutomationRepository) GetActiveAutomations(ctx context.Context, websiteID string) ([]models.Automation, error) {
	return r.listAutomationsInternal(ctx, websiteID, true, 0, 0)
}

func (r *AutomationRepository) listAutomationsInternal(ctx context.Context, websiteID string, onlyActive bool, limit, offset int) ([]models.Automation, error) {
	query := `
		SELECT id, website_id, user_id, name, description, trigger_type,
		       trigger_config, is_active, created_at, updated_at
		FROM automations
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
		return nil, fmt.Errorf("failed to query automations: %w", err)
	}
	defer rows.Close()

	var automations []models.Automation
	var autoIDs []string
	autoIndex := make(map[string]int)

	for rows.Next() {
		var a models.Automation
		err := rows.Scan(
			&a.ID, &a.WebsiteID, &a.UserID, &a.Name, &a.Description,
			&a.TriggerType, &a.TriggerConfig, &a.IsActive, &a.CreatedAt, &a.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan automation: %w", err)
		}

		autoIndex[a.ID] = len(automations)
		autoIDs = append(autoIDs, a.ID)
		automations = append(automations, a)
	}

	if len(autoIDs) == 0 {
		return automations, nil
	}

	// Batch load all actions in one query (fixes N+1)
	actionQuery := `
		SELECT id, automation_id, action_type, action_config, order_index, created_at, updated_at
		FROM automation_actions
		WHERE automation_id = ANY($1)
		ORDER BY automation_id, order_index ASC
	`
	actionRows, err := r.db.Query(ctx, actionQuery, autoIDs)
	if err == nil {
		defer actionRows.Close()
		for actionRows.Next() {
			var action models.AutomationAction
			if err := actionRows.Scan(&action.ID, &action.AutomationID, &action.ActionType, &action.ActionConfig, &action.OrderIndex, &action.CreatedAt, &action.UpdatedAt); err == nil {
				if idx, ok := autoIndex[action.AutomationID]; ok {
					automations[idx].Actions = append(automations[idx].Actions, action)
				}
			}
		}
	}

	// Batch load all conditions in one query (fixes N+1)
	conditionQuery := `
		SELECT id, automation_id, condition_type, condition_config, created_at
		FROM automation_conditions
		WHERE automation_id = ANY($1)
	`
	conditionRows, err := r.db.Query(ctx, conditionQuery, autoIDs)
	if err == nil {
		defer conditionRows.Close()
		for conditionRows.Next() {
			var cond models.AutomationCondition
			if err := conditionRows.Scan(&cond.ID, &cond.AutomationID, &cond.ConditionType, &cond.ConditionConfig, &cond.CreatedAt); err == nil {
				if idx, ok := autoIndex[cond.AutomationID]; ok {
					automations[idx].Conditions = append(automations[idx].Conditions, cond)
				}
			}
		}
	}

	return automations, nil
}

// GetAutomationByID retrieves a single automation by ID
func (r *AutomationRepository) GetAutomationByID(ctx context.Context, id string) (*models.Automation, error) {
	query := `
		SELECT id, website_id, user_id, name, description, trigger_type, 
		       trigger_config, is_active, created_at, updated_at
		FROM automations
		WHERE id = $1
	`

	var a models.Automation
	err := r.db.QueryRow(ctx, query, id).Scan(
		&a.ID, &a.WebsiteID, &a.UserID, &a.Name, &a.Description,
		&a.TriggerType, &a.TriggerConfig, &a.IsActive, &a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("automation not found")
		}
		return nil, fmt.Errorf("failed to get automation: %w", err)
	}

	// Load actions and conditions
	a.Actions, _ = r.GetActionsByAutomationID(ctx, a.ID)
	a.Conditions, _ = r.GetConditionsByAutomationID(ctx, a.ID)

	return &a, nil
}

// CreateAutomation creates a new automation with actions and conditions
func (r *AutomationRepository) CreateAutomation(ctx context.Context, automation *models.Automation) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Generate ID if not provided
	if automation.ID == "" {
		automation.ID = uuid.New().String()
	}

	// Insert automation
	query := `
		INSERT INTO automations (id, website_id, user_id, name, description, trigger_type, trigger_config, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	now := time.Now()
	_, err = tx.Exec(ctx, query,
		automation.ID, automation.WebsiteID, automation.UserID, automation.Name,
		automation.Description, automation.TriggerType, automation.TriggerConfig,
		automation.IsActive, now, now,
	)
	if err != nil {
		return fmt.Errorf("failed to insert automation: %w", err)
	}

	// Insert actions
	for i, action := range automation.Actions {
		action.ID = uuid.New().String()
		action.AutomationID = automation.ID
		action.OrderIndex = i

		actionQuery := `
			INSERT INTO automation_actions (id, automation_id, action_type, action_config, order_index, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`
		_, err = tx.Exec(ctx, actionQuery,
			action.ID, action.AutomationID, action.ActionType, action.ActionConfig,
			action.OrderIndex, now, now,
		)
		if err != nil {
			return fmt.Errorf("failed to insert action: %w", err)
		}
	}

	// Insert conditions
	for _, condition := range automation.Conditions {
		condition.ID = uuid.New().String()
		condition.AutomationID = automation.ID

		conditionQuery := `
			INSERT INTO automation_conditions (id, automation_id, condition_type, condition_config, created_at)
			VALUES ($1, $2, $3, $4, $5)
		`
		_, err = tx.Exec(ctx, conditionQuery,
			condition.ID, condition.AutomationID, condition.ConditionType,
			condition.ConditionConfig, now,
		)
		if err != nil {
			return fmt.Errorf("failed to insert condition: %w", err)
		}
	}

	return tx.Commit(ctx)
}

// UpdateAutomation updates an existing automation
func (r *AutomationRepository) UpdateAutomation(ctx context.Context, id string, updates *models.UpdateAutomationRequest) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Build dynamic update query
	query := `UPDATE automations SET updated_at = $1`
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
	if updates.TriggerType != nil {
		query += fmt.Sprintf(", trigger_type = $%d", argCount)
		args = append(args, *updates.TriggerType)
		argCount++
	}
	if updates.TriggerConfig != nil {
		query += fmt.Sprintf(", trigger_config = $%d", argCount)
		args = append(args, updates.TriggerConfig)
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
		return fmt.Errorf("failed to update automation: %w", err)
	}

	// Update actions if provided
	if updates.Actions != nil {
		// Delete existing actions
		_, err = tx.Exec(ctx, "DELETE FROM automation_actions WHERE automation_id = $1", id)
		if err != nil {
			return fmt.Errorf("failed to delete old actions: %w", err)
		}

		// Insert new actions
		now := time.Now()
		for i, action := range *updates.Actions {
			action.ID = uuid.New().String()
			action.AutomationID = id
			action.OrderIndex = i

			actionQuery := `
				INSERT INTO automation_actions (id, automation_id, action_type, action_config, order_index, created_at, updated_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7)
			`
			_, err = tx.Exec(ctx, actionQuery,
				action.ID, action.AutomationID, action.ActionType, action.ActionConfig,
				action.OrderIndex, now, now,
			)
			if err != nil {
				return fmt.Errorf("failed to insert action: %w", err)
			}
		}
	}

	// Update conditions if provided
	if updates.Conditions != nil {
		// Delete existing conditions
		_, err = tx.Exec(ctx, "DELETE FROM automation_conditions WHERE automation_id = $1", id)
		if err != nil {
			return fmt.Errorf("failed to delete old conditions: %w", err)
		}

		// Insert new conditions
		now := time.Now()
		for _, condition := range *updates.Conditions {
			condition.ID = uuid.New().String()
			condition.AutomationID = id

			conditionQuery := `
				INSERT INTO automation_conditions (id, automation_id, condition_type, condition_config, created_at)
				VALUES ($1, $2, $3, $4, $5)
			`
			_, err = tx.Exec(ctx, conditionQuery,
				condition.ID, condition.AutomationID, condition.ConditionType,
				condition.ConditionConfig, now,
			)
			if err != nil {
				return fmt.Errorf("failed to insert condition: %w", err)
			}
		}
	}

	return tx.Commit(ctx)
}

// DeleteAutomation deletes an automation and all related data
func (r *AutomationRepository) DeleteAutomation(ctx context.Context, id string) error {
	query := `DELETE FROM automations WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete automation: %w", err)
	}

	return nil
}

// DeleteAutomations removes multiple automations at once
func (r *AutomationRepository) DeleteAutomations(ctx context.Context, ids []string) error {
	if len(ids) == 0 {
		return nil
	}

	query := `DELETE FROM automations WHERE id = ANY($1)`
	_, err := r.db.Exec(ctx, query, ids)
	if err != nil {
		return fmt.Errorf("failed to delete automations: %w", err)
	}

	return nil
}

// GetActionsByAutomationID retrieves all actions for an automation
func (r *AutomationRepository) GetActionsByAutomationID(ctx context.Context, automationID string) ([]models.AutomationAction, error) {
	query := `
		SELECT id, automation_id, action_type, action_config, order_index, created_at, updated_at
		FROM automation_actions
		WHERE automation_id = $1
		ORDER BY order_index ASC
	`

	rows, err := r.db.Query(ctx, query, automationID)
	if err != nil {
		return nil, fmt.Errorf("failed to query actions: %w", err)
	}
	defer rows.Close()

	var actions []models.AutomationAction
	for rows.Next() {
		var action models.AutomationAction
		err := rows.Scan(
			&action.ID, &action.AutomationID, &action.ActionType,
			&action.ActionConfig, &action.OrderIndex, &action.CreatedAt, &action.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan action: %w", err)
		}
		actions = append(actions, action)
	}

	return actions, nil
}

// GetConditionsByAutomationID retrieves all conditions for an automation
func (r *AutomationRepository) GetConditionsByAutomationID(ctx context.Context, automationID string) ([]models.AutomationCondition, error) {
	query := `
		SELECT id, automation_id, condition_type, condition_config, created_at
		FROM automation_conditions
		WHERE automation_id = $1
	`

	rows, err := r.db.Query(ctx, query, automationID)
	if err != nil {
		return nil, fmt.Errorf("failed to query conditions: %w", err)
	}
	defer rows.Close()

	var conditions []models.AutomationCondition
	for rows.Next() {
		var condition models.AutomationCondition
		err := rows.Scan(
			&condition.ID, &condition.AutomationID, &condition.ConditionType,
			&condition.ConditionConfig, &condition.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan condition: %w", err)
		}
		conditions = append(conditions, condition)
	}

	return conditions, nil
}

// GetBatchAutomationStats retrieves statistics for multiple automations in one query
func (r *AutomationRepository) GetBatchAutomationStats(ctx context.Context, automationIDs []string) (map[string]*models.AutomationStats, error) {
	query := `
		SELECT
			automation_id,
			COUNT(*) as total_executions,
			SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
			SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failure_count,
			SUM(CASE WHEN executed_at >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END) as last_30_days
		FROM automation_executions
		WHERE automation_id = ANY($1)
		GROUP BY automation_id
	`

	rows, err := r.db.Query(ctx, query, automationIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to get batch stats: %w", err)
	}
	defer rows.Close()

	result := make(map[string]*models.AutomationStats)
	for rows.Next() {
		var autoID string
		var totalExecutions, successCount, failureCount, last30Days int
		if err := rows.Scan(&autoID, &totalExecutions, &successCount, &failureCount, &last30Days); err != nil {
			continue
		}
		stats := &models.AutomationStats{
			TotalExecutions: totalExecutions,
			SuccessCount:    successCount,
			FailureCount:    failureCount,
			Last30Days:      last30Days,
		}
		if totalExecutions > 0 {
			stats.SuccessRate = float64(successCount) / float64(totalExecutions) * 100
		}
		result[autoID] = stats
	}

	return result, nil
}

// GetAutomationStats retrieves statistics for an automation
func (r *AutomationRepository) GetAutomationStats(ctx context.Context, automationID string) (*models.AutomationStats, error) {
	query := `
		SELECT 
			COUNT(*) as total_executions,
			SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
			SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failure_count,
			SUM(CASE WHEN executed_at >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END) as last_30_days
		FROM automation_executions
		WHERE automation_id = $1
	`

	var stats models.AutomationStats
	var totalExecutions, successCount, failureCount, last30Days int

	err := r.db.QueryRow(ctx, query, automationID).Scan(
		&totalExecutions, &successCount, &failureCount, &last30Days,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get stats: %w", err)
	}

	stats.TotalExecutions = totalExecutions
	stats.SuccessCount = successCount
	stats.FailureCount = failureCount
	stats.Last30Days = last30Days

	if totalExecutions > 0 {
		stats.SuccessRate = float64(successCount) / float64(totalExecutions) * 100
	}

	return &stats, nil
}

// CreateExecution records an automation execution
func (r *AutomationRepository) CreateExecution(ctx context.Context, execution *models.AutomationExecution) error {
	if execution.ID == "" {
		execution.ID = uuid.New().String()
	}

	query := `
		INSERT INTO automation_executions 
		(id, automation_id, website_id, visitor_id, session_id, trigger_event_id, status, execution_data, error_message, executed_at, completed_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`

	_, err := r.db.Exec(ctx, query,
		execution.ID, execution.AutomationID, execution.WebsiteID,
		execution.VisitorID, execution.SessionID, execution.TriggerEventID,
		execution.Status, execution.ExecutionData, execution.ErrorMessage,
		execution.ExecutedAt, execution.CompletedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create execution: %w", err)
	}

	return nil
}

// HasExecutedInSession checks if an automation has executed in a session
func (r *AutomationRepository) HasExecutedInSession(ctx context.Context, automationID, sessionID string) (bool, error) {
	var count int
	query := `SELECT COUNT(*) FROM automation_executions WHERE automation_id = $1 AND session_id = $2`
	err := r.db.QueryRow(ctx, query, automationID, sessionID).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// HasExecutedForVisitor checks if an automation has ever executed for a visitor
func (r *AutomationRepository) HasExecutedForVisitor(ctx context.Context, automationID, visitorID string) (bool, error) {
	var count int
	query := `SELECT COUNT(*) FROM automation_executions WHERE automation_id = $1 AND visitor_id = $2`
	err := r.db.QueryRow(ctx, query, automationID, visitorID).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// HasExecutedToday checks if an automation executed for a visitor in the last 24 hours
func (r *AutomationRepository) HasExecutedToday(ctx context.Context, automationID, visitorID string) (bool, error) {
	var count int
	query := `SELECT COUNT(*) FROM automation_executions WHERE automation_id = $1 AND visitor_id = $2 AND executed_at >= NOW() - INTERVAL '24 hours'`
	err := r.db.QueryRow(ctx, query, automationID, visitorID).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
