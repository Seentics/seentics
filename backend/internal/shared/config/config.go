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
		JWTSecret:             getEnvOrDefault("JWT_SECRET", "seentics-default-secret-change-me"),
		GlobalAPIKey:          getEnvOrDefault("GLOBAL_API_KEY", ""),
		DbMaxConns:            GetEnvAsInt("DB_MAX_CONNS", 100),
		DbMinConns:            GetEnvAsInt("DB_MIN_CONNS", 25),
		CORSAllowedOrigins:    getEnvOrDefault("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"),
	}

	// Validate required fields for production
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
