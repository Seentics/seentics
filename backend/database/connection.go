package database

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect(databaseURL string) (*pgxpool.Pool, error) {
	// Use the optimized PostgreSQL connection function
	return ConnectPostgres(databaseURL)
}

func InitializeSchema(db *pgxpool.Pool) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Read schema file
	schemaPath := filepath.Join("database", "schema.sql")
	schemaBytes, err := os.ReadFile(schemaPath)
	if err != nil {
		return fmt.Errorf("failed to read schema file: %w", err)
	}

	// Execute schema
	_, err = db.Exec(ctx, string(schemaBytes))
	if err != nil {
		return fmt.Errorf("failed to execute schema: %w", err)
	}

	return nil
}
