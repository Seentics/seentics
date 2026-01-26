package services

import (
	"analytics-app/internal/modules/auth/models"
	"analytics-app/internal/modules/auth/repository"
	"analytics-app/internal/shared/config"
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/rs/zerolog"
	"golang.org/x/crypto/bcrypt"
)

type AuthService struct {
	repo   *repository.AuthRepository
	cfg    *config.Config
	logger zerolog.Logger
}

func NewAuthService(repo *repository.AuthRepository, cfg *config.Config, logger zerolog.Logger) *AuthService {
	return &AuthService{
		repo:   repo,
		cfg:    cfg,
		logger: logger,
	}
}

// Register creates a new user account
func (s *AuthService) Register(ctx context.Context, req models.RegisterRequest) (*models.AuthResponse, error) {
	// Check if user already exists
	_, err := s.repo.GetByEmail(ctx, req.Email)
	if err == nil {
		return nil, errors.New("user with this email already exists")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Create user model
	user := &models.User{
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		Role:         "user", // Default role
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	// Save to DB
	if err := s.repo.CreateUser(ctx, user); err != nil {
		return nil, err
	}

	// Generate tokens
	tokens, err := s.GenerateTokens(user)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{
		User: models.UserResponse{
			ID:        user.ID,
			Name:      user.Name,
			Email:     user.Email,
			Role:      user.Role,
			CreatedAt: user.CreatedAt,
		},
		Tokens: *tokens,
	}, nil
}

// Login authenticates a user and returns tokens
func (s *AuthService) Login(ctx context.Context, req models.LoginRequest) (*models.AuthResponse, error) {
	// Get user by email
	user, err := s.repo.GetByEmail(ctx, req.Email)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, errors.New("invalid email or password")
		}
		return nil, err
	}

	// Check password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, errors.New("invalid email or password")
	}

	// Generate tokens
	tokens, err := s.GenerateTokens(user)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{
		User: models.UserResponse{
			ID:        user.ID,
			Name:      user.Name,
			Email:     user.Email,
			Role:      user.Role,
			CreatedAt: user.CreatedAt,
		},
		Tokens: *tokens,
	}, nil
}

// GenerateTokens creates access and refresh tokens for a user
func (s *AuthService) GenerateTokens(user *models.User) (*models.TokenDetails, error) {
	// Access Token
	accessClaims := jwt.MapClaims{
		"user_id": user.ID.String(), // String representation for JWT
		"email":   user.Email,
		"role":    user.Role,
		"exp":     time.Now().Add(time.Hour * 24).Unix(), // 24 hours
		"iat":     time.Now().Unix(),
	}

	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessStr, err := accessToken.SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		return nil, fmt.Errorf("failed to sign access token: %w", err)
	}

	// Refresh Token
	refreshClaims := jwt.MapClaims{
		"user_id": user.ID.String(),
		"exp":     time.Now().Add(time.Hour * 24 * 7).Unix(), // 7 days
		"iat":     time.Now().Unix(),
	}

	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshStr, err := refreshToken.SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		return nil, fmt.Errorf("failed to sign refresh token: %w", err)
	}

	return &models.TokenDetails{
		AccessToken:  accessStr,
		RefreshToken: refreshStr,
	}, nil
}
