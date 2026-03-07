package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Seentics/seentics/internal/shared/config"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func generateTestJWT(secret string, claims jwt.MapClaims) string {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	str, _ := token.SignedString([]byte(secret))
	return str
}

func setupTestRouter(cfg *config.Config) *gin.Engine {
	r := gin.New()
	r.Use(UnifiedAuthMiddleware(cfg))
	r.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"user_id": c.GetString("user_id"),
			"email":   c.GetString("user_email"),
		})
	})
	return r
}

func TestUnifiedAuthMiddleware_ValidBearerToken(t *testing.T) {
	secret := "test-secret-that-is-long-enough-for-jwt"
	cfg := &config.Config{JWTSecret: secret}
	router := setupTestRouter(cfg)

	token := generateTestJWT(secret, jwt.MapClaims{
		"user_id": "user-123",
		"email":   "test@example.com",
		"role":    "user",
		"exp":     time.Now().Add(time.Hour).Unix(),
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, 200, w.Code)
	assert.Contains(t, w.Body.String(), "user-123")
}

func TestUnifiedAuthMiddleware_ValidCookieToken(t *testing.T) {
	secret := "test-secret-that-is-long-enough-for-jwt"
	cfg := &config.Config{JWTSecret: secret}
	router := setupTestRouter(cfg)

	token := generateTestJWT(secret, jwt.MapClaims{
		"user_id": "user-cookie-456",
		"email":   "cookie@example.com",
		"exp":     time.Now().Add(time.Hour).Unix(),
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.AddCookie(&http.Cookie{Name: "access_token", Value: token})
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, 200, w.Code)
	assert.Contains(t, w.Body.String(), "user-cookie-456")
}

func TestUnifiedAuthMiddleware_NoAuthProvided(t *testing.T) {
	cfg := &config.Config{JWTSecret: "test-secret-that-is-long-enough"}
	router := setupTestRouter(cfg)

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, 401, w.Code)
	assert.Contains(t, w.Body.String(), "Authorization required")
}

func TestUnifiedAuthMiddleware_ExpiredToken(t *testing.T) {
	secret := "test-secret-that-is-long-enough-for-jwt"
	cfg := &config.Config{JWTSecret: secret}
	router := setupTestRouter(cfg)

	token := generateTestJWT(secret, jwt.MapClaims{
		"user_id": "user-123",
		"exp":     time.Now().Add(-time.Hour).Unix(), // expired
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, 401, w.Code)
	assert.Contains(t, w.Body.String(), "Invalid or expired token")
}

func TestUnifiedAuthMiddleware_WrongSecret(t *testing.T) {
	cfg := &config.Config{JWTSecret: "correct-secret-that-is-long-enough"}
	router := setupTestRouter(cfg)

	token := generateTestJWT("wrong-secret-that-is-also-long-enough", jwt.MapClaims{
		"user_id": "user-123",
		"exp":     time.Now().Add(time.Hour).Unix(),
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, 401, w.Code)
}

func TestUnifiedAuthMiddleware_PublicEndpointsAllowed(t *testing.T) {
	cfg := &config.Config{JWTSecret: "test-secret-long-enough"}
	r := gin.New()
	r.Use(UnifiedAuthMiddleware(cfg))

	publicPaths := []string{
		"/api/v1/analytics/event",
		"/api/v1/analytics/batch",
	}

	for _, path := range publicPaths {
		r.GET(path, func(c *gin.Context) {
			c.JSON(200, gin.H{"ok": true})
		})
	}

	for _, path := range publicPaths {
		req := httptest.NewRequest("GET", path, nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		assert.Equal(t, 200, w.Code, "expected %s to be accessible without auth", path)
	}
}

func TestUnifiedAuthMiddleware_BearerTakesPriorityOverCookie(t *testing.T) {
	secret := "test-secret-that-is-long-enough-for-jwt"
	cfg := &config.Config{JWTSecret: secret}
	router := setupTestRouter(cfg)

	bearerToken := generateTestJWT(secret, jwt.MapClaims{
		"user_id": "bearer-user",
		"email":   "bearer@test.com",
		"exp":     time.Now().Add(time.Hour).Unix(),
	})
	cookieToken := generateTestJWT(secret, jwt.MapClaims{
		"user_id": "cookie-user",
		"email":   "cookie@test.com",
		"exp":     time.Now().Add(time.Hour).Unix(),
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+bearerToken)
	req.AddCookie(&http.Cookie{Name: "access_token", Value: cookieToken})
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, 200, w.Code)
	assert.Contains(t, w.Body.String(), "bearer-user")
}

func TestRoleMiddleware_CorrectRole(t *testing.T) {
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("user_role", "admin")
		c.Next()
	})
	r.Use(RoleMiddleware("admin"))
	r.GET("/admin", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	req := httptest.NewRequest("GET", "/admin", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, 200, w.Code)
}

func TestRoleMiddleware_WrongRole(t *testing.T) {
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("user_role", "user")
		c.Next()
	})
	r.Use(RoleMiddleware("admin"))
	r.GET("/admin", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	req := httptest.NewRequest("GET", "/admin", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, 403, w.Code)
}

func TestRoleMiddleware_NoRole(t *testing.T) {
	r := gin.New()
	r.Use(RoleMiddleware("admin"))
	r.GET("/admin", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	req := httptest.NewRequest("GET", "/admin", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, 403, w.Code)
}

func TestAPIKeyMiddleware_ValidKey(t *testing.T) {
	t.Setenv("GLOBAL_API_KEY", "test-api-key-123")

	handler := APIKeyMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))

	req := httptest.NewRequest("GET", "/internal", nil)
	req.Header.Set("X-API-Key", "test-api-key-123")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)
	assert.Equal(t, 200, w.Code)
}

func TestAPIKeyMiddleware_InvalidKey(t *testing.T) {
	t.Setenv("GLOBAL_API_KEY", "test-api-key-123")

	handler := APIKeyMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))

	req := httptest.NewRequest("GET", "/internal", nil)
	req.Header.Set("X-API-Key", "wrong-key")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)
	assert.Equal(t, 401, w.Code)
}

func TestAPIKeyMiddleware_MissingKey(t *testing.T) {
	t.Setenv("GLOBAL_API_KEY", "test-api-key-123")

	handler := APIKeyMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))

	req := httptest.NewRequest("GET", "/internal", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)
	assert.Equal(t, 401, w.Code)
}

// Verify that token with unsupported signing method is rejected
func TestUnifiedAuthMiddleware_RejectsNonHMAC(t *testing.T) {
	cfg := &config.Config{JWTSecret: "test-secret-long-enough"}
	router := setupTestRouter(cfg)

	// Create a token with "none" algorithm
	token := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.MapClaims{
		"user_id": "attacker",
		"exp":     time.Now().Add(time.Hour).Unix(),
	})
	tokenStr, err := token.SignedString(jwt.UnsafeAllowNoneSignatureType)
	require.NoError(t, err)

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, 401, w.Code, "none algorithm should be rejected")
}
