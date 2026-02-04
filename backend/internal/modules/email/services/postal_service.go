package services

import (
	"analytics-app/internal/modules/email/models"
	"analytics-app/internal/shared/config"
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

type EmailService struct {
	cfg *config.Config
}

func NewEmailService(cfg *config.Config) *EmailService {
	return &EmailService{cfg: cfg}
}

func (s *EmailService) SendEmail(req *models.EmailRequest) (*models.PostalSendResponse, error) {
	if s.cfg.PostalServerURL == "" || s.cfg.PostalAPIKey == "" {
		return nil, fmt.Errorf("postal configuration is missing")
	}

	serverURL := strings.TrimSuffix(s.cfg.PostalServerURL, "/")
	url := fmt.Sprintf("%s/api/v1/send/message", serverURL)

	from := s.cfg.PostalFromEmail
	if s.cfg.PostalFromName != "" {
		from = fmt.Sprintf("%s <%s>", s.cfg.PostalFromName, s.cfg.PostalFromEmail)
	}

	postalReq := models.PostalSendRequest{
		To:      req.To,
		From:    from,
		Subject: req.Subject,
		HTML:    req.HTML,
		Plain:   req.Plain,
		CC:      req.CC,
		BCC:     req.BCC,
		ReplyTo: req.ReplyTo,
	}

	body, err := json.Marshal(postalReq)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Server-API-Key", s.cfg.PostalAPIKey)

	client := &http.Client{}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var sendResp models.PostalSendResponse
	if err := json.NewDecoder(resp.Body).Decode(&sendResp); err != nil {
		return nil, err
	}

	if sendResp.Status != "success" {
		return &sendResp, fmt.Errorf("postal api error: %s", sendResp.Status)
	}

	return &sendResp, nil
}
