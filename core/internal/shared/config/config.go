package config

import (
	"errors"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Environment           string
	Port                  string
	DatabaseURL           string
	LogLevel              string
	KafkaBootstrapServers string
	KafkaTopicEvents      string
	JWTSecret             string
	GlobalAPIKey          string
	DbMaxConns            int
	DbMinConns            int
	CORSAllowedOrigins    string
	PostalServerURL       string
	PostalAPIKey          string
	PostalFromEmail       string
	PostalFromName        string
	ClickHouseHost        string
	ClickHousePort        int
	ClickHouseUser        string
	ClickHousePassword    string
	ClickHouseDB          string
}

func Load() (*Config, error) {
	// Load .env file if it exists
	_ = godotenv.Load()

	cfg := &Config{
		Environment:           getEnvOrDefault("ENVIRONMENT", "development"),
		Port:                  getEnvOrDefault("PORT", "3002"),
		DatabaseURL:           getEnvOrDefault("DATABASE_URL", ""),
		LogLevel:              getEnvOrDefault("LOG_LEVEL", "info"),
		KafkaBootstrapServers: getEnvOrDefault("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"),
		KafkaTopicEvents:      getEnvOrDefault("KAFKA_TOPIC_EVENTS", "analytics_events"),
		JWTSecret:             getEnvOrDefault("JWT_SECRET", ""),
		GlobalAPIKey:          getEnvOrDefault("GLOBAL_API_KEY", ""),
		DbMaxConns:            GetEnvAsInt("DB_MAX_CONNS", 100),
		DbMinConns:            GetEnvAsInt("DB_MIN_CONNS", 25),
		CORSAllowedOrigins:    getEnvOrDefault("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,https://www.seentics.com,https://seentics.com"),
		PostalServerURL:       getEnvOrDefault("POSTAL_SERVER_URL", ""),
		PostalAPIKey:          getEnvOrDefault("POSTAL_API_KEY", ""),
		PostalFromEmail:       getEnvOrDefault("POSTAL_FROM_EMAIL", ""),
		PostalFromName:        getEnvOrDefault("POSTAL_FROM_NAME", "Seentics Support"),
		ClickHouseHost:        getEnvOrDefault("CLICKHOUSE_HOST", "localhost"),
		ClickHousePort:        GetEnvAsInt("CLICKHOUSE_PORT", 9000),
		ClickHouseUser:        getEnvOrDefault("CLICKHOUSE_USER", "default"),
		ClickHousePassword:    getEnvOrDefault("CLICKHOUSE_PASSWORD", ""),
		ClickHouseDB:          getEnvOrDefault("CLICKHOUSE_DB", "seentics"),
	}

	// Validate required fields
	if cfg.JWTSecret == "" {
		return nil, errors.New("JWT_SECRET environment variable is required")
	}

	if cfg.Environment == "production" && len(cfg.JWTSecret) < 32 {
		return nil, errors.New("JWT_SECRET must be at least 32 characters long in production")
	}

	if cfg.Environment == "production" {
		if cfg.DatabaseURL == "" {
			return nil, errors.New("DATABASE_URL is required in production")
		}
	}

	return cfg, nil
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func GetEnvAsBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.ParseBool(value); err == nil {
			return parsed
		}
	}
	return defaultValue
}

func GetEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			return parsed
		}
	}
	return defaultValue
}
