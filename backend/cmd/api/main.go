package main

import (
	"analytics-app/internal/modules/analytics/handlers"
	"analytics-app/internal/modules/analytics/repository"
	"analytics-app/internal/modules/analytics/repository/privacy"
	"analytics-app/internal/modules/analytics/services"
	billingHandlerPkg "analytics-app/internal/modules/billing/handlers"
	"analytics-app/internal/modules/billing/models"
	billingRepoPkg "analytics-app/internal/modules/billing/repository"
	billingServicePkg "analytics-app/internal/modules/billing/services"
	"analytics-app/internal/shared/config"
	"analytics-app/internal/shared/database"
	"analytics-app/internal/shared/kafka"
	"analytics-app/internal/shared/middleware"
	"analytics-app/internal/shared/migrations"
	"context"
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

	notiHandlerPkg "analytics-app/internal/modules/notifications/handlers"
	notiRepoPkg "analytics-app/internal/modules/notifications/repository"
	notiServicePkg "analytics-app/internal/modules/notifications/services"

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
	eventRepo := repository.NewEventRepository(db, logger)
	analyticsRepo := repository.NewMainAnalyticsRepository(db)
	privacyRepo := privacy.NewPrivacyRepository(db)

	// Auth
	authRepo := authRepoPkg.NewAuthRepository(db)
	authService := authServicePkg.NewAuthService(authRepo, cfg, logger)
	authHandler := authHandlerPkg.NewAuthHandler(authService, logger)

	// Billing
	billingRepo := billingRepoPkg.NewBillingRepository(db)
	billingService := billingServicePkg.NewBillingService(billingRepo, redisClient)
	billingHandler := billingHandlerPkg.NewBillingHandler(billingService, logger)

	// Websites
	websiteRepo := websiteRepoPkg.NewWebsiteRepository(db)
	websiteService := websiteServicePkg.NewWebsiteService(websiteRepo, authRepo, billingService, redisClient, logger)
	websiteHandler := websiteHandlerPkg.NewWebsiteHandler(websiteService, logger)

	// Kafka & Events
	kafkaService := kafka.NewKafkaService(cfg.KafkaBootstrapServers, cfg.KafkaTopicEvents, logger)

	// Automations
	autoRepo := autoRepoPkg.NewAutomationRepository(db)
	autoService := autoServicePkg.NewAutomationService(autoRepo, billingService)
	autoHandler := autoHandlerPkg.NewAutomationHandler(autoService)

	eventService := services.NewEventService(eventRepo, db, kafkaService, billingService, websiteService, autoService, logger)
	analyticsService := services.NewAnalyticsService(analyticsRepo, websiteService, logger)
	privacyService := services.NewPrivacyService(privacyRepo, logger)

	// Handlers
	eventHandler := handlers.NewEventHandler(eventService, logger)
	analyticsHandler := handlers.NewAnalyticsHandler(analyticsService, logger)
	privacyHandler := handlers.NewPrivacyHandler(privacyService, logger)
	healthHandler := handlers.NewHealthHandler(db, logger)
	adminHandler := handlers.NewAdminHandler(eventRepo, logger)

	// Funnels
	funnelRepo := funnelRepoPkg.NewFunnelRepository(db)
	funnelService := funnelServicePkg.NewFunnelService(funnelRepo, billingService)
	funnelHandler := funnelHandlerPkg.NewFunnelHandler(funnelService)

	// Notifications
	notiRepo := notiRepoPkg.NewNotificationRepository(db)
	notiService := notiServicePkg.NewNotificationService(notiRepo)
	notiHandler := notiHandlerPkg.NewNotificationHandler(notiService, logger)

	// Start periodic billing sync (every 5 minutes)
	billingService.StartPeriodicSync(5 * time.Minute)
	logger.Info().Msg("Started periodic billing sync worker")

	// Setup router
	router := setupRouter(cfg, redisClient, eventService, eventHandler, analyticsHandler, privacyHandler, healthHandler, adminHandler, autoHandler, funnelHandler, billingHandler, authHandler, websiteHandler, billingService, notiHandler, logger)

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

	if kafkaService != nil {
		if err := kafkaService.Close(); err != nil {
			logger.Error().Err(err).Msg("Failed to close Kafka service")
		}
	}

	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error().Err(err).Msg("Server forced to shutdown")
	} else {
		logger.Info().Msg("Server shutdown completed")
	}
}

