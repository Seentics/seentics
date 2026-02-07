package services

import (
	"analytics-app/internal/modules/supportdesk/models"
	"analytics-app/internal/modules/supportdesk/repository"
	websiteServicePkg "analytics-app/internal/modules/websites/services"
	"context"
	"crypto/rand"
	"fmt"

	"github.com/google/uuid"
)

type SupportDeskService struct {
	repo     *repository.SupportDeskRepository
	websites *websiteServicePkg.WebsiteService
}

func NewSupportDeskService(repo *repository.SupportDeskRepository, websites *websiteServicePkg.WebsiteService) *SupportDeskService {
	return &SupportDeskService{
		repo:     repo,
		websites: websites,
	}
}

// validateOwnership ensures the website belongs to the user
func (s *SupportDeskService) validateOwnership(ctx context.Context, websiteID string, userID string) (string, error) {
	if userID == "" {
		return "", fmt.Errorf("user_id is required")
	}

	uid, err := uuid.Parse(userID)
	if err != nil {
		return "", fmt.Errorf("invalid user_id format")
	}

	w, err := s.websites.GetWebsiteBySiteID(ctx, websiteID)
	if err != nil {
		return "", fmt.Errorf("website not found")
	}

	if w.UserID != uid {
		return "", fmt.Errorf("unauthorized access to website data")
	}

	return w.SiteID, nil
}

func generateID(prefix string) string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("%s_%x", prefix, b)
}

// Forms
func (s *SupportDeskService) CreateForm(ctx context.Context, websiteID, userID, name, description string, fields []byte) (*models.SupportForm, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}

	form := &models.SupportForm{
		ID:          generateID("frm"),
		WebsiteID:   canonicalID,
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

func (s *SupportDeskService) GetWebsiteForms(ctx context.Context, websiteID, userID string) ([]models.SupportForm, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetForms(ctx, canonicalID)
}

// Submissions
func (s *SupportDeskService) SubmitForm(ctx context.Context, formID string, data []byte, ip, ua, origin string) error {
	// Public endpoint - validate origin
	form, err := s.repo.GetFormByID(ctx, formID)
	if err != nil {
		return fmt.Errorf("form not found")
	}

	w, err := s.websites.GetWebsiteBySiteID(ctx, form.WebsiteID)
	if err != nil {
		return fmt.Errorf("website not found")
	}

	if !s.websites.ValidateOriginDomain(origin, w.URL) {
		return fmt.Errorf("domain mismatch")
	}

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
func (s *SupportDeskService) CreateTicket(ctx context.Context, websiteID, userID, subject, description, priority, source string, metadata []byte, origin string) (*models.Ticket, error) {
	// Canonical check
	w, err := s.websites.GetWebsiteBySiteID(ctx, websiteID)
	if err != nil {
		return nil, fmt.Errorf("website not found")
	}

	// If public (no userID), validate origin
	if userID == "" {
		if !s.websites.ValidateOriginDomain(origin, w.URL) {
			return nil, fmt.Errorf("domain mismatch")
		}
	}

	var uid *string
	if userID != "" {
		uid = &userID
	}

	ticket := &models.Ticket{
		ID:          generateID("tkt"),
		WebsiteID:   w.SiteID,
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

func (s *SupportDeskService) GetWebsiteTickets(ctx context.Context, websiteID, userID string) ([]models.Ticket, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetTickets(ctx, canonicalID)
}

// Chat Widget
func (s *SupportDeskService) ConfigureChatWidget(ctx context.Context, websiteID, userID, name string, config []byte, isActive bool) (*models.ChatWidget, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}

	// Check if exists
	existing, err := s.repo.GetChatWidget(ctx, canonicalID)
	if err != nil {
		return nil, err
	}

	id := generateID("cwdg")
	if existing != nil {
		id = existing.ID
	}

	widget := &models.ChatWidget{
		ID:        id,
		WebsiteID: canonicalID,
		Name:      name,
		Config:    config,
		IsActive:  isActive,
	}

	if err := s.repo.UpsertChatWidget(ctx, widget); err != nil {
		return nil, err
	}
	return widget, nil
}

func (s *SupportDeskService) GetChatWidget(ctx context.Context, websiteID, origin string) (*models.ChatWidget, error) {
	// Public access for the widget - validate origin
	w, err := s.websites.GetWebsiteBySiteID(ctx, websiteID)
	if err != nil {
		return nil, fmt.Errorf("website not found")
	}

	if !s.websites.ValidateOriginDomain(origin, w.URL) {
		return nil, fmt.Errorf("domain mismatch")
	}

	return s.repo.GetChatWidget(ctx, w.SiteID)
}

func (s *SupportDeskService) GetChatWidgetSecure(ctx context.Context, websiteID, userID string) (*models.ChatWidget, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetChatWidget(ctx, canonicalID)
}
