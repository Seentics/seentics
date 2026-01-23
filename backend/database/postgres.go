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
		MaxConns:        100,                  // High concurrency for analytics
		MinConns:        25,                   // Good warmup pool
		MaxConnLifetime: 2 * time.Hour,       // Longer for stable connections
		MaxConnIdleTime: 15 * time.Minute,    // Reasonable idle timeout
	}
}

// ConnectPostgres creates a connection pool optimized for PostgreSQL
func ConnectPostgres(databaseURL string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database URL: %w", err)
	}

	// Apply optimized connection pool settings for high-throughput analytics
	pgConfig := DefaultPostgresConfig()
	config.MaxConns = pgConfig.MaxConns
	config.MinConns = pgConfig.MinConns
	config.MaxConnLifetime = pgConfig.MaxConnLifetime
	config.MaxConnIdleTime = pgConfig.MaxConnIdleTime
	config.HealthCheckPeriod = 1 * time.Minute

	// PostgreSQL-specific connection parameters
	config.ConnConfig.Config.RuntimeParams["timezone"] = "UTC"
	config.ConnConfig.Config.RuntimeParams["application_name"] = "analytics-app"

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

	fmt.Printf("PostgreSQL version: %s\n", version)
	
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
			fmt.Printf("Warning: Could not create uuid-ossp extension, using gen_random_uuid() instead: %v\n", err)
		}
	}

	return nil
}

// CreatePartition creates a new partition for the events table
func CreatePartition(ctx context.Context, pool *pgxpool.Pool, tableName, partitionName, startDate, endDate string) error {
	query := fmt.Sprintf(
		"CREATE TABLE IF NOT EXISTS %s PARTITION OF %s FOR VALUES FROM ('%s') TO ('%s')",
		partitionName, tableName, startDate, endDate,
	)
	_, err := pool.Exec(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to create partition %s: %w", partitionName, err)
	}
	return nil
}

// SetupMonthlyPartitions creates monthly partitions for the events table for the next 12 months
func SetupMonthlyPartitions(ctx context.Context, pool *pgxpool.Pool) error {
	now := time.Now()
	
	for i := 0; i < 12; i++ {
		month := now.AddDate(0, i, 0)
		nextMonth := month.AddDate(0, 1, 0)
		
		partitionName := fmt.Sprintf("events_y%dm%02d", month.Year(), month.Month())
		startDate := month.Format("2006-01-02")
		endDate := nextMonth.Format("2006-01-02")
		
		if err := CreatePartition(ctx, pool, "events", partitionName, startDate, endDate); err != nil {
			return fmt.Errorf("failed to create partition for %s: %w", month.Format("2006-01"), err)
		}
	}
	
	return nil
}

// DropOldPartitions removes partitions older than the specified retention period
func DropOldPartitions(ctx context.Context, pool *pgxpool.Pool, retentionMonths int) error {
	cutoffDate := time.Now().AddDate(0, -retentionMonths, 0)
	
	// Query to find old partitions
	query := `
		SELECT schemaname, tablename 
		FROM pg_tables 
		WHERE tablename LIKE 'events_y%m%' 
		AND schemaname = 'public'
	`
	
	rows, err := pool.Query(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to query partitions: %w", err)
	}
	defer rows.Close()
	
	for rows.Next() {
		var schema, tableName string
		if err := rows.Scan(&schema, &tableName); err != nil {
			continue
		}
		
		// Parse partition date from table name (events_y2024m01 format)
		var year, month int
		if n, _ := fmt.Sscanf(tableName, "events_y%dm%d", &year, &month); n == 2 {
			partitionDate := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
			
			if partitionDate.Before(cutoffDate) {
				dropQuery := fmt.Sprintf("DROP TABLE IF EXISTS %s", tableName)
				if _, err := pool.Exec(ctx, dropQuery); err != nil {
					fmt.Printf("Warning: failed to drop old partition %s: %v\n", tableName, err)
				} else {
					fmt.Printf("Dropped old partition: %s\n", tableName)
				}
			}
		}
	}
	
	return nil
}
