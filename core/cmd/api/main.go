package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/Seentics/seentics/internal/modules/analytics/handlers"
	"github.com/Seentics/seentics/internal/modules/analytics/repository"
	"github.com/Seentics/seentics/internal/modules/analytics/repository/privacy"
	"github.com/Seentics/seentics/internal/modules/analytics/services"
	"github.com/Seentics/seentics/internal/shared/config"
	"github.com/Seentics/seentics/internal/shared/database"
	"github.com/Seentics/seentics/internal/shared/middleware"
	"github.com/Seentics/seentics/internal/shared/migrations"
	"github.com/Seentics/seentics/internal/shared/storage"

	authHandlerPkg "github.com/Seentics/seentics/internal/modules/auth/handlers"
	authRepoPkg "github.com/Seentics/seentics/internal/modules/auth/repository"
	authServicePkg "github.com/Seentics/seentics/internal/modules/auth/services"

	autoHandlerPkg "github.com/Seentics/seentics/internal/modules/automations/handlers"
	autoRepoPkg "github.com/Seentics/seentics/internal/modules/automations/repository"
	autoServicePkg "github.com/Seentics/seentics/internal/modules/automations/services"

	funnelHandlerPkg "github.com/Seentics/seentics/internal/modules/funnels/handlers"
	funnelRepoPkg "github.com/Seentics/seentics/internal/modules/funnels/repository"
	funnelServicePkg "github.com/Seentics/seentics/internal/modules/funnels/services"

	websiteHandlerPkg "github.com/Seentics/seentics/internal/modules/websites/handlers"
	websiteRepoPkg "github.com/Seentics/seentics/internal/modules/websites/repository"
	websiteServicePkg "github.com/Seentics/seentics/internal/modules/websites/services"

	heatmapHandlerPkg "github.com/Seentics/seentics/internal/modules/heatmaps/handlers"
	heatmapRepoPkg "github.com/Seentics/seentics/internal/modules/heatmaps/repository"
	heatmapServicePkg "github.com/Seentics/seentics/internal/modules/heatmaps/services"

	replayHandlerPkg "github.com/Seentics/seentics/internal/modules/replays/handlers"
	replayRepoPkg "github.com/Seentics/seentics/internal/modules/replays/repository"
	replayServicePkg "github.com/Seentics/seentics/internal/modules/replays/services"

	trackerPkg "github.com/Seentics/seentics/internal/modules/tracker"

	"github.com/Seentics/seentics/internal/shared/utils"

	"github.com/Seentics/seentics/internal/shared/cache"
	ginGzip "github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatal("Failed to load configuration:", err)
	}

	// Setup logging
	logger := setupLogger(cfg)

	// Initialize database
	db, err := database.Connect(cfg.DatabaseURL, cfg.DbMaxConns, cfg.DbMinConns)
	if err != nil {
		logger.Fatal().Err(err).Msg("Failed to connect to database")
	}
	defer db.Close()

	// Initialize ClickHouse (required for all analytics)
	chConn, err := database.ConnectClickHouse(cfg.ClickHouseHost, cfg.ClickHousePort, cfg.ClickHouseUser, cfg.ClickHousePassword, cfg.ClickHouseDB)
	if err != nil {
		logger.Fatal().Err(err).Msg("Failed to connect to ClickHouse — ClickHouse is required for analytics")
	}

	// Run database migrations
	migrator := migrations.NewMigrator(db, logger)
	if err := migrator.RunMigrations(context.Background()); err != nil {
		logger.Fatal().Err(err).Msg("Failed to run database migrations")
	}

	// Initialize in-process cache for rate limiting, website caching, geolocation
	appCache, err := cache.NewDefault()
	if err != nil {
		logger.Fatal().Err(err).Msg("Failed to initialize cache")
	}
	defer appCache.Shutdown()
	logger.Info().Msg("Cache initialized")

	// Initialize global geolocation service with cache
	utils.InitGlobalGeolocationService(appCache)

	ctx := context.Background()

	// --- Repositories & Storage Infrastructure ---

	// ClickHouse Repositories
	chRepo := repository.NewClickHouseEventRepository(chConn, logger)
	if err := chRepo.CreateSchema(ctx); err != nil {
		logger.Fatal().Err(err).Msg("Failed to create ClickHouse schema")
	}
	logger.Info().Msg("ClickHouse schema verified/created")
	var eventRepo repository.EventRepository = chRepo

	pgAnalyticsRepo := repository.NewPostgresAnalyticsRepository(db)
	var analyticsRepo repository.MainAnalyticsRepository = repository.NewClickHouseAnalyticsRepository(chConn, pgAnalyticsRepo, logger)

	// S3 Store
	s3Region := getEnvOrDefault("AWS_REGION", "us-east-1")
	s3Bucket := getEnvOrDefault("S3_BUCKET_REPLAYS", "seentics-replays")
	s3Endpoint := getEnvOrDefault("S3_ENDPOINT", "http://minio:9000")
	s3Access := getEnvOrDefault("AWS_ACCESS_KEY_ID", "minioadmin")
	s3Secret := getEnvOrDefault("AWS_SECRET_ACCESS_KEY", "minioadmin")
	s3Store, err := storage.NewS3Store(s3Region, s3Bucket, s3Endpoint, s3Access, s3Secret)
	if err != nil {
		logger.Fatal().Err(err).Msg("Failed to initialize S3 store")
	}

	// Module Repositories
	authRepo := authRepoPkg.NewAuthRepository(db)
	heatmapRepo := heatmapRepoPkg.NewHeatmapRepository(db)
	websiteRepo := websiteRepoPkg.NewWebsiteRepository(db)
	autoRepo := autoRepoPkg.NewAutomationRepository(db)
	funnelRepo := funnelRepoPkg.NewFunnelRepository(db, chConn)
	replayRepo := replayRepoPkg.NewReplayRepository(db)
	privacyRepo := privacy.NewPrivacyRepository(db)

	// --- Services ---

	// Website Service (Now includes all repos for cleanup)
	websiteService := websiteServicePkg.NewWebsiteService(
		websiteRepo,
		authRepo,
		heatmapRepo,
		analyticsRepo,
		eventRepo,
		autoRepo,
		funnelRepo,
		replayRepo,
		s3Store,
		appCache,
		cfg.Environment,
		logger,
	)
	websiteHandler := websiteHandlerPkg.NewWebsiteHandler(websiteService, logger)

	// Other Services
	authService := authServicePkg.NewAuthService(authRepo, cfg, logger)
	authHandler := authHandlerPkg.NewAuthHandler(authService, logger)

	autoService := autoServicePkg.NewAutomationService(autoRepo, websiteService)
	autoHandler := autoHandlerPkg.NewAutomationHandler(autoService)

	eventService := services.NewEventService(eventRepo, db, websiteService, autoService, logger)
	analyticsService := services.NewAnalyticsService(analyticsRepo, websiteService, logger)
	privacyService := services.NewPrivacyService(privacyRepo, websiteService, logger)

	funnelService := funnelServicePkg.NewFunnelService(funnelRepo, websiteService)
	funnelHandler := funnelHandlerPkg.NewFunnelHandler(funnelService)

	heatmapService := heatmapServicePkg.NewHeatmapService(heatmapRepo, websiteService, logger)
	heatmapHandler := heatmapHandlerPkg.NewHeatmapHandler(heatmapService, logger)

	replayService := replayServicePkg.NewReplayService(replayRepo, websiteService, s3Store)
	replayHandler := replayHandlerPkg.NewReplayHandler(replayService, logger)

	// Handlers
	analyticsHandler := handlers.NewAnalyticsHandler(analyticsService, logger)
	privacyHandler := handlers.NewPrivacyHandler(privacyService, logger)
	healthHandler := handlers.NewHealthHandler(db, logger)
	adminHandler := handlers.NewAdminHandler(eventRepo, logger)
	internalHandler := handlers.NewInternalHandler(db, logger)
	internalHandler.SetClickHouse(chConn)

	// Unified tracker handler (init + collect)
	trackerHandler := trackerPkg.NewTrackerHandler(websiteService, eventService, heatmapService, replayService, funnelService, autoService, logger)

	// Setup router
	router := setupRouter(cfg, appCache, analyticsHandler, privacyHandler, healthHandler, adminHandler, autoHandler, funnelHandler, authHandler, websiteHandler, heatmapHandler, replayHandler, internalHandler, trackerHandler, logger)

	// Start server
	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		logger.Info().Str("port", cfg.Port).Msg("Server starting")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal().Err(err).Msg("Server failed to start")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info().Msg("Server shutting down...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()

	if err := eventService.Shutdown(10 * time.Second); err != nil {
		logger.Error().Err(err).Msg("Failed to shutdown event service gracefully")
	}
	if err := heatmapService.Shutdown(10 * time.Second); err != nil {
		logger.Error().Err(err).Msg("Failed to shutdown heatmap service gracefully")
	}

	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error().Err(err).Msg("Server forced to shutdown")
	} else {
		logger.Info().Msg("Server shutdown completed")
	}
}

