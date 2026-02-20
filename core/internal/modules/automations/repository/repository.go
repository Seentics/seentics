package repository

import (
	"analytics-app/internal/modules/automations/models"
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
	return r.listAutomationsInternal(ctx, websiteID, false)
}

// GetActiveAutomations retrieves only active automations for a website
func (r *AutomationRepository) GetActiveAutomations(ctx context.Context, websiteID string) ([]models.Automation, error) {
	return r.listAutomationsInternal(ctx, websiteID, true)
}

func (r *AutomationRepository) listAutomationsInternal(ctx context.Context, websiteID string, onlyActive bool) ([]models.Automation, error) {
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

	rows, err := r.db.Query(ctx, query, websiteID)
	if err != nil {
		return nil, fmt.Errorf("failed to query automations: %w", err)
	}
	defer rows.Close()

	var automations []models.Automation
	for rows.Next() {
		var a models.Automation
		err := rows.Scan(
			&a.ID, &a.WebsiteID, &a.UserID, &a.Name, &a.Description,
			&a.TriggerType, &a.TriggerConfig, &a.IsActive, &a.CreatedAt, &a.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan automation: %w", err)
		}

		// Load actions and conditions
		a.Actions, _ = r.GetActionsByAutomationID(ctx, a.ID)
		a.Conditions, _ = r.GetConditionsByAutomationID(ctx, a.ID)

		automations = append(automations, a)
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
	result, err := r.db.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete automation: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("automation not found")
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
