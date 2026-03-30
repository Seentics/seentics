package main

import (
	"crypto/subtle"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"

	ginGzip "github.com/gin-contrib/gzip"

	"github.com/Seentics/seentics/internal/modules/apikeys"
	"github.com/Seentics/seentics/internal/shared/cache"
	"github.com/Seentics/seentics/internal/shared/config"
	"github.com/Seentics/seentics/internal/shared/middleware"

	"github.com/Seentics/seentics/internal/modules/analytics/handlers"
	authHandlerPkg       "github.com/Seentics/seentics/internal/modules/auth/handlers"
	automationHandlerPkg "github.com/Seentics/seentics/internal/modules/automations/handlers"
	funnelHandlerPkg     "github.com/Seentics/seentics/internal/modules/funnels/handlers"
	heatmapHandlerPkg    "github.com/Seentics/seentics/internal/modules/heatmaps/handlers"
	replayHandlerPkg     "github.com/Seentics/seentics/internal/modules/replays/handlers"
	trackerPkg           "github.com/Seentics/seentics/internal/modules/tracker"
	websiteHandlerPkg    "github.com/Seentics/seentics/internal/modules/websites/handlers"
)

// appHandlers bundles all HTTP handlers.
type appHandlers struct {
	analytics  *handlers.AnalyticsHandler
	privacy    *handlers.PrivacyHandler
	health     *handlers.HealthHandler
	admin      *handlers.AdminHandler
	internal   *handlers.InternalHandler
	auth       *authHandlerPkg.AuthHandler
	funnel     *funnelHandlerPkg.FunnelHandler
	website    *websiteHandlerPkg.WebsiteHandler
	heatmap    *heatmapHandlerPkg.HeatmapHandler
	replay     *replayHandlerPkg.ReplayHandler
	automation *automationHandlerPkg.AutomationHandler
	tracker    *trackerPkg.TrackerHandler
}

func setupRouter(cfg *config.Config, appCache *cache.Cache, apiKeySvc *apikeys.Service, h appHandlers, logger zerolog.Logger) *gin.Engine {
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	router.Use(ginGzip.Gzip(ginGzip.DefaultCompression))
	router.Use(middleware.RequestSizeLimitMiddleware(10 * 1024 * 1024))
	router.Use(middleware.CORSMiddleware(cfg.CORSAllowedOrigins))
	router.Use(middleware.ClientIPMiddleware())
	router.Use(middleware.Logger(logger))
	router.Use(middleware.Recovery(logger))

	router.Static("/uploads", "./uploads")

	// Auth bypass for public endpoints
	router.Use(func(c *gin.Context) {
		path := c.Request.URL.Path
		if path == "/health" || c.Request.Method == "OPTIONS" ||
			strings.HasPrefix(path, "/api/v1/user/auth/") ||
			strings.HasPrefix(path, "/api/v1/auth/") ||
			strings.HasPrefix(path, "/uploads/") ||
			strings.HasPrefix(path, "/api/v1/tracker/config/") ||
			strings.HasPrefix(path, "/api/v1/tracker/init/") ||
			path == "/api/v1/tracker/collect" ||
		path == "/api/v1/tracker/replay" ||
			strings.HasPrefix(path, "/api/v1/internal/") ||
			strings.HasPrefix(path, "/api/v1/analytics/public/") {
			c.Next()
			return
		}
		middleware.UnifiedAuthMiddleware(cfg)(c)
	})

	router.Use(middleware.RateLimitMiddleware(appCache))

	router.GET("/health", h.health.HealthCheck)

	v1 := router.Group("/api/v1")
	{
		registerAuthRoutes(v1, h)
		registerTrackerRoutes(v1, h)
		registerAnalyticsRoutes(v1, h)
		registerPrivacyRoutes(v1, h)
		registerWebsiteRoutes(v1, h)
		registerFunnelRoutes(v1, h)
		registerHeatmapRoutes(v1, h)
		registerReplayRoutes(v1, h)
		registerAutomationRoutes(v1, h)
		registerAdminRoutes(v1, h)
		registerInternalRoutes(v1, h)
		registerAPIKeyManagementRoutes(v1, apiKeySvc)
	}

	registerRawAPIRoutes(router, apiKeySvc, h)

	return router
}