func setupRouter(cfg *config.Config, appCache *cache.Cache, analyticsHandler *handlers.AnalyticsHandler, privacyHandler *handlers.PrivacyHandler, healthHandler *handlers.HealthHandler, adminHandler *handlers.AdminHandler, autoHandler *autoHandlerPkg.AutomationHandler, funnelHandler *funnelHandlerPkg.FunnelHandler, authHandler *authHandlerPkg.AuthHandler, websiteHandler *websiteHandlerPkg.WebsiteHandler, heatmapHandler *heatmapHandlerPkg.HeatmapHandler, replayHandler *replayHandlerPkg.ReplayHandler, internalHandler *handlers.InternalHandler, trackerHandler *trackerPkg.TrackerHandler, logger zerolog.Logger) *gin.Engine {
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	router.Use(ginGzip.Gzip(ginGzip.DefaultCompression))
	router.Use(middleware.RequestSizeLimitMiddleware(10 * 1024 * 1024)) // 10MB limit
	router.Use(middleware.CORSMiddleware(cfg.CORSAllowedOrigins))
	router.Use(middleware.ClientIPMiddleware())
	router.Use(middleware.Logger(logger))
	router.Use(middleware.Recovery(logger))

	// Serve static files for avatars
	router.Static("/uploads", "./uploads")

	router.Use(func(c *gin.Context) {
		path := c.Request.URL.Path
		if path == "/health" || c.Request.Method == "OPTIONS" ||
			strings.HasPrefix(path, "/api/v1/user/auth/") ||
			strings.HasPrefix(path, "/api/v1/auth/") ||
			strings.HasPrefix(path, "/uploads/") ||
			strings.HasPrefix(path, "/api/v1/tracker/config/") ||
			strings.HasPrefix(path, "/api/v1/tracker/init/") ||
			path == "/api/v1/tracker/collect" ||
			strings.HasPrefix(path, "/api/v1/internal/") {
			c.Next()
			return
		}
		middleware.UnifiedAuthMiddleware(cfg)(c)
	})

	// Apply Rate Limiting AFTER Auth so it can identify users by ID
	router.Use(middleware.RateLimitMiddleware(appCache))

	router.GET("/health", healthHandler.HealthCheck)
	v1 := router.Group("/api/v1")
	{
		analytics := v1.Group("/analytics")
		{
			analytics.GET("/dashboard/:website_id", analyticsHandler.GetDashboard)
			analytics.GET("/top-pages/:website_id", analyticsHandler.GetTopPages)
			analytics.GET("/page-utm-breakdown/:website_id", analyticsHandler.GetPageUTMBreakdown)
			analytics.GET("/top-referrers/:website_id", analyticsHandler.GetTopReferrers)
			analytics.GET("/top-sources/:website_id", analyticsHandler.GetTopSources)
			analytics.GET("/top-countries/:website_id", analyticsHandler.GetTopCountries)
			analytics.GET("/top-browsers/:website_id", analyticsHandler.GetTopBrowsers)
			analytics.GET("/top-devices/:website_id", analyticsHandler.GetTopDevices)
			analytics.GET("/top-resolutions/:website_id", analyticsHandler.GetTopResolutions)
			analytics.GET("/top-os/:website_id", analyticsHandler.GetTopOS)
			analytics.GET("/traffic-summary/:website_id", analyticsHandler.GetTrafficSummary)
			analytics.GET("/activity-trends/:website_id", analyticsHandler.GetActivityTrends)
			analytics.GET("/daily-stats/:website_id", analyticsHandler.GetDailyStats)
			analytics.GET("/hourly-stats/:website_id", analyticsHandler.GetHourlyStats)
			analytics.GET("/goals-stats/:website_id", analyticsHandler.GetGoalStats)
			analytics.GET("/custom-events/:website_id", analyticsHandler.GetCustomEvents)
			analytics.GET("/live-visitors/:website_id", analyticsHandler.GetLiveVisitors)
			analytics.GET("/geolocation-breakdown/:website_id", analyticsHandler.GetGeolocationBreakdown)
			analytics.GET("/visitor-insights/:website_id", analyticsHandler.GetVisitorInsights)
			analytics.GET("/recent-activity/:website_id", analyticsHandler.GetRecentActivity)
			analytics.GET("/path-analysis/:website_id", analyticsHandler.GetPathAnalysis)
			analytics.GET("/export/:website_id", analyticsHandler.ExportAnalytics)
			analytics.POST("/import", analyticsHandler.ImportAnalytics)
		}

		v1.Group("/privacy")
		{
			v1.GET("/privacy/export/:user_id", privacyHandler.ExportUserAnalytics)
			v1.DELETE("/privacy/delete/:user_id", privacyHandler.DeleteUserAnalytics)
			v1.DELETE("/privacy/delete/website/:website_id", privacyHandler.DeleteWebsiteAnalytics)
			v1.PUT("/privacy/anonymize/:user_id", privacyHandler.AnonymizeUserAnalytics)
			v1.GET("/privacy/retention-policies", privacyHandler.GetDataRetentionPolicies)
			v1.POST("/privacy/cleanup", privacyHandler.RunDataRetentionCleanup)
		}

		v1.GET("/tracker/config/:site_id", websiteHandler.GetTrackerConfig)

		// Unified tracker endpoints (init + collect)
		v1.GET("/tracker/init/:site_id", trackerHandler.Init)
		v1.POST("/tracker/collect", middleware.DecompressMiddleware(), trackerHandler.Collect)

		admin := v1.Group("/admin", middleware.RoleMiddleware("admin"))
		{
			admin.GET("/analytics/stats", adminHandler.GetAnalyticsStats)
		}

		// Internal endpoints for enterprise gateway (API key protected)
		internal := v1.Group("/internal", func(c *gin.Context) {
			expectedKey := os.Getenv("GLOBAL_API_KEY")
			if expectedKey == "" || c.GetHeader("X-API-Key") != expectedKey {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid API key"})
				c.Abort()
				return
			}
			c.Next()
		})
		{
			internal.GET("/user-resource-counts", internalHandler.GetUserResourceCounts)
			internal.POST("/user/sync", internalHandler.UpsertUser)
			internal.GET("/system/stats", internalHandler.GetSystemStats)
			internal.GET("/website-owner", internalHandler.GetWebsiteOwner)
			internal.POST("/retention-cleanup", internalHandler.RetentionCleanup)
		}

		automations := v1.Group("/websites/:website_id/automations")
		{
			automations.GET("", autoHandler.ListAutomations)
			automations.POST("", autoHandler.CreateAutomation)
			automations.DELETE("/bulk-delete", autoHandler.DeleteAutomations)
			automations.GET("/:automation_id", autoHandler.GetAutomation)
			automations.PUT("/:automation_id", autoHandler.UpdateAutomation)
			automations.DELETE("/:automation_id", autoHandler.DeleteAutomation)
			automations.POST("/:automation_id/toggle", autoHandler.ToggleAutomation)
			automations.GET("/:automation_id/stats", autoHandler.GetAutomationStats)
		}

		v1.GET("/workflows/site/:website_id/active", autoHandler.GetActiveWorkflows)
		v1.POST("/automations/test", autoHandler.TestAutomation)

		funnels := v1.Group("/websites/:website_id/funnels")
		{
			funnels.GET("", funnelHandler.ListFunnels)
			funnels.POST("", funnelHandler.CreateFunnel)
			funnels.DELETE("/bulk-delete", funnelHandler.DeleteFunnels)
			funnels.GET("/:funnel_id", funnelHandler.GetFunnel)
			funnels.PUT("/:funnel_id", funnelHandler.UpdateFunnel)
			funnels.DELETE("/:funnel_id", funnelHandler.DeleteFunnel)
			funnels.GET("/:funnel_id/stats", funnelHandler.GetFunnelStats)
		}

		v1.GET("/funnels/active", funnelHandler.GetActiveFunnels)

		// Public auth endpoints (no authentication required)
		publicAuth := v1.Group("/auth")
		{
			publicAuth.POST("/register", authHandler.Register)
			publicAuth.POST("/login", authHandler.Login)
			publicAuth.POST("/refresh", authHandler.RefreshToken)
			publicAuth.POST("/forgot-password", authHandler.ForgotPassword)
			publicAuth.POST("/reset-password", authHandler.ResetPassword)
		}

		auth := v1.Group("/user/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.POST("/refresh", authHandler.RefreshToken)
			auth.GET("/setup-status", authHandler.SetupStatus)
		}

		users := v1.Group("/user/users")
		{
			users.PUT("/profile", authHandler.UpdateProfile)
			users.PUT("/change-password", authHandler.ChangePassword)
			users.PUT("/avatar", authHandler.UploadAvatar)
		}

		websites := v1.Group("/user/websites")
		{
			websites.GET("", websiteHandler.List)
			websites.POST("", websiteHandler.Create)
			websites.GET("/:id", websiteHandler.Get)
			websites.GET("/by-site-id/:id", websiteHandler.Get)
			websites.PUT("/:id", websiteHandler.Update)
			websites.DELETE("/:id", websiteHandler.Delete)

			// Goals
			websites.GET("/:id/goals", websiteHandler.ListGoals)
			websites.POST("/:id/goals", websiteHandler.CreateGoal)
			websites.DELETE("/:id/goals/:goal_id", websiteHandler.DeleteGoal)

			// Team Members
			websites.GET("/:id/members", websiteHandler.ListMembers)
			websites.POST("/:id/members", websiteHandler.AddMember)
			websites.DELETE("/:id/members/:user_id", websiteHandler.RemoveMember)
			websites.PUT("/:id/members/:user_id/role", websiteHandler.UpdateMemberRole)
		}

		heatmaps := v1.Group("/heatmaps")
		{
			heatmaps.GET("/data", heatmapHandler.GetHeatmapData)
			heatmaps.GET("/pages", heatmapHandler.GetHeatmapPages)
			heatmaps.GET("/top-elements", heatmapHandler.GetTopElements)
			heatmaps.DELETE("/pages", heatmapHandler.DeleteHeatmapPage)
			heatmaps.DELETE("/bulk-delete", heatmapHandler.BulkDeleteHeatmapPages)
		}

		replays := v1.Group("/replays")
		{
			replays.GET("/sessions", replayHandler.ListSessions)
			replays.GET("/snapshot", replayHandler.GetPageSnapshot)
			replays.GET("/data/:session_id", replayHandler.GetReplay)
			// Full-session endpoint: all chunks merged server-side into one sorted event array
			replays.GET("/full/:session_id", replayHandler.GetFullReplay)
			// Legacy streaming endpoints (kept for backwards compatibility)
			replays.GET("/manifest/:session_id", replayHandler.GetReplayManifest)
			replays.GET("/chunk/:session_id", replayHandler.GetReplayChunk)
			replays.DELETE("/sessions/:session_id", replayHandler.DeleteReplay)
			replays.DELETE("/bulk-delete", replayHandler.BulkDeleteReplays)
		}
	}

	return router
}

func setupLogger(cfg *config.Config) zerolog.Logger {
	level, err := zerolog.ParseLevel(cfg.LogLevel)
	if err != nil {
		level = zerolog.InfoLevel
	}

	if cfg.Environment == "production" {
		zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
		zerolog.SetGlobalLevel(level)
		return zerolog.New(os.Stdout).Level(level).With().Timestamp().Str("service", "analytics").Str("version", "1.0.0").Logger()
	} else {
		zerolog.TimeFieldFormat = time.RFC3339
		zerolog.SetGlobalLevel(level)
		return zerolog.New(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339}).Level(level).With().Timestamp().Str("service", "analytics").Str("version", "1.0.0").Logger()
	}
}
