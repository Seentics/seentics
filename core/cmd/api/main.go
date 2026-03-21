package main

import (
	"context"
	"crypto/subtle"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"

	ginGzip "github.com/gin-contrib/gzip"

	// Shared infrastructure
	"github.com/Seentics/seentics/internal/shared/cache"
	"github.com/Seentics/seentics/internal/shared/config"
	"github.com/Seentics/seentics/internal/shared/database"
	"github.com/Seentics/seentics/internal/shared/middleware"
	"github.com/Seentics/seentics/internal/shared/migrations"
	"github.com/Seentics/seentics/internal/shared/utils"

	// Analytics module
	"github.com/Seentics/seentics/internal/modules/analytics/handlers"
	"github.com/Seentics/seentics/internal/modules/analytics/repository"
	"github.com/Seentics/seentics/internal/modules/analytics/repository/privacy"
	"github.com/Seentics/seentics/internal/modules/analytics/services"

	// Auth module
	authHandlerPkg "github.com/Seentics/seentics/internal/modules/auth/handlers"
	authRepoPkg "github.com/Seentics/seentics/internal/modules/auth/repository"
	authServicePkg "github.com/Seentics/seentics/internal/modules/auth/services"

	// Funnels module
	funnelHandlerPkg "github.com/Seentics/seentics/internal/modules/funnels/handlers"
	funnelRepoPkg "github.com/Seentics/seentics/internal/modules/funnels/repository"
	funnelServicePkg "github.com/Seentics/seentics/internal/modules/funnels/services"

	// Websites module
	websiteHandlerPkg "github.com/Seentics/seentics/internal/modules/websites/handlers"
	websiteRepoPkg "github.com/Seentics/seentics/internal/modules/websites/repository"
	websiteServicePkg "github.com/Seentics/seentics/internal/modules/websites/services"

	// Tracker module
	trackerPkg "github.com/Seentics/seentics/internal/modules/tracker"
)

