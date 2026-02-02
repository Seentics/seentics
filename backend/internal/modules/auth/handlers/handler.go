package handlers

import (
	"analytics-app/internal/modules/auth/models"
	"analytics-app/internal/modules/auth/services"
	"net/http"
	"os"

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

// ForgotPassword handles requesting a password reset
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req models.ForgotPasswordRequest
	if err := h.bindJSON(c, &req); err != nil {
		return
	}

	if err := h.service.ForgotPassword(c.Request.Context(), req.Email); err != nil {
		h.logger.Error().Err(err).Msg("Forgot password request failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process request"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "If an account exists with that email, we've sent a password reset link.",
	})
}

// ResetPassword handles resetting the password
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req models.ResetPasswordRequest
	if err := h.bindJSON(c, &req); err != nil {
		return
	}

	if err := h.service.ResetPassword(c.Request.Context(), req.Token, req.NewPassword); err != nil {
		h.logger.Error().Err(err).Msg("Password reset failed")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Password has been reset successfully",
	})
}

// Helper to bind JSON and handle errors
func (h *AuthHandler) bindJSON(c *gin.Context, obj interface{}) error {
	if err := c.ShouldBindJSON(obj); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return err
	}
	return nil
}

// UpdateProfile handles updating user's basic information
func (h *AuthHandler) UpdateProfile(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req models.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.UpdateProfile(c.Request.Context(), userID, req); err != nil {
		h.logger.Error().Err(err).Msg("Failed to update profile")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get updated user to return
	user, _ := h.service.GetUserByID(c.Request.Context(), userID)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Profile updated successfully",
		"data": gin.H{
			"user": models.UserResponse{
				ID:        user.ID,
				Name:      user.Name,
				Email:     user.Email,
				Avatar:    user.AvatarURL,
				Role:      user.Role,
				CreatedAt: user.CreatedAt,
			},
		},
	})
}

// ChangePassword handles updating user's password
func (h *AuthHandler) ChangePassword(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req models.ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.ChangePassword(c.Request.Context(), userID, req); err != nil {
		h.logger.Error().Err(err).Msg("Failed to change password")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Password changed successfully",
	})
}

// UploadAvatar handles user's avatar upload
func (h *AuthHandler) UploadAvatar(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	file, err := c.FormFile("avatar")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no avatar file provided"})
		return
	}

	// Create uploads directory if it doesn't exist
	if _, err := os.Stat("uploads"); os.IsNotExist(err) {
		os.Mkdir("uploads", 0755)
	}

	// Generate filename: userID_timestamp_filename
	filename := userID + "_" + file.Filename
	filepath := "uploads/" + filename

	if err := c.SaveUploadedFile(file, filepath); err != nil {
		h.logger.Error().Err(err).Msg("Failed to save avatar file")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save file"})
		return
	}

	// Generate public URL (assuming backend is serving /uploads)
	avatarURL := "/uploads/" + filename

	if err := h.service.UpdateAvatar(c.Request.Context(), userID, avatarURL); err != nil {
		h.logger.Error().Err(err).Msg("Failed to update avatar URL in DB")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get updated user to return
	user, _ := h.service.GetUserByID(c.Request.Context(), userID)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Avatar uploaded successfully",
		"data": gin.H{
			"user": models.UserResponse{
				ID:        user.ID,
				Name:      user.Name,
				Email:     user.Email,
				Avatar:    user.AvatarURL,
				Role:      user.Role,
				CreatedAt: user.CreatedAt,
			},
		},
	})
}
