package handlers

import (
	"analytics-app/internal/modules/auth/models"
	"analytics-app/internal/modules/auth/services"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

type AuthHandler struct {
	service *services.AuthService
	logger  zerolog.Logger
}

func NewAuthHandler(service *services.AuthService, logger zerolog.Logger) *AuthHandler {
	return &AuthHandler{
		service: service,
		logger:  logger,
	}
}

// Register handles user registration
func (h *AuthHandler) Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := h.service.Register(c.Request.Context(), req)
	if err != nil {
		h.logger.Error().Err(err).Msg("Registration failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "User registered successfully",
		"data":    resp,
	})
}

// Login handles user authentication
func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := h.service.Login(c.Request.Context(), req)
	if err != nil {
		h.logger.Error().Err(err).Msg("Login failed")
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Logged in successfully",
		"data":    resp,
	})
}
