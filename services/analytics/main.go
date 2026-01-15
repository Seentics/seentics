package main

import (
	"analytics-app/config"
	"analytics-app/database"
	"analytics-app/handlers"
	"analytics-app/middleware"
	"analytics-app/migrations"
	"analytics-app/repository"
	"analytics-app/repository/privacy"
	"analytics-app/services"
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

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
	db, err := database.Connect(cfg.DatabaseURL)
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
		// Don't fail startup, but log the error
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

	// Initialize repositories
	eventRepo := repository.NewEventRepository(db, logger)
	analyticsRepo := repository.NewMainAnalyticsRepository(db)
	privacyRepo := privacy.NewPrivacyRepository(db)

	// Initialize services
	eventService := services.NewEventService(eventRepo, db, logger)
	analyticsService := services.NewAnalyticsService(analyticsRepo, logger)
	privacyService := services.NewPrivacyService(privacyRepo, logger)

	// Initialize handlers
	eventHandler := handlers.NewEventHandler(eventService, logger)
	analyticsHandler := handlers.NewAnalyticsHandler(analyticsService, logger)
	privacyHandler := handlers.NewPrivacyHandler(privacyService, logger)
	healthHandler := handlers.NewHealthHandler(db, logger)
	adminHandler := handlers.NewAdminHandler(eventRepo, logger)

	// Setup router
	router := setupRouter(cfg, eventService, eventHandler, analyticsHandler, privacyHandler, healthHandler, adminHandler, logger)

	// Start server
	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		logger.Info().Str("port", cfg.Port).Msg("Server starting")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal().Err(err).Msg("Server failed to start")
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info().Msg("Server shutting down...")

	// Graceful shutdown with event buffer flush
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()

	// Shutdown event service first to flush buffered events
	logger.Info().Msg("Flushing buffered events...")
	if err := eventService.Shutdown(10 * time.Second); err != nil {
		logger.Error().Err(err).Msg("Failed to shutdown event service gracefully")
	}

	// Then shutdown HTTP server
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error().Err(err).Msg("Server forced to shutdown")
	} else {
		logger.Info().Msg("Server shutdown completed")
	}
}

func setupLogger(cfg *config.Config) zerolog.Logger {
	// Configure log level
	level, err := zerolog.ParseLevel(cfg.LogLevel)
	if err != nil {
		level = zerolog.InfoLevel
	}

	// Configure logging for production
	if cfg.Environment == "production" {
		// Production: JSON format, UTC time, structured logging with sampling
		zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
		zerolog.SetGlobalLevel(level)

		// Add log sampling to reduce noise in production
		sampledLogger := zerolog.New(os.Stdout).
			Level(level).
			With().
			Timestamp().
			Str("service", "analytics").
			Str("version", "1.0.0").
			Logger().
			Sample(&zerolog.BasicSampler{N: 100}) // Sample 1 in 100 logs for high-volume operations

		return sampledLogger
	} else {
		// Development: Pretty console output
		zerolog.TimeFieldFormat = time.RFC3339
		zerolog.SetGlobalLevel(level)

		return zerolog.New(zerolog.ConsoleWriter{
			Out:        os.Stdout,
			TimeFormat: time.RFC3339,
		}).
			Level(level).
			With().
			Timestamp().
			Str("service", "analytics").
			Str("version", "1.0.0").
			Logger()
	}
}

func setupRouter(
	cfg *config.Config,
	eventService *services.EventService,
	eventHandler *handlers.EventHandler,
	analyticsHandler *handlers.AnalyticsHandler,
	privacyHandler *handlers.PrivacyHandler,
	healthHandler *handlers.HealthHandler,
	adminHandler *handlers.AdminHandler,
	logger zerolog.Logger,
) *gin.Engine {
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Middleware
	router.Use(middleware.Logger(logger))
	router.Use(middleware.Recovery(logger))
	router.Use(middleware.ClientIPMiddleware()) // Add client IP middleware for geolocation

	// API Key validation for all routes (except health check)
	router.Use(func(c *gin.Context) {
		// Skip API key validation for health check
		if c.Request.URL.Path == "/health" {
			c.Next()
			return
		}
		// Apply Gin API key middleware to all other routes
		middleware.GinAPIKeyMiddleware()(c)
	})

	// Health check with buffer stats
	router.GET("/health", healthHandler.HealthCheck)

	// Initialize subscription middleware
	subscriptionMiddleware := middleware.NewSubscriptionMiddleware(logger)

	// Usage cache stats endpoint for monitoring
	router.GET("/usage-stats", func(c *gin.Context) {
		stats := subscriptionMiddleware.GetUsageCacheStats()
		c.JSON(200, gin.H{
			"success": true,
			"data":    stats,
		})
	})

	// API routes
	v1 := router.Group("/api/v1")
	{
		// Analytics routes
		analytics := v1.Group("/analytics")
		{
			// Event tracking routes with usage limit enforcement
			analytics.POST("/event", subscriptionMiddleware.CheckEventLimit(), eventHandler.TrackEvent)
			analytics.POST("/event/batch", subscriptionMiddleware.CheckBatchEventLimit(), eventHandler.TrackBatchEvents)
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
		}

		// Privacy routes
		privacy := v1.Group("/privacy")
		{
			privacy.GET("/export/:user_id", privacyHandler.ExportUserAnalytics)
			privacy.DELETE("/delete/:user_id", privacyHandler.DeleteUserAnalytics)
			privacy.DELETE("/delete/website/:website_id", privacyHandler.DeleteWebsiteAnalytics)
			privacy.PUT("/anonymize/:user_id", privacyHandler.AnonymizeUserAnalytics)
			privacy.GET("/retention-policies", privacyHandler.GetDataRetentionPolicies)
			privacy.POST("/cleanup", privacyHandler.RunDataRetentionCleanup)
		}

		// Admin routes
		admin := v1.Group("/admin")
		{
			admin.GET("/analytics/stats", adminHandler.GetAnalyticsStats)
		}
	}

	return router
}
