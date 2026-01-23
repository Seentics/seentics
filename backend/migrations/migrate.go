package migrations

import (
	"context"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/rs/zerolog"
)

// Migrator handles database migrations using go-migrate
type Migrator struct {
	db     *pgxpool.Pool
	logger zerolog.Logger
}

// NewMigrator creates a new migrator instance
func NewMigrator(db *pgxpool.Pool, logger zerolog.Logger) *Migrator {
	return &Migrator{
		db:     db,
		logger: logger,
	}
}

// RunMigrations executes all pending migrations using go-migrate
func (m *Migrator) RunMigrations(ctx context.Context) error {
	m.logger.Info().Msg("Starting database migrations")

	// Convert pgxpool to sql.DB for go-migrate compatibility
	sqlDB := stdlib.OpenDB(*m.db.Config().ConnConfig)
	defer sqlDB.Close()

	// Create postgres driver instance
	driver, err := postgres.WithInstance(sqlDB, &postgres.Config{})
	if err != nil {
		return fmt.Errorf("failed to create postgres driver: %w", err)
	}

	// Create migrate instance
	migrator, err := migrate.NewWithDatabaseInstance(
		"file://migrations",
		"postgres",
		driver,
	)
	if err != nil {
		return fmt.Errorf("failed to create migrate instance: %w", err)
	}
	defer migrator.Close()

	// Get current version
	version, dirty, err := migrator.Version()
	if err != nil && err != migrate.ErrNilVersion {
		return fmt.Errorf("failed to get current migration version: %w", err)
	}

	if dirty {
		m.logger.Warn().Uint("version", version).Msg("Database is in dirty state, forcing version")
		if err := migrator.Force(int(version)); err != nil {
			return fmt.Errorf("failed to force version %d: %w", version, err)
		}
	}

	if err == migrate.ErrNilVersion {
		m.logger.Info().Msg("No migrations applied yet")
	} else {
		m.logger.Info().Uint("version", version).Msg("Current migration version")
	}

	// Run migrations
	err = migrator.Up()
	if err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	if err == migrate.ErrNoChange {
		m.logger.Info().Msg("No pending migrations")
	} else {
		// Get new version
		newVersion, _, err := migrator.Version()
		if err != nil {
			return fmt.Errorf("failed to get new migration version: %w", err)
		}
		m.logger.Info().Uint("version", newVersion).Msg("Successfully applied migrations")
	}

	return nil
}