// appHandlers bundles all HTTP handlers so setupRouter doesn't need 15 parameters.
type appHandlers struct {
	analytics *handlers.AnalyticsHandler
	privacy   *handlers.PrivacyHandler
	health    *handlers.HealthHandler
	admin     *handlers.AdminHandler
	internal  *handlers.InternalHandler
	auth      *authHandlerPkg.AuthHandler
	funnel    *funnelHandlerPkg.FunnelHandler
	website   *websiteHandlerPkg.WebsiteHandler
	tracker   *trackerPkg.TrackerHandler
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal("Failed to load configuration:", err)
	}

	logger := setupLogger(cfg)

	// ── Infrastructure ──────────────────────────────────────────────────────

	db, err := database.Connect(cfg.DatabaseURL, cfg.DbMaxConns, cfg.DbMinConns)
	if err != nil {
		logger.Fatal().Err(err).Msg("Failed to connect to database")
	}
	defer db.Close()

	chConn, err := database.ConnectClickHouse(cfg.ClickHouseHost, cfg.ClickHousePort, cfg.ClickHouseUser, cfg.ClickHousePassword, cfg.ClickHouseDB)
	if err != nil {
		logger.Fatal().Err(err).Msg("Failed to connect to ClickHouse")
	}
	defer chConn.Close()

	migrator := migrations.NewMigrator(db, logger)
	if err := migrator.RunMigrations(context.Background()); err != nil {
		logger.Fatal().Err(err).Msg("Failed to run database migrations")
	}

	rdb := initRedis(cfg, logger)
	defer rdb.Close()

	appCache := cache.NewWithClient(rdb, "sn:")
	defer appCache.Shutdown()
	logger.Info().Msg("Cache initialized (Redis)")

	utils.InitGlobalGeolocationService(appCache)

	ctx := context.Background()

	// ── Repositories ────────────────────────────────────────────────────────

	chRepo := repository.NewClickHouseEventRepository(chConn, logger)
	if err := chRepo.CreateSchema(ctx); err != nil {
		logger.Fatal().Err(err).Msg("Failed to create ClickHouse schema")
	}
	logger.Info().Msg("ClickHouse schema verified/created")

	var eventRepo repository.EventRepository = chRepo
	pgAnalyticsRepo := repository.NewPostgresAnalyticsRepository(db)
	var analyticsRepo repository.MainAnalyticsRepository = repository.NewClickHouseAnalyticsRepository(chConn, pgAnalyticsRepo, logger)

	authRepo := authRepoPkg.NewAuthRepository(db)
	websiteRepo := websiteRepoPkg.NewWebsiteRepository(db)
	funnelRepo := funnelRepoPkg.NewFunnelRepository(db, chConn)
	privacyRepo := privacy.NewPrivacyRepository(db)

	// ── Services ────────────────────────────────────────────────────────────

	websiteService := websiteServicePkg.NewWebsiteService(
		websiteRepo, authRepo, analyticsRepo, eventRepo,
		funnelRepo, appCache,
		cfg.Environment, logger,
	)

	authService := authServicePkg.NewAuthService(authRepo, cfg, logger)

	eventService := services.NewEventService(eventRepo, db, websiteService, logger, rdb)
	analyticsService := services.NewAnalyticsService(analyticsRepo, websiteService, logger, appCache)
	privacyService := services.NewPrivacyService(privacyRepo, websiteService, logger)
	funnelService := funnelServicePkg.NewFunnelService(funnelRepo, websiteService)

	// Start background workers (analytics only — heatmaps/replays moved to standalone apps)
	analyticsService.StartCacheWarmer(ctx)

	// ── Handlers ────────────────────────────────────────────────────────────

	h := appHandlers{
		analytics: handlers.NewAnalyticsHandler(analyticsService, logger),
		privacy:   handlers.NewPrivacyHandler(privacyService, logger),
		health:    handlers.NewHealthHandler(db, logger),
		admin:     handlers.NewAdminHandler(eventRepo, logger),
		internal:  handlers.NewInternalHandler(db, logger),
		auth:      authHandlerPkg.NewAuthHandler(authService, logger),
		funnel:    funnelHandlerPkg.NewFunnelHandler(funnelService),
		website:   websiteHandlerPkg.NewWebsiteHandler(websiteService, logger),
		tracker:   trackerPkg.NewTrackerHandler(websiteService, eventService, funnelService, logger),
	}
	h.internal.SetClickHouse(chConn)

	// ── HTTP Server ─────────────────────────────────────────────────────────

	router := setupRouter(cfg, appCache, h, logger)

	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 180 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		logger.Info().Str("port", cfg.Port).Msg("Server starting")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal().Err(err).Msg("Server failed to start")
		}
	}()

	// ── Graceful Shutdown ───────────────────────────────────────────────────

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info().Msg("Server shutting down...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()

	if err := eventService.Shutdown(10 * time.Second); err != nil {
		logger.Error().Err(err).Msg("Failed to shutdown event service gracefully")
	}
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error().Err(err).Msg("Server forced to shutdown")
	} else {
		logger.Info().Msg("Server shutdown completed")
	}
}

// ── Infrastructure Helpers ──────────────────────────────────────────────────

func initRedis(cfg *config.Config, logger zerolog.Logger) *redis.Client {
	redisOpts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		logger.Fatal().Err(err).Str("redis_url", cfg.RedisURL).Msg("Invalid Redis URL")
	}
	rdb := redis.NewClient(redisOpts)
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		logger.Fatal().Err(err).Msg("Failed to connect to Redis")
	}
	logger.Info().Str("redis_url", cfg.RedisURL).Msg("Redis connected")
	return rdb
}

// ── Router ──────────────────────────────────────────────────────────────────

