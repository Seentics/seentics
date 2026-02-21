package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
)

// InternalHandler serves internal API endpoints consumed by the enterprise gateway.
// These endpoints are protected by API key (not JWT).
type InternalHandler struct {
	db     *pgxpool.Pool
	logger zerolog.Logger
}

func NewInternalHandler(db *pgxpool.Pool, logger zerolog.Logger) *InternalHandler {
	return &InternalHandler{db: db, logger: logger}
}

// GetUserResourceCounts returns the current count of each resource type for a user.
// Used by the enterprise gateway billing service for usage limit enforcement.
func (h *InternalHandler) GetUserResourceCounts(c *gin.Context) {
	userID := c.Query("user_id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id query parameter required"})
		return
	}

	ctx := c.Request.Context()
	counts := make(map[string]int)

	// Websites
	var websiteCount int
	if err := h.db.QueryRow(ctx, "SELECT COUNT(*) FROM websites WHERE user_id::text = $1", userID).Scan(&websiteCount); err != nil {
		h.logger.Warn().Err(err).Str("user_id", userID).Msg("Failed to count websites")
	}
	counts["websites"] = websiteCount

	// Funnels
	var funnelCount int
	if err := h.db.QueryRow(ctx, "SELECT COUNT(*) FROM funnels WHERE user_id = $1", userID).Scan(&funnelCount); err != nil {
		h.logger.Warn().Err(err).Str("user_id", userID).Msg("Failed to count funnels")
	}
	counts["funnels"] = funnelCount

	// Automations
	var automationCount int
	if err := h.db.QueryRow(ctx, "SELECT COUNT(*) FROM automations WHERE user_id = $1", userID).Scan(&automationCount); err != nil {
		h.logger.Warn().Err(err).Str("user_id", userID).Msg("Failed to count automations")
	}
	counts["automations"] = automationCount

	// Heatmap pages (distinct pages with heatmap data)
	var heatmapCount int
	heatmapQuery := `
		SELECT COUNT(DISTINCT page_path)
		FROM heatmap_points h
		JOIN websites w ON (h.website_id::text = w.site_id OR h.website_id = w.id::text)
		WHERE w.user_id::text = $1
	`
	if err := h.db.QueryRow(ctx, heatmapQuery, userID).Scan(&heatmapCount); err != nil {
		h.logger.Warn().Err(err).Str("user_id", userID).Msg("Failed to count heatmaps")
	}
	counts["heatmaps"] = heatmapCount

	// Replay sessions
	var replayCount int
	replayQuery := `
		SELECT COUNT(DISTINCT session_id)
		FROM session_replays sr
		JOIN websites w ON (sr.website_id = w.site_id OR sr.website_id = w.id::text)
		WHERE w.user_id::text = $1
	`
	if err := h.db.QueryRow(ctx, replayQuery, userID).Scan(&replayCount); err != nil {
		h.logger.Warn().Err(err).Str("user_id", userID).Msg("Failed to count replays")
	}
	counts["replays"] = replayCount

	// Monthly events (current billing period)
	var monthlyEvents int
	eventsQuery := `
		SELECT COALESCE(SUM(count_sum), 0) FROM (
			SELECT COUNT(*) as count_sum
			FROM events e
			JOIN websites w ON (e.website_id = w.site_id OR e.website_id = w.id::text)
			WHERE w.user_id::text = $1
			AND e.timestamp >= date_trunc('month', now())
			UNION ALL
			SELECT COALESCE(SUM(c.count), 0) as count_sum
			FROM custom_events_aggregated c
			JOIN websites w ON (c.website_id = w.site_id OR c.website_id = w.id::text)
			WHERE w.user_id::text = $1
			AND c.last_seen >= date_trunc('month', now())
		) AS combined
	`
	if err := h.db.QueryRow(ctx, eventsQuery, userID).Scan(&monthlyEvents); err != nil {
		h.logger.Warn().Err(err).Str("user_id", userID).Msg("Failed to count monthly events")
	}
	counts["monthly_events"] = monthlyEvents

	c.JSON(http.StatusOK, gin.H{"data": counts})
}

// UpsertUser synchronization endpoint for the enterprise gateway.
// This ensures that the user exists in the core analytics DB so that
// foreign key constraints (e.g. on websites table) are satisfied.
func (h *InternalHandler) UpsertUser(c *gin.Context) {
	var req struct {
		ID    string `json:"id" binding:"required"`
		Email string `json:"email" binding:"required"`
		Name  string `json:"name"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()

	// Explicitly include password_hash=NULL so the INSERT works even if
	// migration 0016 (nullable password) hasn't been applied yet and the
	// column still has a NOT NULL constraint with no DEFAULT.
	query := `
		INSERT INTO users (id, email, name, password_hash, role, created_at, updated_at)
		VALUES ($1, $2, $3, NULL, 'user', now(), now())
		ON CONFLICT (id) DO UPDATE
		SET email = EXCLUDED.email, name = EXCLUDED.name, updated_at = now()
	`

	_, err := h.db.Exec(ctx, query, req.ID, req.Email, req.Name)
	if err != nil {
		// The INSERT may fail due to a UNIQUE constraint on email (user exists
		// with the same email but a different id, e.g. created in OSS mode).
		// Fall back to updating the existing row to adopt the gateway's user id.
		h.logger.Warn().Err(err).Str("id", req.ID).Str("email", req.Email).
			Msg("Primary upsert failed, trying email-based update")

		fallbackQuery := `
			UPDATE users SET id = $1, name = $2, updated_at = now()
			WHERE email = $3
		`
		if _, fallbackErr := h.db.Exec(ctx, fallbackQuery, req.ID, req.Name, req.Email); fallbackErr != nil {
			h.logger.Error().Err(fallbackErr).Str("id", req.ID).Str("email", req.Email).
				Msg("Failed to upsert user for sync (both attempts failed)")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to sync user"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "user synced successfully"})
}
