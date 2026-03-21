package services

import (
	"context"
	"testing"
	"time"

	"github.com/Seentics/seentics/internal/modules/auth/models"
	"github.com/Seentics/seentics/internal/shared/config"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
)

func newTestService() *AuthService {
	cfg := &config.Config{
		JWTSecret:   "test-secret-that-is-at-least-32-chars-long",
		Environment: "test",
	}
	logger := zerolog.Nop()
	return &AuthService{
		repo:   nil, // tests that need repo will be integration tests
		cfg:    cfg,
		logger: logger,
	}
}

func TestGenerateTokens(t *testing.T) {
	svc := newTestService()

	user := &models.User{
		ID:    uuid.New(),
		Name:  "Test User",
		Email: "test@example.com",
		Role:  "user",
	}

	tokens, err := svc.GenerateTokens(user)
	require.NoError(t, err)
	assert.NotEmpty(t, tokens.AccessToken)
	assert.NotEmpty(t, tokens.RefreshToken)

	// Verify access token claims
	accessToken, err := jwt.Parse(tokens.AccessToken, func(token *jwt.Token) (interface{}, error) {
		return []byte(svc.cfg.JWTSecret), nil
	})
	require.NoError(t, err)
	assert.True(t, accessToken.Valid)

	claims := accessToken.Claims.(jwt.MapClaims)
	assert.Equal(t, user.ID.String(), claims["user_id"])
	assert.Equal(t, user.Email, claims["email"])
	assert.Equal(t, user.Role, claims["role"])

	// Verify access token expires in ~24 hours
	exp := time.Unix(int64(claims["exp"].(float64)), 0)
	assert.WithinDuration(t, time.Now().Add(24*time.Hour), exp, 5*time.Second)
}

func TestGenerateTokens_RefreshTokenExpiry(t *testing.T) {
	svc := newTestService()

	user := &models.User{
		ID:    uuid.New(),
		Email: "test@example.com",
		Role:  "user",
	}

	tokens, err := svc.GenerateTokens(user)
	require.NoError(t, err)

	// Verify refresh token expires in ~7 days
	refreshToken, err := jwt.Parse(tokens.RefreshToken, func(token *jwt.Token) (interface{}, error) {
		return []byte(svc.cfg.JWTSecret), nil
	})
	require.NoError(t, err)
	claims := refreshToken.Claims.(jwt.MapClaims)
	exp := time.Unix(int64(claims["exp"].(float64)), 0)
	assert.WithinDuration(t, time.Now().Add(7*24*time.Hour), exp, 5*time.Second)
}

func TestGenerateTokens_UsesHMACSigning(t *testing.T) {
	svc := newTestService()

	user := &models.User{
		ID:    uuid.New(),
		Email: "test@example.com",
		Role:  "user",
	}

	tokens, err := svc.GenerateTokens(user)
	require.NoError(t, err)

	// Verify signing method is HMAC
	token, _ := jwt.Parse(tokens.AccessToken, func(token *jwt.Token) (interface{}, error) {
		_, ok := token.Method.(*jwt.SigningMethodHMAC)
		assert.True(t, ok, "expected HMAC signing method")
		return []byte(svc.cfg.JWTSecret), nil
	})
	assert.True(t, token.Valid)
}

func TestGenerateTokens_DifferentUsersGetDifferentTokens(t *testing.T) {
	svc := newTestService()

	user1 := &models.User{ID: uuid.New(), Email: "a@test.com", Role: "user"}
	user2 := &models.User{ID: uuid.New(), Email: "b@test.com", Role: "admin"}

	t1, err := svc.GenerateTokens(user1)
	require.NoError(t, err)
	t2, err := svc.GenerateTokens(user2)
	require.NoError(t, err)

	assert.NotEqual(t, t1.AccessToken, t2.AccessToken)
	assert.NotEqual(t, t1.RefreshToken, t2.RefreshToken)
}

func TestRefreshToken_ExpiredToken(t *testing.T) {
	svc := newTestService()

	claims := jwt.MapClaims{
		"user_id": uuid.New().String(),
		"exp":     time.Now().Add(-1 * time.Hour).Unix(), // expired
		"iat":     time.Now().Add(-2 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	refreshStr, err := token.SignedString([]byte(svc.cfg.JWTSecret))
	require.NoError(t, err)

	_, err = svc.RefreshToken(context.Background(), refreshStr)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid or expired refresh token")
}

func TestRefreshToken_WrongSecret(t *testing.T) {
	svc := newTestService()

	claims := jwt.MapClaims{
		"user_id": uuid.New().String(),
		"exp":     time.Now().Add(time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	refreshStr, err := token.SignedString([]byte("wrong-secret-key-that-is-long-enough"))
	require.NoError(t, err)

	_, err = svc.RefreshToken(context.Background(), refreshStr)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid or expired refresh token")
}

func TestPasswordHashing(t *testing.T) {
	password := "secure-password-123"
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	require.NoError(t, err)

	// Correct password should match
	err = bcrypt.CompareHashAndPassword(hash, []byte(password))
	assert.NoError(t, err)

	// Wrong password should not match
	err = bcrypt.CompareHashAndPassword(hash, []byte("wrong-password"))
	assert.Error(t, err)
}
