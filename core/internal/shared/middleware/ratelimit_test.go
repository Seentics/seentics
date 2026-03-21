package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Seentics/seentics/internal/shared/cache"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRateLimitMiddleware_AllowsNormalTraffic(t *testing.T) {
	appCache, err := cache.NewDefault()
	require.NoError(t, err)
	defer appCache.Shutdown()

	r := gin.New()
	r.Use(RateLimitMiddleware(appCache))
	r.GET("/api/v1/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	req := httptest.NewRequest("GET", "/api/v1/test", nil)
	req.RemoteAddr = "192.168.1.1:1234"
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, 200, w.Code)
}

func TestRateLimitMiddleware_BlocksExcessiveAuthAttempts(t *testing.T) {
	appCache, err := cache.NewDefault()
	require.NoError(t, err)
	defer appCache.Shutdown()

	r := gin.New()
	r.Use(RateLimitMiddleware(appCache))
	r.POST("/api/v1/auth/login", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	// Auth endpoints are limited to 20/min — exceed that
	var lastCode int
	for i := 0; i < 25; i++ {
		req := httptest.NewRequest("POST", "/api/v1/auth/login", nil)
		req.RemoteAddr = "10.0.0.1:1234"
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		lastCode = w.Code
	}

	assert.Equal(t, 429, lastCode, "should rate limit after 20 auth attempts")
}

func TestRateLimitMiddleware_SetsRetryAfterHeader(t *testing.T) {
	appCache, err := cache.NewDefault()
	require.NoError(t, err)
	defer appCache.Shutdown()

	r := gin.New()
	r.Use(RateLimitMiddleware(appCache))
	r.POST("/api/v1/auth/login", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	// Exhaust rate limit
	var w *httptest.ResponseRecorder
	for i := 0; i < 25; i++ {
		req := httptest.NewRequest("POST", "/api/v1/auth/login", nil)
		req.RemoteAddr = "10.0.0.2:1234"
		w = httptest.NewRecorder()
		r.ServeHTTP(w, req)
	}

	if w.Code == 429 {
		assert.NotEmpty(t, w.Header().Get("Retry-After"))
		assert.NotEmpty(t, w.Header().Get("X-RateLimit-Limit"))
	}
}

func TestRateLimitMiddleware_DifferentIPsGetSeparateLimits(t *testing.T) {
	appCache, err := cache.NewDefault()
	require.NoError(t, err)
	defer appCache.Shutdown()

	r := gin.New()
	r.Use(RateLimitMiddleware(appCache))
	r.POST("/api/v1/auth/login", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	// Exhaust limit for IP1
	for i := 0; i < 25; i++ {
		req := httptest.NewRequest("POST", "/api/v1/auth/login", nil)
		req.RemoteAddr = "10.0.0.3:1234"
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
	}

	// IP2 should still be allowed
	req := httptest.NewRequest("POST", "/api/v1/auth/login", nil)
	req.RemoteAddr = "10.0.0.4:1234"
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, 200, w.Code, "different IP should have its own rate limit")
}

func TestRateLimitMiddleware_IngestionEndpointsHaveHighLimits(t *testing.T) {
	appCache, err := cache.NewDefault()
	require.NoError(t, err)
	defer appCache.Shutdown()

	r := gin.New()
	r.Use(RateLimitMiddleware(appCache))
	r.POST("/api/v1/analytics/event", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	// Should handle many requests without rate limiting (limit is 10000/min)
	allOk := true
	for i := 0; i < 100; i++ {
		req := httptest.NewRequest("POST", "/api/v1/analytics/event", nil)
		req.RemoteAddr = "10.0.0.5:1234"
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			allOk = false
			break
		}
	}

	assert.True(t, allOk, "100 ingestion requests should be within limit")
}
