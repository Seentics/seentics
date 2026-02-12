package handlers

import (
	"analytics-app/internal/modules/supportdesk/services"
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
)

type SupportDeskHandler struct {
	service *services.SupportDeskService
}

func NewSupportDeskHandler(service *services.SupportDeskService) *SupportDeskHandler {
	return &SupportDeskHandler{service: service}
}

func (h *SupportDeskHandler) getUserID(c *gin.Context) string {
	userID, exists := c.Get("user_id")
	if !exists {
		return ""
	}
	return userID.(string)
}

// Forms
func (h *SupportDeskHandler) CreateForm(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Param("website_id")
	var req struct {
		Name        string      `json:"name" binding:"required"`
		Description string      `json:"description"`
		Fields      interface{} `json:"fields" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	fields, _ := json.Marshal(req.Fields)
	form, err := h.service.CreateForm(c.Request.Context(), websiteID, userID, req.Name, req.Description, fields)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, form)
}

func (h *SupportDeskHandler) ListForms(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Param("website_id")
	forms, err := h.service.GetWebsiteForms(c.Request.Context(), websiteID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, forms)
}

func (h *SupportDeskHandler) getOrigin(c *gin.Context) string {
	origin := c.Request.Header.Get("Origin")
	if origin == "" {
		origin = c.Request.Header.Get("Referer")
	}
	return origin
}

func (h *SupportDeskHandler) SubmitForm(c *gin.Context) {
	// Public endpoint
	formID := c.Param("form_id")
	var req interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	data, _ := json.Marshal(req)
	err := h.service.SubmitForm(c.Request.Context(), formID, data, c.ClientIP(), c.Request.UserAgent(), h.getOrigin(c))
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "submitted"})
}

// Tickets
func (h *SupportDeskHandler) CreateTicket(c *gin.Context) {
	userID := h.getUserID(c)
	websiteID := c.Param("website_id")
	var req struct {
		Subject     string      `json:"subject" binding:"required"`
		Description string      `json:"description"`
		Priority    string      `json:"priority"`
		Source      string      `json:"source"`
		Metadata    interface{} `json:"metadata"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	metadata, _ := json.Marshal(req.Metadata)
	ticket, err := h.service.CreateTicket(c.Request.Context(), websiteID, userID, req.Subject, req.Description, req.Priority, req.Source, metadata, h.getOrigin(c))
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, ticket)
}

func (h *SupportDeskHandler) ListTickets(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Param("website_id")
	tickets, err := h.service.GetWebsiteTickets(c.Request.Context(), websiteID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, tickets)
}

// Chat Widget
func (h *SupportDeskHandler) ConfigureChat(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Param("website_id")
	var req struct {
		Name     string      `json:"name" binding:"required"`
		Config   interface{} `json:"config" binding:"required"`
		IsActive bool        `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	config, _ := json.Marshal(req.Config)
	widget, err := h.service.ConfigureChatWidget(c.Request.Context(), websiteID, userID, req.Name, config, req.IsActive)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, widget)
}

func (h *SupportDeskHandler) GetChatConfig(c *gin.Context) {
	websiteID := c.Param("website_id")
	// If it has a user ID, we use the secure version to prevent cross-leak,
	// but widgets often need public access to config:
	userID := h.getUserID(c)

	var widget interface{}
	var err error
	if userID != "" {
		widget, err = h.service.GetChatWidgetSecure(c.Request.Context(), websiteID, userID)
	} else {
		widget, err = h.service.GetChatWidget(c.Request.Context(), websiteID, h.getOrigin(c))
	}

	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	if widget == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, widget)
}
