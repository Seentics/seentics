package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/Seentics/seentics/internal/modules/automations/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AutomationRepository handles persistence for automation data
type AutomationRepository struct {
	db *pgxpool.Pool
}

// NewAutomationRepository creates a new AutomationRepository
func NewAutomationRepository(db *pgxpool.Pool) *AutomationRepository {
	return &AutomationRepository{db: db}
}

// Create inserts a new automation (with its actions) and returns the full record
func (r *AutomationRepository) Create(ctx context.Context, auto models.Automation) (*models.Automation, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("automation create: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	if auto.ID == "" {
		auto.ID = uuid.New().String()
	}
	if auto.TriggerConfig == nil {
		auto.TriggerConfig = json.RawMessage("{}")
	}
	now := time.Now()

	const q = `
		INSERT INTO automations
			(id, website_id, user_id, name, description, trigger_type, trigger_config, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	_, err = tx.Exec(ctx, q,
		auto.ID, auto.WebsiteID, auto.UserID, auto.Name, auto.Description,
		auto.TriggerType, auto.TriggerConfig, auto.IsActive, now, now,
	)
	if err != nil {
		return nil, fmt.Errorf("automation create: insert: %w", err)
	}

	for _, action := range auto.Actions {
		if action.ID == "" {
			action.ID = uuid.New().String()
		}
		if action.ActionConfig == nil {
			action.ActionConfig = json.RawMessage("{}")
		}
		const aq = `
			INSERT INTO automation_actions
				(id, automation_id, action_type, action_config, order_index, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`
		_, err = tx.Exec(ctx, aq,
			action.ID, auto.ID, action.ActionType, action.ActionConfig, action.OrderIndex, now, now,
		)
		if err != nil {
			return nil, fmt.Errorf("automation create: insert action: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("automation create: commit: %w", err)
	}

	return r.Get(ctx, auto.ID, auto.WebsiteID)
}

// List returns all automations (with actions) for a website
func (r *AutomationRepository) List(ctx context.Context, websiteID string) ([]models.Automation, error) {
	const q = `
		SELECT id, website_id, user_id, name, description, trigger_type, trigger_config,
		       is_active, created_at, updated_at
		FROM automations
		WHERE website_id = $1
		ORDER BY created_at DESC
	`
	rows, err := r.db.Query(ctx, q, websiteID)
	if err != nil {
		return nil, fmt.Errorf("automation list: %w", err)
	}
	defer rows.Close()

	var automations []models.Automation
	var ids []string
	idxMap := make(map[string]int)

	for rows.Next() {
		var a models.Automation
		if err := rows.Scan(
			&a.ID, &a.WebsiteID, &a.UserID, &a.Name, &a.Description,
			&a.TriggerType, &a.TriggerConfig, &a.IsActive, &a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("automation list scan: %w", err)
		}
		idxMap[a.ID] = len(automations)
		ids = append(ids, a.ID)
		automations = append(automations, a)
	}

	if len(ids) > 0 {
		actions, err := r.listActionsForAutomations(ctx, ids)
		if err == nil {
			for _, action := range actions {
				if idx, ok := idxMap[action.AutomationID]; ok {
					automations[idx].Actions = append(automations[idx].Actions, action)
				}
			}
		}
	}

	return automations, nil
}

// GetActive returns all active automations for a website (used by the tracker init endpoint)
func (r *AutomationRepository) GetActive(ctx context.Context, websiteID string) ([]models.Automation, error) {
	const q = `
		SELECT id, website_id, user_id, name, description, trigger_type, trigger_config,
		       is_active, created_at, updated_at
		FROM automations
		WHERE website_id = $1
		  AND is_active  = true
		ORDER BY created_at DESC
	`
	rows, err := r.db.Query(ctx, q, websiteID)
	if err != nil {
		return nil, fmt.Errorf("automation get active: %w", err)
	}
	defer rows.Close()

	var automations []models.Automation
	var ids []string
	idxMap := make(map[string]int)

	for rows.Next() {
		var a models.Automation
		if err := rows.Scan(
			&a.ID, &a.WebsiteID, &a.UserID, &a.Name, &a.Description,
			&a.TriggerType, &a.TriggerConfig, &a.IsActive, &a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("automation get active scan: %w", err)
		}
		idxMap[a.ID] = len(automations)
		ids = append(ids, a.ID)
		automations = append(automations, a)
	}

	if len(ids) > 0 {
		actions, err := r.listActionsForAutomations(ctx, ids)
		if err == nil {
			for _, action := range actions {
				if idx, ok := idxMap[action.AutomationID]; ok {
					automations[idx].Actions = append(automations[idx].Actions, action)
				}
			}
		}
	}

	return automations, nil
}

// Get retrieves a single automation by id + websiteID
func (r *AutomationRepository) Get(ctx context.Context, id, websiteID string) (*models.Automation, error) {
	const q = `
		SELECT id, website_id, user_id, name, description, trigger_type, trigger_config,
		       is_active, created_at, updated_at
		FROM automations
		WHERE id = $1 AND website_id = $2
	`
	var a models.Automation
	err := r.db.QueryRow(ctx, q, id, websiteID).Scan(
		&a.ID, &a.WebsiteID, &a.UserID, &a.Name, &a.Description,
		&a.TriggerType, &a.TriggerConfig, &a.IsActive, &a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("automation not found")
		}
		return nil, fmt.Errorf("automation get: %w", err)
	}

	actions, err := r.listActionsForAutomations(ctx, []string{a.ID})
	if err == nil {
		a.Actions = actions
	}

	return &a, nil
}

// Update applies a partial update to an automation
func (r *AutomationRepository) Update(ctx context.Context, id, websiteID string, req models.UpdateRequest) (*models.Automation, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("automation update: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	now := time.Now()
	query := `UPDATE automations SET updated_at = $1`
	args := []interface{}{now}
	argN := 2

	if req.Name != nil {
		query += fmt.Sprintf(", name = $%d", argN)
		args = append(args, *req.Name)
		argN++
	}
	if req.Description != nil {
		query += fmt.Sprintf(", description = $%d", argN)
		args = append(args, *req.Description)
		argN++
	}
	if req.TriggerType != nil {
		query += fmt.Sprintf(", trigger_type = $%d", argN)
		args = append(args, *req.TriggerType)
		argN++
	}
	if req.TriggerConfig != nil {
		query += fmt.Sprintf(", trigger_config = $%d", argN)
		args = append(args, req.TriggerConfig)
		argN++
	}
	if req.IsActive != nil {
		query += fmt.Sprintf(", is_active = $%d", argN)
		args = append(args, *req.IsActive)
		argN++
	}

	query += fmt.Sprintf(" WHERE id = $%d AND website_id = $%d", argN, argN+1)
	args = append(args, id, websiteID)

	_, err = tx.Exec(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("automation update: exec: %w", err)
	}

	if req.Actions != nil {
		_, err = tx.Exec(ctx, `DELETE FROM automation_actions WHERE automation_id = $1`, id)
		if err != nil {
			return nil, fmt.Errorf("automation update: delete old actions: %w", err)
		}
		for _, action := range *req.Actions {
			if action.ID == "" {
				action.ID = uuid.New().String()
			}
			if action.ActionConfig == nil {
				action.ActionConfig = json.RawMessage("{}")
			}
			const aq = `
				INSERT INTO automation_actions
					(id, automation_id, action_type, action_config, order_index, created_at, updated_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7)
			`
			_, err = tx.Exec(ctx, aq,
				action.ID, id, action.ActionType, action.ActionConfig, action.OrderIndex, now, now,
			)
			if err != nil {
				return nil, fmt.Errorf("automation update: insert action: %w", err)
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("automation update: commit: %w", err)
	}

	return r.Get(ctx, id, websiteID)
}

// Delete removes an automation (cascade deletes its actions)
func (r *AutomationRepository) Delete(ctx context.Context, id, websiteID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM automations WHERE id = $1 AND website_id = $2`, id, websiteID)
	if err != nil {
		return fmt.Errorf("automation delete: %w", err)
	}
	return nil
}

