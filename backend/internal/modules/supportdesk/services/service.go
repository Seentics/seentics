package services

import (
	"analytics-app/internal/modules/supportdesk/models"
	"analytics-app/internal/modules/supportdesk/repository"
	"context"
	"crypto/rand"
	"fmt"
)

type SupportDeskService struct {
	repo *repository.SupportDeskRepository
}

func NewSupportDeskService(repo *repository.SupportDeskRepository) *SupportDeskService {
	return &SupportDeskService{repo: repo}
}

func generateID(prefix string) string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("%s_%x", prefix, b)
}

// Forms
func (s *SupportDeskService) CreateForm(ctx context.Context, websiteID, name, description string, fields []byte) (*models.SupportForm, error) {
	form := &models.SupportForm{
		ID:          generateID("frm"),
		WebsiteID:   websiteID,
		Name:        name,
		Description: description,
		Fields:      fields,
		IsActive:    true,
	}
	if err := s.repo.CreateForm(ctx, form); err != nil {
		return nil, err
	}
	return form, nil
}

func (s *SupportDeskService) GetWebsiteForms(ctx context.Context, websiteID string) ([]models.SupportForm, error) {
	return s.repo.GetForms(ctx, websiteID)
}

// Submissions
func (s *SupportDeskService) SubmitForm(ctx context.Context, formID string, data []byte, ip, ua string) error {
	sub := &models.FormSubmission{
		ID:        generateID("sub"),
		FormID:    formID,
		Data:      data,
		IPAddress: ip,
		UserAgent: ua,
	}
	return s.repo.CreateSubmission(ctx, sub)
}

// Tickets
func (s *SupportDeskService) CreateTicket(ctx context.Context, websiteID, userID, subject, description, priority, source string, metadata []byte) (*models.Ticket, error) {
	var uid *string
	if userID != "" {
		uid = &userID
	}

	ticket := &models.Ticket{
		ID:          generateID("tkt"),
		WebsiteID:   websiteID,
		UserID:      uid,
		Subject:     subject,
		Description: description,
		Status:      "open",
		Priority:    priority,
		Source:      source,
		Metadata:    metadata,
	}
	if err := s.repo.CreateTicket(ctx, ticket); err != nil {
		return nil, err
	}
	return ticket, nil
}

func (s *SupportDeskService) GetWebsiteTickets(ctx context.Context, websiteID string) ([]models.Ticket, error) {
	return s.repo.GetTickets(ctx, websiteID)
}

// Chat Widget
func (s *SupportDeskService) ConfigureChatWidget(ctx context.Context, websiteID, name string, config []byte, isActive bool) (*models.ChatWidget, error) {
	// Check if exists
	existing, err := s.repo.GetChatWidget(ctx, websiteID)
	if err != nil {
		return nil, err
	}

	id := generateID("cwdg")
	if existing != nil {
		id = existing.ID
	}

	widget := &models.ChatWidget{
		ID:        id,
		WebsiteID: websiteID,
		Name:      name,
		Config:    config,
		IsActive:  isActive,
	}

	if err := s.repo.UpsertChatWidget(ctx, widget); err != nil {
		return nil, err
	}
	return widget, nil
}

func (s *SupportDeskService) GetChatWidget(ctx context.Context, websiteID string) (*models.ChatWidget, error) {
	return s.repo.GetChatWidget(ctx, websiteID)
}
