package main

import (
	"analytics-app/internal/modules/analytics/handlers"
	"analytics-app/internal/modules/analytics/repository"
	"analytics-app/internal/modules/analytics/repository/privacy"
	"analytics-app/internal/modules/analytics/services"
	"analytics-app/internal/shared/config"
	"analytics-app/internal/shared/database"
	"analytics-app/internal/shared/middleware"
	"analytics-app/internal/shared/migrations"
	natsService "analytics-app/internal/shared/nats"
	"analytics-app/internal/shared/storage"
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	authHandlerPkg "analytics-app/internal/modules/auth/handlers"
	authRepoPkg "analytics-app/internal/modules/auth/repository"
	authServicePkg "analytics-app/internal/modules/auth/services"

	autoHandlerPkg "analytics-app/internal/modules/automations/handlers"
	autoRepoPkg "analytics-app/internal/modules/automations/repository"
	autoServicePkg "analytics-app/internal/modules/automations/services"

	funnelHandlerPkg "analytics-app/internal/modules/funnels/handlers"
	funnelRepoPkg "analytics-app/internal/modules/funnels/repository"
	funnelServicePkg "analytics-app/internal/modules/funnels/services"

	websiteHandlerPkg "analytics-app/internal/modules/websites/handlers"
	websiteRepoPkg "analytics-app/internal/modules/websites/repository"
	websiteServicePkg "analytics-app/internal/modules/websites/services"

	heatmapHandlerPkg "analytics-app/internal/modules/heatmaps/handlers"
	heatmapRepoPkg "analytics-app/internal/modules/heatmaps/repository"
	heatmapServicePkg "analytics-app/internal/modules/heatmaps/services"
	replayHandlerPkg "analytics-app/internal/modules/replays/handlers"
	replayRepoPkg "analytics-app/internal/modules/replays/repository"
	replayServicePkg "analytics-app/internal/modules/replays/services"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
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

	// Initialize ClickHouse
	chConn, err := database.ConnectClickHouse(cfg.ClickHouseHost, cfg.ClickHousePort, cfg.ClickHouseUser, cfg.ClickHousePassword, cfg.ClickHouseDB)
	if err != nil {
		logger.Error().Err(err).Msg("Failed to connect to ClickHouse, falling back to PostgreSQL for events")
	}

	// Run database migrations
	migrator := migrations.NewMigrator(db, logger)
	if err := migrator.RunMigrations(context.Background()); err != nil {
		logger.Fatal().Err(err).Msg("Failed to run database migrations")
	}

	// Auto-create partitions (6 months back, 12 months forward)
	logger.Info().Msg("Setting up automatic partitions...")
	if err := database.SetupMonthlyPartitions(context.Background(), db); err != nil {
		logger.Error().Err(err).Msg("Failed to setup automatic partitions")
	} else {
		logger.Info().Msg("Automatic partitions setup completed")
	}

	// Initialize Redis client
	redisURL := getEnvOrDefault("REDIS_URL", "redis://:seentics_redis_pass@redis:6379")
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		logger.Fatal().Err(err).Msg("Failed to parse Redis URL")
	}

	redisClient := redis.NewClient(opt)

	// Test Redis connection
	ctx := context.Background()
	_, err = redisClient.Ping(ctx).Result()
	if err != nil {
		logger.Fatal().Err(err).Msg("Failed to connect to Redis")
	}
	logger.Info().Msg("Connected to Redis")

	// Repositories
	var eventRepo repository.EventRepository
	if chConn != nil {
		chRepo := repository.NewClickHouseEventRepository(chConn, logger)
		// Auto-Create ClickHouse Schema
		if err := chRepo.CreateSchema(ctx); err != nil {
			logger.Error().Err(err).Msg("Failed to create ClickHouse schema")
			eventRepo = repository.NewPostgresEventRepository(db, logger)
		} else {
			logger.Info().Msg("ClickHouse schema verified/created")
			eventRepo = chRepo
		}
	} else {
		eventRepo = repository.NewPostgresEventRepository(db, logger)
	}

	pgAnalyticsRepo := repository.NewPostgresAnalyticsRepository(db)
	var analyticsRepo repository.MainAnalyticsRepository
	if chConn != nil {
		analyticsRepo = repository.NewClickHouseAnalyticsRepository(chConn, pgAnalyticsRepo, logger)
	} else {
		analyticsRepo = pgAnalyticsRepo
	}
	privacyRepo := privacy.NewPrivacyRepository(db)

	// Auth
	authRepo := authRepoPkg.NewAuthRepository(db)
	authService := authServicePkg.NewAuthService(authRepo, cfg, logger)
	authHandler := authHandlerPkg.NewAuthHandler(authService, logger)

	// Heatmaps (Repository only, for website service)
	heatmapRepo := heatmapRepoPkg.NewHeatmapRepository(db)

	// Websites
	websiteRepo := websiteRepoPkg.NewWebsiteRepository(db)
	websiteService := websiteServicePkg.NewWebsiteService(websiteRepo, authRepo, heatmapRepo, redisClient, cfg.Environment, logger)
	websiteHandler := websiteHandlerPkg.NewWebsiteHandler(websiteService, logger)

	// NATS & Events
	natsSvc, err := natsService.NewNATSService(cfg.NATSUrl, cfg.NATSSubjectEvents, logger)
	if err != nil {
		logger.Fatal().Err(err).Msg("Failed to connect to NATS")
	}

	// Automations
	autoRepo := autoRepoPkg.NewAutomationRepository(db)
	autoService := autoServicePkg.NewAutomationService(autoRepo, websiteService)
	autoHandler := autoHandlerPkg.NewAutomationHandler(autoService)

	eventService := services.NewEventService(eventRepo, db, natsSvc, websiteService, autoService, logger)
	analyticsService := services.NewAnalyticsService(analyticsRepo, websiteService, logger)
	privacyService := services.NewPrivacyService(privacyRepo, websiteService, logger)

	// Handlers
	eventHandler := handlers.NewEventHandler(eventService, logger)
	analyticsHandler := handlers.NewAnalyticsHandler(analyticsService, logger)
	privacyHandler := handlers.NewPrivacyHandler(privacyService, logger)
	healthHandler := handlers.NewHealthHandler(db, logger)
	adminHandler := handlers.NewAdminHandler(eventRepo, logger)
	internalHandler := handlers.NewInternalHandler(db, logger)
	if chConn != nil {
		internalHandler.SetClickHouse(chConn)
	}

	// Funnels
	funnelRepo := funnelRepoPkg.NewFunnelRepository(db, chConn)
	funnelService := funnelServicePkg.NewFunnelService(funnelRepo, websiteService)
	funnelHandler := funnelHandlerPkg.NewFunnelHandler(funnelService)
	// Heatmaps (Service)
	heatmapService := heatmapServicePkg.NewHeatmapService(heatmapRepo, websiteService)
	heatmapHandler := heatmapHandlerPkg.NewHeatmapHandler(heatmapService, logger)

	// S3 Store
	s3Region := getEnvOrDefault("AWS_REGION", "us-east-1")
	s3Bucket := getEnvOrDefault("S3_BUCKET_REPLAYS", "seentics-replays")
	s3Endpoint := getEnvOrDefault("S3_ENDPOINT", "http://minio:9000") // Default to local MinIO
	s3Access := getEnvOrDefault("AWS_ACCESS_KEY_ID", "minioadmin")
	s3Secret := getEnvOrDefault("AWS_SECRET_ACCESS_KEY", "minioadmin")

	s3Store, err := storage.NewS3Store(s3Region, s3Bucket, s3Endpoint, s3Access, s3Secret)
	if err != nil {
		logger.Fatal().Err(err).Msg("Failed to initialize S3 store")
	}

	// Replays
	replayRepo := replayRepoPkg.NewReplayRepository(db)
	replayService := replayServicePkg.NewReplayService(replayRepo, websiteService, s3Store)
	replayHandler := replayHandlerPkg.NewReplayHandler(replayService, logger)

	// Setup router
	router := setupRouter(cfg, redisClient, eventService, eventHandler, analyticsHandler, privacyHandler, healthHandler, adminHandler, autoHandler, funnelHandler, authHandler, websiteHandler, heatmapHandler, replayHandler, internalHandler, logger)

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

	if natsSvc != nil {
		if err := natsSvc.Close(); err != nil {
			logger.Error().Err(err).Msg("Failed to close NATS service")
		}
	}

	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error().Err(err).Msg("Server forced to shutdown")
	} else {
		logger.Info().Msg("Server shutdown completed")
	}
}