// RecordExecution saves an execution record for an automation
func (r *AutomationRepository) RecordExecution(ctx context.Context, exec models.AutomationExecution) error {
	if exec.ID == "" {
		exec.ID = uuid.New().String()
	}
	if exec.Status == "" {
		exec.Status = "pending"
	}

	const q = `
		INSERT INTO automation_executions
			(id, automation_id, website_id, visitor_id, session_id, status, execution_data, error_message, executed_at, completed_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
	`
	_, err := r.db.Exec(ctx, q,
		exec.ID, exec.AutomationID, exec.WebsiteID,
		exec.VisitorID, exec.SessionID, exec.Status,
		exec.ExecutionData, exec.ErrorMessage, exec.CompletedAt,
	)
	if err != nil {
		return fmt.Errorf("automation record execution: %w", err)
	}
	return nil
}

// ListExecutions returns recent executions for a given automation
func (r *AutomationRepository) ListExecutions(ctx context.Context, automationID, websiteID string, limit int) ([]models.AutomationExecution, error) {
	const q = `
		SELECT id, automation_id, website_id, COALESCE(visitor_id,''), COALESCE(session_id,''),
		       status, execution_data, COALESCE(error_message,''), executed_at, completed_at
		FROM automation_executions
		WHERE automation_id = $1
		  AND website_id   = $2
		ORDER BY executed_at DESC
		LIMIT $3
	`
	rows, err := r.db.Query(ctx, q, automationID, websiteID, limit)
	if err != nil {
		return nil, fmt.Errorf("automation list executions: %w", err)
	}
	defer rows.Close()

	var execs []models.AutomationExecution
	for rows.Next() {
		var e models.AutomationExecution
		if err := rows.Scan(
			&e.ID, &e.AutomationID, &e.WebsiteID,
			&e.VisitorID, &e.SessionID, &e.Status,
			&e.ExecutionData, &e.ErrorMessage, &e.ExecutedAt, &e.CompletedAt,
		); err != nil {
			return nil, fmt.Errorf("automation list executions scan: %w", err)
		}
		execs = append(execs, e)
	}
	return execs, nil
}

// listActionsForAutomations batch-loads actions for the given automation IDs
func (r *AutomationRepository) listActionsForAutomations(ctx context.Context, ids []string) ([]models.AutomationAction, error) {
	const q = `
		SELECT id, automation_id, action_type, action_config, order_index, created_at, updated_at
		FROM automation_actions
		WHERE automation_id = ANY($1)
		ORDER BY automation_id, order_index ASC
	`
	rows, err := r.db.Query(ctx, q, ids)
	if err != nil {
		return nil, fmt.Errorf("list actions: %w", err)
	}
	defer rows.Close()

	var actions []models.AutomationAction
	for rows.Next() {
		var a models.AutomationAction
		if err := rows.Scan(
			&a.ID, &a.AutomationID, &a.ActionType, &a.ActionConfig,
			&a.OrderIndex, &a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("list actions scan: %w", err)
		}
		actions = append(actions, a)
	}
	return actions, nil
}
