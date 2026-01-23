package utils

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgreSQLHelper provides utility functions for PostgreSQL operations
type PostgreSQLHelper struct {
	db *pgxpool.Pool
}

func NewPostgreSQLHelper(db *pgxpool.Pool) *PostgreSQLHelper {
	return &PostgreSQLHelper{db: db}
}

// GetTableStats returns statistics about tables
func (h *PostgreSQLHelper) GetTableStats(ctx context.Context, tableName string) (map[string]interface{}, error) {
	query := `
		SELECT 
			schemaname,
			tablename,
			attname,
			n_distinct,
			correlation,
			most_common_vals,
			most_common_freqs
		FROM pg_stats 
		WHERE tablename = $1
		ORDER BY attname`

	rows, err := h.db.Query(ctx, query, tableName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stats := make(map[string]interface{})
	var columns []map[string]interface{}

	for rows.Next() {
		var schemaName, tableName, attName string
		var nDistinct *float64
		var correlation *float64
		var mostCommonVals, mostCommonFreqs *string

		err := rows.Scan(&schemaName, &tableName, &attName, &nDistinct, &correlation, &mostCommonVals, &mostCommonFreqs)
		if err != nil {
			return nil, err
		}

		columns = append(columns, map[string]interface{}{
			"column_name":       attName,
			"n_distinct":        nDistinct,
			"correlation":       correlation,
			"most_common_vals":  mostCommonVals,
			"most_common_freqs": mostCommonFreqs,
		})
	}

	stats["schema"] = "public"
	stats["table"] = tableName
	stats["columns"] = columns

	return stats, rows.Err()
}

// GetPartitionInfo returns information about table partitions
func (h *PostgreSQLHelper) GetPartitionInfo(ctx context.Context, tableName string) ([]map[string]interface{}, error) {
	query := `
		SELECT 
			schemaname,
			tablename,
			pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
			pg_stat_get_tuples_inserted(c.oid) as inserts,
			pg_stat_get_tuples_updated(c.oid) as updates,
			pg_stat_get_tuples_deleted(c.oid) as deletes
		FROM pg_tables t
		JOIN pg_class c ON c.relname = t.tablename
		WHERE t.tablename LIKE $1 || '%'
		AND t.schemaname = 'public'
		ORDER BY t.tablename`

	rows, err := h.db.Query(ctx, query, tableName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var partitions []map[string]interface{}
	for rows.Next() {
		var schemaName, tableName, size string
		var inserts, updates, deletes *int64

		err := rows.Scan(&schemaName, &tableName, &size, &inserts, &updates, &deletes)
		if err != nil {
			return nil, err
		}

		partitions = append(partitions, map[string]interface{}{
			"schema_name": schemaName,
			"table_name":  tableName,
			"size":        size,
			"inserts":     inserts,
			"updates":     updates,
			"deletes":     deletes,
		})
	}

	return partitions, rows.Err()
}

// OptimizeQueries runs PostgreSQL-specific query optimizations
func (h *PostgreSQLHelper) OptimizeQueries(ctx context.Context) error {
	// Update table statistics for better query planning
	optimizations := []string{
		"ANALYZE events",
		"ANALYZE custom_events_aggregated",
		"ANALYZE privacy_requests",
	}

	for _, query := range optimizations {
		_, err := h.db.Exec(ctx, query)
		if err != nil {
			return fmt.Errorf("failed to run optimization: %s, error: %w", query, err)
		}
	}

	return nil
}

// GetPostgreSQLInfo returns general information about the PostgreSQL instance
func (h *PostgreSQLHelper) GetPostgreSQLInfo(ctx context.Context) (map[string]interface{}, error) {
	info := make(map[string]interface{})

	// Get PostgreSQL version
	var version string
	err := h.db.QueryRow(ctx, "SELECT version()").Scan(&version)
	if err == nil {
		info["version"] = version
	}

	// Get total number of tables
	var tableCount int
	err = h.db.QueryRow(ctx, "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public'").Scan(&tableCount)
	if err == nil {
		info["table_count"] = tableCount
	}

	// Get database size
	var dbSize string
	err = h.db.QueryRow(ctx, "SELECT pg_size_pretty(pg_database_size(current_database()))").Scan(&dbSize)
	if err == nil {
		info["database_size"] = dbSize
	}

	// Get connection count
	var connectionCount int
	err = h.db.QueryRow(ctx, "SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active'").Scan(&connectionCount)
	if err == nil {
		info["active_connections"] = connectionCount
	}

	// Get uptime
	var uptime string
	err = h.db.QueryRow(ctx, "SELECT date_trunc('second', now() - pg_postmaster_start_time())").Scan(&uptime)
	if err == nil {
		info["uptime"] = uptime
	}

	return info, nil
}

// CreateMaterializedView creates a materialized view for analytics aggregation
func (h *PostgreSQLHelper) CreateMaterializedView(ctx context.Context, name, query string) error {
	createSQL := fmt.Sprintf(`
		CREATE MATERIALIZED VIEW IF NOT EXISTS %s AS
		%s`, name, query)

	_, err := h.db.Exec(ctx, createSQL)
	if err != nil {
		return fmt.Errorf("failed to create materialized view %s: %w", name, err)
	}

	return nil
}

// RefreshMaterializedView refreshes a materialized view
func (h *PostgreSQLHelper) RefreshMaterializedView(ctx context.Context, name string) error {
	refreshSQL := fmt.Sprintf("REFRESH MATERIALIZED VIEW %s", name)

	_, err := h.db.Exec(ctx, refreshSQL)
	if err != nil {
		return fmt.Errorf("failed to refresh materialized view %s: %w", name, err)
	}

	return nil
}

// SetupPerformanceOptimizations applies PostgreSQL performance optimizations
func (h *PostgreSQLHelper) SetupPerformanceOptimizations(ctx context.Context) error {
	optimizations := []string{
		// Enable parallel query execution
		"SET max_parallel_workers_per_gather = 4",
		"SET max_parallel_workers = 8",

		// Optimize for analytics workloads
		"SET random_page_cost = 1.1",
		"SET effective_cache_size = '1GB'",
		"SET shared_buffers = '256MB'",
		"SET work_mem = '64MB'",

		// Enable query plan caching
		"SET plan_cache_mode = 'auto'",
	}

	for _, query := range optimizations {
		_, err := h.db.Exec(ctx, query)
		if err != nil {
			// Log warning but don't fail - some settings might not be changeable
			fmt.Printf("Warning: failed to apply optimization: %s, error: %v\n", query, err)
		}
	}

	return nil
}

// CreateIndexes creates additional performance indexes
func (h *PostgreSQLHelper) CreateIndexes(ctx context.Context) error {
	indexes := []string{
		// Time-based indexes for faster range queries
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_timestamp_hour ON events (date_trunc('hour', timestamp))",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_timestamp_day ON events (date_trunc('day', timestamp))",

		// Composite indexes for common query patterns
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_website_event_type_timestamp ON events (website_id, event_type, timestamp DESC)",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_visitor_timestamp ON events (visitor_id, timestamp DESC)",

		// GIN indexes for JSONB properties
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_properties_gin ON events USING GIN (properties)",
	}

	for _, indexSQL := range indexes {
		_, err := h.db.Exec(ctx, indexSQL)
		if err != nil {
			fmt.Printf("Warning: failed to create index: %s, error: %v\n", indexSQL, err)
		}
	}

	return nil
}

// SchedulePartitionMaintenance sets up automatic partition maintenance
func (h *PostgreSQLHelper) SchedulePartitionMaintenance(ctx context.Context) error {
	// Create a function to automatically create future partitions
	createFunctionSQL := `
		CREATE OR REPLACE FUNCTION create_monthly_partitions()
		RETURNS void AS $$
		DECLARE
			start_date date;
			end_date date;
			partition_name text;
		BEGIN
			-- Create partitions for the next 3 months
			FOR i IN 0..2 LOOP
				start_date := date_trunc('month', CURRENT_DATE + interval '1 month' * i);
				end_date := start_date + interval '1 month';
				partition_name := 'events_y' || extract(year from start_date) || 'm' || 
								 lpad(extract(month from start_date)::text, 2, '0');
				
				EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF events FOR VALUES FROM (%L) TO (%L)',
							  partition_name, start_date, end_date);
			END LOOP;
		END;
		$$ LANGUAGE plpgsql;
	`

	_, err := h.db.Exec(ctx, createFunctionSQL)
	if err != nil {
		return fmt.Errorf("failed to create partition maintenance function: %w", err)
	}

	return nil
}
