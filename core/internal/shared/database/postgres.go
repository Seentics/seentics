package database

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresConfig holds PostgreSQL-specific configuration
type PostgresConfig struct {
	MaxConns        int32
	MinConns        int32
	MaxConnLifetime time.Duration
	MaxConnIdleTime time.Duration
}

// DefaultPostgresConfig returns sensible defaults for PostgreSQL
func DefaultPostgresConfig() *PostgresConfig {
	return &PostgresConfig{
		MaxConns:        100,              // High concurrency for analytics
		MinConns:        25,               // Good warmup pool
		MaxConnLifetime: 2 * time.Hour,    // Longer for stable connections
		MaxConnIdleTime: 15 * time.Minute, // Reasonable idle timeout
	}
}

// ConnectPostgres creates a connection pool optimized for PostgreSQL
func ConnectPostgres(databaseURL string, maxConns, minConns int) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database URL: %w", err)
	}

	// Apply optimized connection pool settings for high-throughput analytics
	pgConfig := DefaultPostgresConfig()
	config.MaxConns = int32(maxConns)
	config.MinConns = int32(minConns)
	config.MaxConnLifetime = pgConfig.MaxConnLifetime
	config.MaxConnIdleTime = pgConfig.MaxConnIdleTime
	config.HealthCheckPeriod = 1 * time.Minute

	// PostgreSQL-specific connection parameters
	config.ConnConfig.Config.RuntimeParams["timezone"] = "UTC"
	config.ConnConfig.Config.RuntimeParams["application_name"] = "github.com/Seentics/seentics"

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	// Test connection and verify PostgreSQL
	if err := verifyPostgreSQL(ctx, pool); err != nil {
		pool.Close()
		return nil, err
	}

	return pool, nil
}

// verifyPostgreSQL checks if PostgreSQL is available and configured properly
func verifyPostgreSQL(ctx context.Context, pool *pgxpool.Pool) error {
	// Test basic connection
	if err := pool.Ping(ctx); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	// Check PostgreSQL version
	var version string
	err := pool.QueryRow(ctx, "SELECT version()").Scan(&version)
	if err != nil {
		return fmt.Errorf("failed to get PostgreSQL version: %w", err)
	}

	// Check if UUID extension is available (required for our schema)
	var hasUuidExtension bool
	query := "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') OR EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'gen_random_uuid')"
	err = pool.QueryRow(ctx, query).Scan(&hasUuidExtension)
	if err != nil {
		return fmt.Errorf("failed to check UUID extension: %w", err)
	}

	if !hasUuidExtension {
		// Try to create the extension if it doesn't exist
		_, err = pool.Exec(ctx, "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")
		if err != nil {
		}
	}

	return nil
}
