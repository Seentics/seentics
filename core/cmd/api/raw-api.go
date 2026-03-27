package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
)

// ── Raw API ───────────────────────────────────────────────────────────────────
//
// Provides programmatic read access to analytics data for external integrations.
//
// Authentication:
//   Authorization: Bearer snc_live_<key>
//   — or —
//   X-API-Key: snc_live_<key>
//
// All routes are prefixed /raw/v1/:website_id/…
// The middleware verifies the key has access to the :website_id in the URL.
//
// Key management endpoints (authed with user JWT, same as dashboard):
//   POST   /api/v1/user/websites/:website_id/api-keys
//   GET    /api/v1/user/websites/:website_id/api-keys
//   DELETE /api/v1/user/websites/:website_id/api-keys/:key_id

// registerRawAPIRoutes wires the raw API routes.
// It is called from setupRouter in routes.go.
func registerRawAPIRoutes(router *gin.Engine, db *pgxpool.Pool, h appHandlers, logger zerolog.Logger) {
	raw := router.Group("/raw/v1", rawAPIAuth(db, logger))
	ws := raw.Group("/:website_id")
	{
		// Analytics — mirrors authenticated dashboard endpoints
		ws.GET("/analytics/dashboard",            h.analytics.GetDashboard)
		ws.GET("/analytics/top-pages",            h.analytics.GetTopPages)
		ws.GET("/analytics/top-referrers",        h.analytics.GetTopReferrers)
		ws.GET("/analytics/top-sources",          h.analytics.GetTopSources)
		ws.GET("/analytics/top-countries",        h.analytics.GetTopCountries)
		ws.GET("/analytics/top-browsers",         h.analytics.GetTopBrowsers)
		ws.GET("/analytics/top-devices",          h.analytics.GetTopDevices)
		ws.GET("/analytics/top-os",               h.analytics.GetTopOS)
		ws.GET("/analytics/top-languages",        h.analytics.GetTopLanguages)
		ws.GET("/analytics/top-cities",           h.analytics.GetTopCities)
		ws.GET("/analytics/traffic-summary",      h.analytics.GetTrafficSummary)
		ws.GET("/analytics/activity-trends",      h.analytics.GetActivityTrends)
		ws.GET("/analytics/daily-stats",          h.analytics.GetDailyStats)
		ws.GET("/analytics/hourly-stats",         h.analytics.GetHourlyStats)
		ws.GET("/analytics/custom-events",        h.analytics.GetCustomEvents)
		ws.GET("/analytics/visitor-insights",     h.analytics.GetVisitorInsights)
		ws.GET("/analytics/recent-activity",      h.analytics.GetRecentActivity)
		ws.GET("/analytics/path-analysis",        h.analytics.GetPathAnalysis)
		ws.GET("/analytics/realtime",             h.analytics.GetRealtimeData)
		ws.GET("/analytics/export",               h.analytics.ExportAnalytics)
	}
}

// registerAPIKeyManagementRoutes adds key-management endpoints under the
// existing authenticated /api/v1 group.
func registerAPIKeyManagementRoutes(v1 *gin.RouterGroup, db *pgxpool.Pool, logger zerolog.Logger) {
	websites := v1.Group("/user/websites/:website_id/api-keys")
	{
		websites.POST("",          createAPIKeyHandler(db, logger))
		websites.GET("",           listAPIKeysHandler(db, logger))
		websites.DELETE("/:key_id", deleteAPIKeyHandler(db, logger))
	}
}

// ── Middleware ────────────────────────────────────────────────────────────────

func rawAPIAuth(db *pgxpool.Pool, logger zerolog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := extractRawKey(c)
		if key == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "API key required (Authorization: Bearer <key> or X-API-Key: <key>)"})
			return
		}

		hash := hashKey(key)
		websiteID := c.Param("website_id")

		var (
			isActive  bool
			keyWSID   string
			expiresAt *time.Time
		)
		err := db.QueryRow(c.Request.Context(),
			`SELECT is_active, website_id, expires_at FROM api_keys WHERE key_hash = $1`,
			hash,
		).Scan(&isActive, &keyWSID, &expiresAt)
		if err != nil || !isActive {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or revoked API key"})
			return
		}
		if expiresAt != nil && time.Now().After(*expiresAt) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "API key has expired"})
			return
		}
		if websiteID != "" && websiteID != keyWSID {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "API key not authorized for this website"})
			return
		}

		// Update last_used_at asynchronously — don't block the request
		go func() {
			_, _ = db.Exec(context.Background(),
				`UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1`, hash)
		}()

		c.Set("raw_api_website_id", keyWSID)
		c.Next()
	}
}

