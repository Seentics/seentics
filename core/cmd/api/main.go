package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"

	// Shared infrastructure
	"github.com/Seentics/seentics/internal/shared/cache"
	"github.com/Seentics/seentics/internal/shared/config"
	"github.com/Seentics/seentics/internal/shared/database"
	"github.com/Seentics/seentics/internal/shared/migrations"
	"github.com/Seentics/seentics/internal/shared/storage"
	"github.com/Seentics/seentics/internal/shared/utils"

	// Analytics module
	"github.com/Seentics/seentics/internal/modules/analytics/handlers"
	"github.com/Seentics/seentics/internal/modules/analytics/repository"
	"github.com/Seentics/seentics/internal/modules/analytics/repository/privacy"
	"github.com/Seentics/seentics/internal/modules/analytics/services"

	// Auth module
	authHandlerPkg "github.com/Seentics/seentics/internal/modules/auth/handlers"
	authRepoPkg    "github.com/Seentics/seentics/internal/modules/auth/repository"
	authServicePkg "github.com/Seentics/seentics/internal/modules/auth/services"

	// Funnels module
	funnelHandlerPkg  "github.com/Seentics/seentics/internal/modules/funnels/handlers"
	funnelRepoPkg     "github.com/Seentics/seentics/internal/modules/funnels/repository"
	funnelServicePkg  "github.com/Seentics/seentics/internal/modules/funnels/services"

	// Heatmaps module
	heatmapHandlerPkg  "github.com/Seentics/seentics/internal/modules/heatmaps/handlers"
	heatmapRepoPkg     "github.com/Seentics/seentics/internal/modules/heatmaps/repository"
	heatmapServicePkg  "github.com/Seentics/seentics/internal/modules/heatmaps/services"

	// Replays module
	replayHandlerPkg  "github.com/Seentics/seentics/internal/modules/replays/handlers"
	replayRepoPkg     "github.com/Seentics/seentics/internal/modules/replays/repository"
	replayServicePkg  "github.com/Seentics/seentics/internal/modules/replays/services"

	// Automations module
	automationHandlerPkg  "github.com/Seentics/seentics/internal/modules/automations/handlers"
	automationRepoPkg     "github.com/Seentics/seentics/internal/modules/automations/repository"
	automationServicePkg  "github.com/Seentics/seentics/internal/modules/automations/services"

	// Websites module
	websiteHandlerPkg "github.com/Seentics/seentics/internal/modules/websites/handlers"
	websiteRepoPkg    "github.com/Seentics/seentics/internal/modules/websites/repository"
	websiteServicePkg "github.com/Seentics/seentics/internal/modules/websites/services"

	// API Keys module
	apikeysPkg "github.com/Seentics/seentics/internal/modules/apikeys"

	// Tracker module
	trackerPkg "github.com/Seentics/seentics/internal/modules/tracker"
)

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

	s3cfg := cfg.S3()
	s3Client, err := storage.NewS3Client(s3cfg.Endpoint, s3cfg.AccessKey, s3cfg.SecretKey, s3cfg.Bucket, s3cfg.Region, s3cfg.UseSSL, s3cfg.PublicEndpoint)
	if err != nil {
		logger.Fatal().Err(err).Msg("Failed to connect to MinIO/S3")
	}
	logger.Info().Str("endpoint", s3cfg.Endpoint).Str("bucket", s3cfg.Bucket).Msg("S3/MinIO connected")

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

	authRepo         := authRepoPkg.NewAuthRepository(db)
	websiteRepo      := websiteRepoPkg.NewWebsiteRepository(db)
	funnelRepo       := funnelRepoPkg.NewFunnelRepository(db, chConn)
	privacyRepo      := privacy.NewPrivacyRepository(db)
	heatmapRepo      := heatmapRepoPkg.NewHeatmapRepository(db)
	replayRepo       := replayRepoPkg.New(db, s3Client, logger)
	automationRepo   := automationRepoPkg.NewAutomationRepository(db)

	// ── Services ────────────────────────────────────────────────────────────

	websiteService := websiteServicePkg.NewWebsiteService(
		websiteRepo, authRepo, analyticsRepo, eventRepo,
		funnelRepo, appCache,
		cfg.Environment, logger,
	)

	authService       := authServicePkg.NewAuthService(authRepo, cfg, logger)
	eventService      := services.NewEventService(eventRepo, websiteService, logger, rdb)
	analyticsService  := services.NewAnalyticsService(analyticsRepo, websiteService, logger, appCache)
	privacyService    := services.NewPrivacyService(privacyRepo, websiteService, logger)
	funnelService     := funnelServicePkg.NewFunnelService(funnelRepo, websiteService, appCache)
	heatmapService    := heatmapServicePkg.NewHeatmapService(heatmapRepo, logger)
	replayService     := replayServicePkg.NewReplayService(replayRepo, websiteRepo, logger, cfg)
	automationService := automationServicePkg.NewAutomationService(automationRepo, appCache, logger)
	apiKeyService     := apikeysPkg.NewService(db, appCache, logger)

	// ── Handlers ────────────────────────────────────────────────────────────

	h := appHandlers{
		analytics:  handlers.NewAnalyticsHandler(analyticsService, logger),
		privacy:    handlers.NewPrivacyHandler(privacyService, logger),
		health:     handlers.NewHealthHandler(db, logger),
		admin:      handlers.NewAdminHandler(eventRepo, logger),
		internal:   handlers.NewInternalHandler(db, logger),
		auth:       authHandlerPkg.NewAuthHandler(authService, logger),
		funnel:     funnelHandlerPkg.NewFunnelHandler(funnelService),
		website:    websiteHandlerPkg.NewWebsiteHandler(websiteService, logger),
		heatmap:    heatmapHandlerPkg.NewHeatmapHandler(heatmapService, websiteService, logger),
		replay:     replayHandlerPkg.NewReplayHandler(replayService, logger),
		automation: automationHandlerPkg.NewAutomationHandler(automationService, logger),
		tracker:    trackerPkg.NewTrackerHandler(websiteService, eventService, funnelService, heatmapService, replayService, automationService, logger),
	}
	h.internal.SetClickHouse(chConn)
	h.internal.SetReplayRepository(replayRepo)

	// ── HTTP Server ─────────────────────────────────────────────────────────

	router := setupRouter(cfg, appCache, apiKeyService, h, logger)

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
	flushCtx, flushCancel := context.WithTimeout(context.Background(), 2*time.Minute)
	replayService.Shutdown(flushCtx)
	flushCancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error().Err(err).Msg("Server forced to shutdown")
	} else {
		logger.Info().Msg("Server shutdown completed")
	}
}

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
