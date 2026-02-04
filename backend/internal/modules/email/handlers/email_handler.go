package handlers

import (
	"analytics-app/internal/modules/email/models"
	"analytics-app/internal/modules/email/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

type EmailHandler struct {
	emailService *services.EmailService
}

func NewEmailHandler(emailService *services.EmailService) *EmailHandler {
	return &EmailHandler{emailService: emailService}
}

func (h *EmailHandler) SendEmail(c *gin.Context) {
	var req models.EmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := h.emailService.SendEmail(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "failed to send email",
			"detail": err.Error(),
			"postal": resp,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":     "success",
		"message_id": resp.Data.MessageID,
	})
}