func registerAuthRoutes(v1 *gin.RouterGroup, h appHandlers) {
	publicAuth := v1.Group("/auth")
	{
		publicAuth.POST("/register", h.auth.Register)
		publicAuth.POST("/login", h.auth.Login)
		publicAuth.POST("/refresh", h.auth.RefreshToken)
		publicAuth.POST("/forgot-password", h.auth.ForgotPassword)
		publicAuth.POST("/reset-password", h.auth.ResetPassword)
	}

	auth := v1.Group("/user/auth")
	{
		auth.POST("/register", h.auth.Register)
		auth.POST("/login", h.auth.Login)
		auth.POST("/refresh", h.auth.RefreshToken)
		auth.GET("/setup-status", h.auth.SetupStatus)
	}

	users := v1.Group("/user/users")
	{
		users.PUT("/profile", h.auth.UpdateProfile)
		users.PUT("/change-password", h.auth.ChangePassword)
		users.PUT("/avatar", h.auth.UploadAvatar)
	}
}

func registerTrackerRoutes(v1 *gin.RouterGroup, h appHandlers) {
	v1.GET("/tracker/config/:site_id", h.website.GetTrackerConfig)
	v1.GET("/tracker/init/:site_id", h.tracker.Init)
	v1.POST("/tracker/collect", middleware.DecompressMiddleware(), h.tracker.Collect)
	v1.POST("/tracker/replay", middleware.DecompressMiddleware(), h.tracker.ReplayChunk)
}

func registerAnalyticsRoutes(v1 *gin.RouterGroup, h appHandlers) {
	analytics := v1.Group("/analytics")
	{
		analytics.GET("/dashboard/:website_id", h.analytics.GetDashboard)
		analytics.GET("/top-pages/:website_id", h.analytics.GetTopPages)
		analytics.GET("/page-utm-breakdown/:website_id", h.analytics.GetPageUTMBreakdown)
		analytics.GET("/top-referrers/:website_id", h.analytics.GetTopReferrers)
		analytics.GET("/top-sources/:website_id", h.analytics.GetTopSources)
		analytics.GET("/top-countries/:website_id", h.analytics.GetTopCountries)
		analytics.GET("/top-browsers/:website_id", h.analytics.GetTopBrowsers)
		analytics.GET("/top-devices/:website_id", h.analytics.GetTopDevices)
		analytics.GET("/top-resolutions/:website_id", h.analytics.GetTopResolutions)
		analytics.GET("/top-os/:website_id", h.analytics.GetTopOS)
		analytics.GET("/top-languages/:website_id", h.analytics.GetTopLanguages)
		analytics.GET("/top-cities/:website_id", h.analytics.GetTopCities)
		analytics.GET("/traffic-summary/:website_id", h.analytics.GetTrafficSummary)
		analytics.GET("/activity-trends/:website_id", h.analytics.GetActivityTrends)
		analytics.GET("/daily-stats/:website_id", h.analytics.GetDailyStats)
		analytics.GET("/hourly-stats/:website_id", h.analytics.GetHourlyStats)
		analytics.GET("/goals-stats/:website_id", h.analytics.GetGoalStats)
		analytics.GET("/custom-events/:website_id", h.analytics.GetCustomEvents)
		analytics.GET("/realtime/:website_id", h.analytics.GetRealtimeData)
		analytics.GET("/live-visitors/:website_id", h.analytics.GetLiveVisitors)
		analytics.GET("/geolocation-breakdown/:website_id", h.analytics.GetGeolocationBreakdown)
		analytics.GET("/visitor-insights/:website_id", h.analytics.GetVisitorInsights)
		analytics.GET("/recent-activity/:website_id", h.analytics.GetRecentActivity)
		analytics.GET("/path-analysis/:website_id", h.analytics.GetPathAnalysis)
		analytics.GET("/export/:website_id", h.analytics.ExportAnalytics)
		analytics.POST("/import", h.analytics.ImportAnalytics)

		analytics.GET("/public/dashboard/:public_id", h.website.GetPublicDashboard)
	}
}

func registerPrivacyRoutes(v1 *gin.RouterGroup, h appHandlers) {
	priv := v1.Group("/privacy")
	{
		priv.GET("/export/:user_id", h.privacy.ExportUserAnalytics)
		priv.GET("/export/website/:website_id", h.privacy.ExportWebsiteAnalytics)
		priv.POST("/import/:website_id", h.privacy.ImportWebsiteAnalytics)
		priv.DELETE("/delete/:user_id", h.privacy.DeleteUserAnalytics)
		priv.DELETE("/delete/website/:website_id", h.privacy.DeleteWebsiteAnalytics)
		priv.PUT("/anonymize/:user_id", h.privacy.AnonymizeUserAnalytics)
		priv.GET("/retention-policies", h.privacy.GetDataRetentionPolicies)
		priv.POST("/cleanup", h.privacy.RunDataRetentionCleanup)
	}
}