func setupRouter(cfg *config.Config, appCache *cache.Cache, h appHandlers, logger zerolog.Logger) *gin.Engine {
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Global middleware
	router.Use(ginGzip.Gzip(ginGzip.DefaultCompression))
	router.Use(middleware.RequestSizeLimitMiddleware(10 * 1024 * 1024)) // 10 MB
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
			strings.HasPrefix(path, "/api/v1/internal/") ||
			strings.HasPrefix(path, "/api/v1/analytics/public/") {
			c.Next()
			return
		}
		middleware.UnifiedAuthMiddleware(cfg)(c)
	})

	// Rate limiting (after auth so it can identify users)
	router.Use(middleware.RateLimitMiddleware(appCache))

	// ── Routes ──────────────────────────────────────────────────────────────

	router.GET("/health", h.health.HealthCheck)

	v1 := router.Group("/api/v1")
	{
		registerAuthRoutes(v1, h)
		registerTrackerRoutes(v1, h)
		registerAnalyticsRoutes(v1, h)
		registerPrivacyRoutes(v1, h)
		registerWebsiteRoutes(v1, h)
		registerFunnelRoutes(v1, h)
		registerAdminRoutes(v1, h)
		registerInternalRoutes(v1, h)
	}

	return router
}

// ── Route Registration ──────────────────────────────────────────────────────

func registerAuthRoutes(v1 *gin.RouterGroup, h appHandlers) {
	// Public auth (no authentication required)
	publicAuth := v1.Group("/auth")
	{
		publicAuth.POST("/register", h.auth.Register)
		publicAuth.POST("/login", h.auth.Login)
		publicAuth.POST("/refresh", h.auth.RefreshToken)
		publicAuth.POST("/forgot-password", h.auth.ForgotPassword)
		publicAuth.POST("/reset-password", h.auth.ResetPassword)
	}

	// Enterprise auth
	auth := v1.Group("/user/auth")
	{
		auth.POST("/register", h.auth.Register)
		auth.POST("/login", h.auth.Login)
		auth.POST("/refresh", h.auth.RefreshToken)
		auth.GET("/setup-status", h.auth.SetupStatus)
	}

	// User profile
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

		// Public dashboard (no auth required — handled by auth bypass middleware)
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

		// Goals
		websites.GET("/:id/goals", h.website.ListGoals)
		websites.POST("/:id/goals", h.website.CreateGoal)
		websites.DELETE("/:id/goals/:goal_id", h.website.DeleteGoal)

		// Team members & permissions
		websites.GET("/:id/my-role", h.website.GetMyRole)
		websites.GET("/:id/members", h.website.ListMembers)
		websites.POST("/:id/members", h.website.AddMember)
		websites.DELETE("/:id/members/:user_id", h.website.RemoveMember)
		websites.PUT("/:id/members/:user_id/role", h.website.UpdateMemberRole)

		// Token-based invitations
		websites.POST("/:id/invitations", h.website.InviteMemberByToken)
		websites.GET("/:id/invitations", h.website.ListPendingInvitations)
		websites.DELETE("/:id/invitations/:invitation_id", h.website.RevokeInvitation)

		// Public sharing
		websites.POST("/:id/share", h.website.TogglePublicShare)
	}

	// Accept invite (outside /:id group to avoid param conflict)
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

// ── Logger ──────────────────────────────────────────────────────────────────

func setupLogger(cfg *config.Config) zerolog.Logger {
	level, err := zerolog.ParseLevel(cfg.LogLevel)
	if err != nil {
		level = zerolog.InfoLevel
	}
	zerolog.SetGlobalLevel(level)

	base := zerolog.New(os.Stdout).Level(level).With().Timestamp().
		Str("service", "analytics").Str("version", "1.0.0")

	if cfg.Environment == "production" {
		zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
		return base.Logger()
	}

	zerolog.TimeFieldFormat = time.RFC3339
	return zerolog.New(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339}).
		Level(level).With().Timestamp().
		Str("service", "analytics").Str("version", "1.0.0").Logger()
}
