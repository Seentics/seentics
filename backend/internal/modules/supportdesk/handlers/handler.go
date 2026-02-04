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

// Forms
func (h *SupportDeskHandler) CreateForm(c *gin.Context) {
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
	form, err := h.service.CreateForm(c.Request.Context(), websiteID, req.Name, req.Description, fields)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, form)
}

func (h *SupportDeskHandler) ListForms(c *gin.Context) {
	websiteID := c.Param("website_id")
	forms, err := h.service.GetWebsiteForms(c.Request.Context(), websiteID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, forms)
}

func (h *SupportDeskHandler) SubmitForm(c *gin.Context) {
	formID := c.Param("form_id")
	var req interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	data, _ := json.Marshal(req)
	err := h.service.SubmitForm(c.Request.Context(), formID, data, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "submitted"})
}

// Tickets
func (h *SupportDeskHandler) CreateTicket(c *gin.Context) {
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

	userID := "" // Get from context in real app
	metadata, _ := json.Marshal(req.Metadata)
	ticket, err := h.service.CreateTicket(c.Request.Context(), websiteID, userID, req.Subject, req.Description, req.Priority, req.Source, metadata)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, ticket)
}

func (h *SupportDeskHandler) ListTickets(c *gin.Context) {
	websiteID := c.Param("website_id")
	tickets, err := h.service.GetWebsiteTickets(c.Request.Context(), websiteID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, tickets)
}

// Chat Widget
func (h *SupportDeskHandler) ConfigureChat(c *gin.Context) {
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
	widget, err := h.service.ConfigureChatWidget(c.Request.Context(), websiteID, req.Name, config, req.IsActive)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, widget)
}

func (h *SupportDeskHandler) GetChatConfig(c *gin.Context) {
	websiteID := c.Param("website_id")
	widget, err := h.service.GetChatWidget(c.Request.Context(), websiteID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if widget == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, widget)
}