func registerWebsiteRoutes(v1 *gin.RouterGroup, h appHandlers) {
	websites := v1.Group("/user/websites")
	{
		websites.GET("", h.website.List)
		websites.POST("", h.website.Create)
		websites.GET("/:id", h.website.Get)
		websites.GET("/by-site-id/:id", h.website.Get)
		websites.PUT("/:id", h.website.Update)
		websites.DELETE("/:id", h.website.Delete)

		websites.GET("/:id/goals", h.website.ListGoals)
		websites.POST("/:id/goals", h.website.CreateGoal)
		websites.DELETE("/:id/goals/:goal_id", h.website.DeleteGoal)

		websites.GET("/:id/my-role", h.website.GetMyRole)
		websites.GET("/:id/members", h.website.ListMembers)
		websites.POST("/:id/members", h.website.AddMember)
		websites.DELETE("/:id/members/:user_id", h.website.RemoveMember)
		websites.PUT("/:id/members/:user_id/role", h.website.UpdateMemberRole)

		websites.POST("/:id/invitations", h.website.InviteMemberByToken)
		websites.GET("/:id/invitations", h.website.ListPendingInvitations)
		websites.DELETE("/:id/invitations/:invitation_id", h.website.RevokeInvitation)

		websites.POST("/:id/share", h.website.TogglePublicShare)
	}

	v1.POST("/user/accept-invite", h.website.AcceptInvitation)
}

func registerFunnelRoutes(v1 *gin.RouterGroup, h appHandlers) {
	funnels := v1.Group("/websites/:website_id/funnels")
	{
		funnels.GET("", h.funnel.ListFunnels)
		funnels.POST("", h.funnel.CreateFunnel)
		funnels.DELETE("/bulk-delete", h.funnel.DeleteFunnels)
		funnels.GET("/:funnel_id", h.funnel.GetFunnel)
		funnels.PUT("/:funnel_id", h.funnel.UpdateFunnel)
		funnels.DELETE("/:funnel_id", h.funnel.DeleteFunnel)
		funnels.GET("/:funnel_id/stats", h.funnel.GetFunnelStats)
	}

	v1.GET("/funnels/active", h.funnel.GetActiveFunnels)
}

func registerHeatmapRoutes(v1 *gin.RouterGroup, h appHandlers) {
	heatmaps := v1.Group("/heatmaps/:website_id")
	{
		heatmaps.GET("/pages", h.heatmap.ListPages)
		heatmaps.GET("/data", h.heatmap.GetHeatmap)
	}
}

func registerReplayRoutes(v1 *gin.RouterGroup, h appHandlers) {
	replays := v1.Group("/replays/:website_id")
	{
		replays.GET("", h.replay.ListSessions)
		replays.GET("/:session_id", h.replay.GetSession)
	}
}

func registerAutomationRoutes(v1 *gin.RouterGroup, h appHandlers) {
	automations := v1.Group("/websites/:website_id/automations")
	{
		automations.GET("", h.automation.List)
		automations.POST("", h.automation.Create)
		automations.GET("/:id", h.automation.Get)
		automations.PUT("/:id", h.automation.Update)
		automations.DELETE("/:id", h.automation.Delete)
		automations.GET("/:id/executions", h.automation.ListExecutions)
	}
}

func registerAdminRoutes(v1 *gin.RouterGroup, h appHandlers) {
	admin := v1.Group("/admin", middleware.RoleMiddleware("admin"))
	{
		admin.GET("/analytics/stats", h.admin.GetAnalyticsStats)
	}
}

func registerInternalRoutes(v1 *gin.RouterGroup, h appHandlers) {
	internal := v1.Group("/internal", func(c *gin.Context) {
		expectedKey := os.Getenv("GLOBAL_API_KEY")
		providedKey := c.GetHeader("X-API-Key")
		if expectedKey == "" || subtle.ConstantTimeCompare([]byte(providedKey), []byte(expectedKey)) != 1 {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid API key"})
			c.Abort()
			return
		}
		c.Next()
	})
	{
		internal.GET("/user-resource-counts", h.internal.GetUserResourceCounts)
		internal.POST("/user/sync", h.internal.UpsertUser)
		internal.GET("/system/stats", h.internal.GetSystemStats)
		internal.GET("/website-owner", h.internal.GetWebsiteOwner)
		internal.POST("/retention-cleanup", h.internal.RetentionCleanup)
	}
}