func setupRouter(cfg *config.Config, redisClient *redis.Client, eventService *services.EventService, eventHandler *handlers.EventHandler, analyticsHandler *handlers.AnalyticsHandler, privacyHandler *handlers.PrivacyHandler, healthHandler *handlers.HealthHandler, adminHandler *handlers.AdminHandler, autoHandler *autoHandlerPkg.AutomationHandler, funnelHandler *funnelHandlerPkg.FunnelHandler, authHandler *authHandlerPkg.AuthHandler, websiteHandler *websiteHandlerPkg.WebsiteHandler, heatmapHandler *heatmapHandlerPkg.HeatmapHandler, replayHandler *replayHandlerPkg.ReplayHandler, internalHandler *handlers.InternalHandler, logger zerolog.Logger) *gin.Engine {
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// EMERGENCY DEBUG LOGGING
	router.Use(func(c *gin.Context) {
		fmt.Printf("DEBUG ROUTER: INCOMING REQUEST %s %s\n", c.Request.Method, c.Request.URL.Path)
		defer func() {
			if r := recover(); r != nil {
				fmt.Printf("DEBUG ROUTER: PANIC RECOVERED: %v\n", r)
				c.AbortWithStatus(500)
			}
		}()
		c.Next()
	})

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
			path == "/api/v1/analytics/event" ||
			path == "/api/v1/analytics/batch" ||
			path == "/api/v1/funnels/track" ||
			path == "/api/v1/funnels/batch" ||
			path == "/api/v1/funnels/active" ||
			path == "/api/v1/workflows/execution/action" ||
			path == "/api/v1/workflows/execution/batch" ||
			path == "/api/v1/heatmaps/record" ||
			path == "/api/v1/replays/record" ||
			strings.HasPrefix(path, "/api/v1/tracker/config/") ||
			strings.HasPrefix(path, "/api/v1/workflows/site/") ||
			strings.HasPrefix(path, "/api/v1/internal/") {
			c.Next()
			return
		}
		middleware.UnifiedAuthMiddleware(cfg)(c)
	})

	// Apply Rate Limiting AFTER Auth so it can identify users by ID
	router.Use(middleware.RateLimitMiddleware(redisClient))

	router.GET("/health", healthHandler.HealthCheck)
	v1 := router.Group("/api/v1")
	{
		analytics := v1.Group("/analytics")
		{
			analytics.POST("/event", eventHandler.TrackEvent)
			analytics.POST("/batch", eventHandler.TrackBatchEvents)
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
			analytics.GET("/user-retention/:website_id", analyticsHandler.GetUserRetention)
			analytics.GET("/visitor-insights/:website_id", analyticsHandler.GetVisitorInsights)
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
		}

		automations := v1.Group("/websites/:website_id/automations")
		{
			automations.GET("", autoHandler.ListAutomations)
			automations.POST("", autoHandler.CreateAutomation)
			automations.GET("/:automation_id", autoHandler.GetAutomation)
			automations.PUT("/:automation_id", autoHandler.UpdateAutomation)
			automations.DELETE("/:automation_id", autoHandler.DeleteAutomation)
			automations.POST("/:automation_id/toggle", autoHandler.ToggleAutomation)
			automations.GET("/:automation_id/stats", autoHandler.GetAutomationStats)
		}

		v1.GET("/workflows/site/:website_id/active", autoHandler.GetActiveWorkflows)
		v1.POST("/workflows/execution/action", autoHandler.TrackExecution)
		v1.POST("/workflows/execution/batch", autoHandler.TrackBatchExecutions) // Batch endpoint
		v1.POST("/automations/test", autoHandler.TestAutomation)

		funnels := v1.Group("/websites/:website_id/funnels")
		{
			funnels.GET("", funnelHandler.ListFunnels)
			funnels.POST("", funnelHandler.CreateFunnel)
			funnels.GET("/:funnel_id", funnelHandler.GetFunnel)
			funnels.PUT("/:funnel_id", funnelHandler.UpdateFunnel)
			funnels.DELETE("/:funnel_id", funnelHandler.DeleteFunnel)
			funnels.GET("/:funnel_id/stats", funnelHandler.GetFunnelStats)
		}

		v1.GET("/funnels/active", funnelHandler.GetActiveFunnels)
		v1.POST("/funnels/track", funnelHandler.TrackFunnelEvent)
		v1.POST("/funnels/batch", funnelHandler.TrackBatchFunnelEvents) // Batch endpoint

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
		}

		heatmaps := v1.Group("/heatmaps")
		{
			heatmaps.POST("/record", heatmapHandler.RecordHeatmap)
			heatmaps.GET("/data", heatmapHandler.GetHeatmapData)
			heatmaps.GET("/pages", heatmapHandler.GetHeatmapPages)
			heatmaps.GET("/top-elements", heatmapHandler.GetTopElements)
			heatmaps.DELETE("/pages", heatmapHandler.DeleteHeatmapPage)
			heatmaps.DELETE("/bulk-delete", heatmapHandler.BulkDeleteHeatmapPages)
		}

		replays := v1.Group("/replays")
		{
			replays.POST("/record", replayHandler.RecordReplay)
			replays.GET("/sessions", replayHandler.ListSessions)
			replays.GET("/snapshot", replayHandler.GetPageSnapshot)
			replays.GET("/data/:session_id", replayHandler.GetReplay)
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
		return zerolog.New(os.Stdout).Level(level).With().Timestamp().Str("service", "analytics").Str("version", "1.0.0").Logger().Sample(&zerolog.BasicSampler{N: 100})
	} else {
		zerolog.TimeFieldFormat = time.RFC3339
		zerolog.SetGlobalLevel(level)
		return zerolog.New(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339}).Level(level).With().Timestamp().Str("service", "analytics").Str("version", "1.0.0").Logger()
	}
}
