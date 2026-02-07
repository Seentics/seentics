package repository

import (
	"analytics-app/internal/modules/supportdesk/models"
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type SupportDeskRepository struct {
	db *pgxpool.Pool
}

func NewSupportDeskRepository(db *pgxpool.Pool) *SupportDeskRepository {
	return &SupportDeskRepository{db: db}
}

// Forms
func (r *SupportDeskRepository) CreateForm(ctx context.Context, form *models.SupportForm) error {
	query := `INSERT INTO support_forms (id, website_id, name, description, fields, is_active)
			  VALUES ($1, $2, $3, $4, $5, $6)`
	_, err := r.db.Exec(ctx, query, form.ID, form.WebsiteID, form.Name, form.Description, form.Fields, form.IsActive)
	return err
}

func (r *SupportDeskRepository) GetForms(ctx context.Context, websiteID string) ([]models.SupportForm, error) {
	query := `SELECT id, website_id, name, description, fields, is_active, created_at, updated_at
			  FROM support_forms WHERE website_id = $1 ORDER BY created_at DESC`
	rows, err := r.db.Query(ctx, query, websiteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var forms []models.SupportForm
	for rows.Next() {
		var f models.SupportForm
		if err := rows.Scan(&f.ID, &f.WebsiteID, &f.Name, &f.Description, &f.Fields, &f.IsActive, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return nil, err
		}
		forms = append(forms, f)
	}
	return forms, nil
}

// Submissions
func (r *SupportDeskRepository) CreateSubmission(ctx context.Context, sub *models.FormSubmission) error {
	query := `INSERT INTO support_form_submissions (id, form_id, data, ip_address, user_agent)
			  VALUES ($1, $2, $3, $4, $5)`
	_, err := r.db.Exec(ctx, query, sub.ID, sub.FormID, sub.Data, sub.IPAddress, sub.UserAgent)
	return err
}

// Tickets
func (r *SupportDeskRepository) CreateTicket(ctx context.Context, t *models.Ticket) error {
	query := `INSERT INTO support_tickets (id, website_id, user_id, subject, description, status, priority, source, metadata)
			  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`
	_, err := r.db.Exec(ctx, query, t.ID, t.WebsiteID, t.UserID, t.Subject, t.Description, t.Status, t.Priority, t.Source, t.Metadata)
	return err
}

func (r *SupportDeskRepository) GetTickets(ctx context.Context, websiteID string) ([]models.Ticket, error) {
	query := `SELECT id, website_id, user_id, subject, description, status, priority, source, metadata, created_at, updated_at
			  FROM support_tickets WHERE website_id = $1 ORDER BY created_at DESC`
	rows, err := r.db.Query(ctx, query, websiteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tickets []models.Ticket
	for rows.Next() {
		var t models.Ticket
		if err := rows.Scan(&t.ID, &t.WebsiteID, &t.UserID, &t.Subject, &t.Description, &t.Status, &t.Priority, &t.Source, &t.Metadata, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		tickets = append(tickets, t)
	}
	return tickets, nil
}

// Chat Widgets
func (r *SupportDeskRepository) UpsertChatWidget(ctx context.Context, w *models.ChatWidget) error {
	query := `INSERT INTO support_chat_widgets (id, website_id, name, config, is_active)
			  VALUES ($1, $2, $3, $4, $5)
			  ON CONFLICT (id) DO UPDATE SET
			  name = EXCLUDED.name, config = EXCLUDED.config, is_active = EXCLUDED.is_active, updated_at = CURRENT_TIMESTAMP`
	_, err := r.db.Exec(ctx, query, w.ID, w.WebsiteID, w.Name, w.Config, w.IsActive)
	return err
}

func (r *SupportDeskRepository) GetChatWidget(ctx context.Context, websiteID string) (*models.ChatWidget, error) {
	query := `SELECT id, website_id, name, config, is_active, created_at, updated_at
			  FROM support_chat_widgets WHERE website_id = $1`
	var w models.ChatWidget
	err := r.db.QueryRow(ctx, query, websiteID).Scan(&w.ID, &w.WebsiteID, &w.Name, &w.Config, &w.IsActive, &w.CreatedAt, &w.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &w, nil
}

func (r *SupportDeskRepository) GetFormByID(ctx context.Context, id string) (*models.SupportForm, error) {
	query := `SELECT id, website_id, name, description, fields, is_active, created_at, updated_at
			  FROM support_forms WHERE id = $1`
	var f models.SupportForm
	err := r.db.QueryRow(ctx, query, id).Scan(&f.ID, &f.WebsiteID, &f.Name, &f.Description, &f.Fields, &f.IsActive, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &f, nil
}