func setupRouter(cfg *config.Config, redisClient *redis.Client, eventService *services.EventService, eventHandler *handlers.EventHandler, analyticsHandler *handlers.AnalyticsHandler, privacyHandler *handlers.PrivacyHandler, healthHandler *handlers.HealthHandler, adminHandler *handlers.AdminHandler, autoHandler *autoHandlerPkg.AutomationHandler, funnelHandler *funnelHandlerPkg.FunnelHandler, billingHandler *billingHandlerPkg.BillingHandler, authHandler *authHandlerPkg.AuthHandler, websiteHandler *websiteHandlerPkg.WebsiteHandler, billingService *billingServicePkg.BillingService, notiHandler *notiHandlerPkg.NotificationHandler, logger zerolog.Logger) *gin.Engine {
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	router.Use(middleware.CORSMiddleware(cfg.CORSAllowedOrigins))
	router.Use(middleware.ClientIPMiddleware())
	router.Use(middleware.Logger(logger))
	router.Use(middleware.Recovery(logger))
	router.Use(middleware.RateLimitMiddleware(redisClient))

	// Serve static files for avatars
	router.Static("/uploads", "./uploads")

	router.Use(func(c *gin.Context) {
		path := c.Request.URL.Path
		if path == "/health" || c.Request.Method == "OPTIONS" ||
			strings.HasPrefix(path, "/api/v1/user/auth/") ||
			strings.HasPrefix(path, "/uploads/") ||
			path == "/api/v1/analytics/event" ||
			path == "/api/v1/analytics/batch" ||
			path == "/api/v1/webhooks/lemonsqueezy" ||
			path == "/api/v1/test/webhooks/lemonsqueezy" ||
			path == "/api/v1/funnels/track" ||
			path == "/api/v1/funnels/active" ||
			path == "/api/v1/workflows/execution/action" ||
			strings.HasPrefix(path, "/api/v1/workflows/site/") {
			c.Next()
			return
		}
		middleware.UnifiedAuthMiddleware(cfg)(c)
	})

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
			analytics.GET("/top-os/:website_id", analyticsHandler.GetTopOS)
			analytics.GET("/traffic-summary/:website_id", analyticsHandler.GetTrafficSummary)
			analytics.GET("/activity-trends/:website_id", analyticsHandler.GetActivityTrends)
			analytics.GET("/daily-stats/:website_id", analyticsHandler.GetDailyStats)
			analytics.GET("/hourly-stats/:website_id", analyticsHandler.GetHourlyStats)
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

		admin := v1.Group("/admin")
		{
			admin.GET("/analytics/stats", adminHandler.GetAnalyticsStats)
		}

		automations := v1.Group("/websites/:website_id/automations")
		{
			automations.GET("", autoHandler.ListAutomations)
			automations.POST("", middleware.BillingLimitMiddleware(billingService, models.ResourceAutomations), autoHandler.CreateAutomation)
			automations.GET("/:automation_id", autoHandler.GetAutomation)
			automations.PUT("/:automation_id", autoHandler.UpdateAutomation)
			automations.DELETE("/:automation_id", autoHandler.DeleteAutomation)
			automations.POST("/:automation_id/toggle", autoHandler.ToggleAutomation)
			automations.GET("/:automation_id/stats", autoHandler.GetAutomationStats)
		}

		v1.GET("/workflows/site/:website_id/active", autoHandler.GetActiveWorkflows)
		v1.POST("/workflows/execution/action", autoHandler.TrackExecution)

		funnels := v1.Group("/websites/:website_id/funnels")
		{
			funnels.GET("", funnelHandler.ListFunnels)
			funnels.POST("", middleware.BillingLimitMiddleware(billingService, models.ResourceFunnels), funnelHandler.CreateFunnel)
			funnels.GET("/:funnel_id", funnelHandler.GetFunnel)
			funnels.PUT("/:funnel_id", funnelHandler.UpdateFunnel)
			funnels.DELETE("/:funnel_id", funnelHandler.DeleteFunnel)
			funnels.GET("/:funnel_id/stats", funnelHandler.GetFunnelStats)
		}

		v1.GET("/funnels/active", funnelHandler.GetActiveFunnels)
		v1.POST("/funnels/track", funnelHandler.TrackFunnelEvent)

		billing := v1.Group("/user/billing")
		{
			billing.GET("/usage", billingHandler.GetUsage)
			billing.POST("/checkout", billingHandler.CreateCheckout)
			billing.POST("/portal", billingHandler.CreatePortalSession)
			billing.POST("/cancel", billingHandler.CancelSubscription)
			billing.POST("/select-free", billingHandler.SelectFreePlan)
			billing.POST("/simulate-webhook", billingHandler.SimulateWebhook)
		}

		v1.POST("/webhooks/lemonsqueezy", billingHandler.Webhook)
		v1.POST("/test/webhooks/lemonsqueezy", billingHandler.Webhook)

		auth := v1.Group("/user/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
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
			websites.POST("", middleware.BillingLimitMiddleware(billingService, models.ResourceWebsites), websiteHandler.Create)
			websites.GET("/:id", websiteHandler.Get)
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

		notifications := v1.Group("/user/notifications")
		{
			notifications.GET("", notiHandler.List)
			notifications.PUT("/:id/read", notiHandler.MarkRead)
			notifications.PUT("/read-all", notiHandler.MarkAllRead)
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
