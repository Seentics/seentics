package migrations

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/rs/zerolog"
)

// postgresMigrationsDir must match the path in migrationsSourceURL (working directory = service root).
const migrationsSourceURL = "file://internal/shared/migrations"
const postgresMigrationsDir = "internal/shared/migrations"

// maxBundledMigrationVersion returns the highest NNNN prefix from NNNN_name.up.sql in dir.
func maxBundledMigrationVersion(dir string) (uint, error) {
	matches, err := filepath.Glob(filepath.Join(dir, "*.up.sql"))
	if err != nil {
		return 0, err
	}
	var maxV uint
	for _, path := range matches {
		base := filepath.Base(path)
		idx := strings.IndexByte(base, '_')
		if idx <= 0 {
			continue
		}
		n, err := strconv.ParseUint(base[:idx], 10, 64)
		if err != nil {
			continue
		}
		if uint(n) > maxV {
			maxV = uint(n)
		}
	}
	if maxV == 0 {
		return 0, fmt.Errorf("no *.up.sql migrations in %s", dir)
	}
	return maxV, nil
}

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
	m.logger.Debug().Msg("Creating postgres driver instance")
	driver, err := postgres.WithInstance(sqlDB, &postgres.Config{})
	if err != nil {
		return fmt.Errorf("failed to create postgres driver: %w", err)
	}

	// Create migrate instance
	m.logger.Debug().Msg("Creating migrate instance")
	migrator, err := migrate.NewWithDatabaseInstance(
		migrationsSourceURL,
		"postgres",
		driver,
	)
	if err != nil {
		return fmt.Errorf("failed to create migrate instance: %w", err)
	}
	m.logger.Debug().Msg("Migrate instance created")
	defer migrator.Close()

	bundledMax, err := maxBundledMigrationVersion(postgresMigrationsDir)
	if err != nil {
		return fmt.Errorf("migrations: list bundled versions: %w", err)
	}

	// Get current version
	version, dirty, err := migrator.Version()
	if err != nil && !errors.Is(err, migrate.ErrNilVersion) {
		return fmt.Errorf("failed to get current migration version: %w", err)
	}

	// After a migration squash, the DB can still record an old high version (e.g. 30) while
	// the tree only ships 0001_baseline.up.sql. go-migrate then errors trying to resolve that
	// version. Align the recorded version to the latest bundled file without running SQL.
	if err == nil && version > bundledMax {
		m.logger.Warn().
			Uint("database_version", version).
			Uint("bundled_max_version", bundledMax).
			Msg("Database migration version is ahead of bundled files (squash or old volume); forcing to bundled max")
		if err := migrator.Force(int(bundledMax)); err != nil {
			return fmt.Errorf("failed to force migration version after squash mismatch: %w", err)
		}
		version, dirty, err = migrator.Version()
		if err != nil {
			return fmt.Errorf("failed to re-read migration version after force: %w", err)
		}
	}

	if dirty {
		// Force to previous version so the failed migration is retried on next Up()
		prev := int(version) - 1
		m.logger.Warn().Uint("version", version).Int("force_to", prev).Msg("Database is in dirty state, forcing to previous version to retry")
		if err := migrator.Force(prev); err != nil {
			return fmt.Errorf("failed to force version %d: %w", prev, err)
		}
	}

	if errors.Is(err, migrate.ErrNilVersion) {
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
