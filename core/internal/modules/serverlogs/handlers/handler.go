package handlers

import (
	"analytics-app/internal/modules/serverlogs/models"
	"analytics-app/internal/modules/serverlogs/services"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type LogsHandler struct {
	service *services.LogsService
}

func NewLogsHandler(service *services.LogsService) *LogsHandler {
	return &LogsHandler{service: service}
}

func (h *LogsHandler) IngestLog(c *gin.Context) {
	var req struct {
		Level    string      `json:"level" binding:"required"`
		Message  string      `json:"message" binding:"required"`
		Source   string      `json:"source" binding:"required"`
		Metadata interface{} `json:"metadata"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	metadata, _ := json.Marshal(req.Metadata)
	entry, err := h.service.IngestLog(c.Request.Context(), req.Level, req.Message, req.Source, metadata)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, entry)
}

func (h *LogsHandler) IngestMetric(c *gin.Context) {
	var req struct {
		Name   string      `json:"name" binding:"required"`
		Value  float64     `json:"value" binding:"required"`
		Labels interface{} `json:"labels"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	labels, _ := json.Marshal(req.Labels)
	entry, err := h.service.IngestMetric(c.Request.Context(), req.Name, req.Value, labels)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, entry)
}

func (h *LogsHandler) GetLogs(c *gin.Context) {
	var q models.LogQuery
	q.Level = c.Query("level")
	q.Source = c.Query("source")

	if start := c.Query("start"); start != "" {
		q.StartTime, _ = time.Parse(time.RFC3339, start)
	}
	if end := c.Query("end"); end != "" {
		q.EndTime, _ = time.Parse(time.RFC3339, end)
	}

	logs, err := h.service.GetLogs(c.Request.Context(), q)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, logs)
}

func (h *LogsHandler) GetMetrics(c *gin.Context) {
	name := c.Query("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	var start, end time.Time
	if s := c.Query("start"); s != "" {
		start, _ = time.Parse(time.RFC3339, s)
	}
	if e := c.Query("end"); e != "" {
		end, _ = time.Parse(time.RFC3339, e)
	}

	metrics, err := h.service.GetMetrics(c.Request.Context(), name, start, end)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, metrics)
}