func extractRawKey(c *gin.Context) string {
	if auth := c.GetHeader("Authorization"); len(auth) > 7 && auth[:7] == "Bearer " {
		return auth[7:]
	}
	return c.GetHeader("X-API-Key")
}

func hashKey(raw string) string {
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
}

// ── Key management handlers ───────────────────────────────────────────────────

func createAPIKeyHandler(db *pgxpool.Pool, logger zerolog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		websiteID := c.Param("website_id")
		userID, _ := c.Get("user_id")

		var req struct {
			Name      string     `json:"name" binding:"required"`
			Scopes    []string   `json:"scopes"`
			ExpiresAt *time.Time `json:"expires_at"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if len(req.Scopes) == 0 {
			req.Scopes = []string{"read"}
		}

		rawKey, err := generateKey()
		if err != nil {
			logger.Error().Err(err).Msg("api-key: generate failed")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate key"})
			return
		}
		hash   := hashKey(rawKey)
		prefix := rawKey[:16]

		var id string
		err = db.QueryRow(c.Request.Context(),
			`INSERT INTO api_keys (website_id, user_id, name, key_hash, key_prefix, scopes, expires_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)
			 RETURNING id`,
			websiteID, fmt.Sprintf("%v", userID), req.Name, hash, prefix, req.Scopes, req.ExpiresAt,
		).Scan(&id)
		if err != nil {
			logger.Error().Err(err).Msg("api-key: insert failed")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create key"})
			return
		}

		// Return the raw key ONCE — it cannot be retrieved again
		c.JSON(http.StatusCreated, gin.H{
			"id":         id,
			"key":        rawKey, // only returned on creation
			"key_prefix": prefix,
			"name":       req.Name,
			"scopes":     req.Scopes,
			"expires_at": req.ExpiresAt,
			"created_at": time.Now(),
		})
	}
}

func listAPIKeysHandler(db *pgxpool.Pool, _ zerolog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		websiteID := c.Param("website_id")
		rows, err := db.Query(c.Request.Context(),
			`SELECT id, name, key_prefix, scopes, is_active, last_used_at, expires_at, created_at
			 FROM api_keys WHERE website_id = $1 ORDER BY created_at DESC`,
			websiteID,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list keys"})
			return
		}
		defer rows.Close()

		type keyRow struct {
			ID         string     `json:"id"`
			Name       string     `json:"name"`
			KeyPrefix  string     `json:"key_prefix"`
			Scopes     []string   `json:"scopes"`
			IsActive   bool       `json:"is_active"`
			LastUsedAt *time.Time `json:"last_used_at"`
			ExpiresAt  *time.Time `json:"expires_at"`
			CreatedAt  time.Time  `json:"created_at"`
		}
		var keys []keyRow
		for rows.Next() {
			var k keyRow
			if err := rows.Scan(&k.ID, &k.Name, &k.KeyPrefix, &k.Scopes,
				&k.IsActive, &k.LastUsedAt, &k.ExpiresAt, &k.CreatedAt); err != nil {
				continue
			}
			keys = append(keys, k)
		}
		c.JSON(http.StatusOK, gin.H{"keys": keys})
	}
}

func deleteAPIKeyHandler(db *pgxpool.Pool, _ zerolog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		websiteID := c.Param("website_id")
		keyID     := c.Param("key_id")
		_, err := db.Exec(c.Request.Context(),
			`UPDATE api_keys SET is_active = false WHERE id = $1 AND website_id = $2`,
			keyID, websiteID,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to revoke key"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "revoked"})
	}
}

// generateKey returns a key in the format snc_live_<32 random hex chars>
func generateKey() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "snc_live_" + hex.EncodeToString(b), nil
}
