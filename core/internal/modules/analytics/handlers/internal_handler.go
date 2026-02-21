package handlers

import (
	"net/http"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
)

// InternalHandler serves internal API endpoints consumed by the enterprise gateway.
// These endpoints are protected by API key (not JWT).
type InternalHandler struct {
	db     *pgxpool.Pool
	ch     driver.Conn
	logger zerolog.Logger
}

func NewInternalHandler(db *pgxpool.Pool, logger zerolog.Logger) *InternalHandler {
	return &InternalHandler{db: db, logger: logger}
}

// SetClickHouse adds a ClickHouse connection to the handler
func (h *InternalHandler) SetClickHouse(ch driver.Conn) {
	h.ch = ch
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

	// Fetch all website IDs and SiteIDs for this user first
	type websiteInfo struct {
		ID     string
		SiteID string
	}
	var websites []websiteInfo
	rows, err := h.db.Query(ctx, "SELECT id::text, site_id FROM websites WHERE user_id::text = $1", userID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var w websiteInfo
			if err := rows.Scan(&w.ID, &w.SiteID); err == nil {
				websites = append(websites, w)
			}
		}
	}
	counts["websites"] = len(websites)

	if len(websites) == 0 {
		counts["funnels"] = 0
		counts["automations"] = 0
		counts["heatmaps"] = 0
		counts["replays"] = 0
		counts["monthly_events"] = 0
		c.JSON(http.StatusOK, gin.H{"data": counts})
		return
	}

	var siteIDs []string
	var uuidStrings []string
	for _, w := range websites {
		siteIDs = append(siteIDs, w.SiteID)
		uuidStrings = append(uuidStrings, w.ID)
	}

	// Funnels
	var funnelCount int
	if err := h.db.QueryRow(ctx, "SELECT COUNT(*) FROM funnels WHERE user_id::text = $1", userID).Scan(&funnelCount); err != nil {
		h.logger.Warn().Err(err).Str("user_id", userID).Msg("Failed to count funnels")
	}
	counts["funnels"] = funnelCount

	// Automations
	var automationCount int
	if err := h.db.QueryRow(ctx, "SELECT COUNT(*) FROM automations WHERE user_id::text = $1", userID).Scan(&automationCount); err != nil {
		h.logger.Warn().Err(err).Str("user_id", userID).Msg("Failed to count automations")
	}
	counts["automations"] = automationCount

	// Heatmap pages
	var heatmapCount int
	if err := h.db.QueryRow(ctx, "SELECT COUNT(DISTINCT page_path) FROM heatmap_points WHERE website_id::text = ANY($1)", uuidStrings).Scan(&heatmapCount); err != nil {
		h.logger.Warn().Err(err).Str("user_id", userID).Msg("Failed to count heatmaps")
	}
	counts["heatmaps"] = heatmapCount

	// Replay sessions
	var replayCount int
	if err := h.db.QueryRow(ctx, "SELECT COUNT(DISTINCT session_id) FROM session_replays WHERE website_id = ANY($1) OR website_id = ANY($2)", siteIDs, uuidStrings).Scan(&replayCount); err != nil {
		h.logger.Warn().Err(err).Str("user_id", userID).Msg("Failed to count replays")
	}
	counts["replays"] = replayCount

	// Monthly events
	var monthlyEvents int
	startOfMonth := time.Now().UTC().AddDate(0, 0, -time.Now().Day()+1)
	startOfMonth = time.Date(startOfMonth.Year(), startOfMonth.Month(), 1, 0, 0, 0, 0, time.UTC)

	if h.ch != nil {
		var chCount uint64
		err := h.ch.QueryRow(ctx, "SELECT count() FROM events WHERE website_id IN (?) AND timestamp >= ?", siteIDs, startOfMonth).Scan(&chCount)
		if err == nil {
			monthlyEvents = int(chCount)
		}

		var customCount uint64
		err = h.ch.QueryRow(ctx, "SELECT COALESCE(sum(count), 0) FROM custom_events_aggregated WHERE website_id IN (?) AND last_seen >= ?", siteIDs, startOfMonth).Scan(&customCount)
		if err == nil {
			monthlyEvents += int(customCount)
		}
	} else {
		err := h.db.QueryRow(ctx, `
			SELECT COALESCE(SUM(count_sum), 0) FROM (
				SELECT COUNT(*) as count_sum FROM events WHERE website_id = ANY($1) AND timestamp >= $2
				UNION ALL
				SELECT COALESCE(SUM(count), 0) as count_sum FROM custom_events_aggregated WHERE website_id = ANY($1) AND last_seen >= $2
			) AS combined
		`, siteIDs, startOfMonth).Scan(&monthlyEvents)
		if err != nil {
			h.logger.Warn().Err(err).Str("user_id", userID).Msg("Failed to count monthly events from Postgres")
		}
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
