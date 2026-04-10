package config

import (
	"errors"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Environment        string
	Port               string
	DatabaseURL        string
	RedisURL           string
	LogLevel           string
	JWTSecret          string
	GlobalAPIKey       string
	DbMaxConns         int
	DbMinConns         int
	CORSAllowedOrigins string
	PostalServerURL    string
	PostalAPIKey       string
	PostalFromEmail    string
	PostalFromName     string
	ClickHouseHost     string
	ClickHousePort     int
	ClickHouseUser     string
	ClickHousePassword string
	ClickHouseDB       string

	// S3-compatible storage (MinIO local, Cloudflare R2, AWS S3, etc.) — replay payloads
	S3Endpoint  string
	S3AccessKey string
	S3SecretKey string
	S3Bucket    string
	S3UseSSL    bool
	S3Region    string
}

func Load() (*Config, error) {
	// Load .env file if it exists
	_ = godotenv.Load()

	cfg := &Config{
		Environment:        getEnvOrDefault("ENVIRONMENT", "development"),
		Port:               getEnvOrDefault("PORT", "3002"),
		DatabaseURL:        getEnvOrDefault("DATABASE_URL", ""),
		RedisURL:           getEnvOrDefault("REDIS_URL", "redis://localhost:6379"),
		LogLevel:           getEnvOrDefault("LOG_LEVEL", "info"),
		JWTSecret:          getEnvOrDefault("JWT_SECRET", ""),
		GlobalAPIKey:       getEnvOrDefault("GLOBAL_API_KEY", ""),
		DbMaxConns:         GetEnvAsInt("DB_MAX_CONNS", 100),
		DbMinConns:         GetEnvAsInt("DB_MIN_CONNS", 25),
		CORSAllowedOrigins: getEnvOrDefault("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,https://www.seentics.com,https://seentics.com,https://analytics.seentics.com,https://auth.seentics.com,https://replays.seentics.com,https://automation.seentics.com,https://feedback.seentics.com,https://status.seentics.com"),
		PostalServerURL:    getEnvOrDefault("POSTAL_SERVER_URL", ""),
		PostalAPIKey:       getEnvOrDefault("POSTAL_API_KEY", ""),
		PostalFromEmail:    getEnvOrDefault("POSTAL_FROM_EMAIL", ""),
		PostalFromName:     getEnvOrDefault("POSTAL_FROM_NAME", "Seentics Support"),
		ClickHouseHost:     getEnvOrDefault("CLICKHOUSE_HOST", "localhost"),
		ClickHousePort:     GetEnvAsInt("CLICKHOUSE_PORT", 9000),
		ClickHouseUser:     getEnvOrDefault("CLICKHOUSE_USER", "default"),
		ClickHousePassword: getEnvOrDefault("CLICKHOUSE_PASSWORD", ""),
		ClickHouseDB:       getEnvOrDefault("CLICKHOUSE_DB", "seentics"),

		S3Endpoint:  getEnvOrDefault("S3_ENDPOINT", "localhost:9000"),
		S3AccessKey: firstEnvOrDefault([]string{"S3_ACCESS_KEY", "AWS_ACCESS_KEY_ID"}, "minioadmin"),
		S3SecretKey: firstEnvOrDefault([]string{"S3_SECRET_KEY", "AWS_SECRET_ACCESS_KEY"}, "minioadmin"),
		S3Bucket:    firstEnvOrDefault([]string{"S3_BUCKET", "S3_BUCKET_REPLAYS"}, "seentics-replays"),
		S3UseSSL:    GetEnvAsBool("S3_USE_SSL", false),
		S3Region:    firstEnvOrDefault([]string{"S3_REGION", "AWS_REGION"}, "us-east-1"),
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
		if !isLikelyLocalS3Endpoint(cfg.S3Endpoint) &&
			(cfg.S3AccessKey == "minioadmin" || cfg.S3SecretKey == "minioadmin" ||
				cfg.S3AccessKey == "" || cfg.S3SecretKey == "") {
			return nil, errors.New("production S3/R2: set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (or S3_ACCESS_KEY / S3_SECRET_KEY); default MinIO credentials only apply to local MinIO")
		}
	}

	return cfg, nil
}

func isLikelyLocalS3Endpoint(endpoint string) bool {
	e := strings.ToLower(strings.TrimSpace(endpoint))
	return strings.Contains(e, "minio") ||
		strings.Contains(e, "localhost") ||
		strings.Contains(e, "127.0.0.1")
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// firstEnvOrDefault returns the first non-empty os.Getenv(key) for keys in order, else defaultValue.
func firstEnvOrDefault(keys []string, defaultValue string) string {
	for _, k := range keys {
		if v := os.Getenv(k); v != "" {
			return v
		}
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
// S3Config holds S3-compatible storage settings used for session replay data.
type S3Config struct {
	Endpoint  string
	AccessKey string
	SecretKey string
	Bucket    string
	UseSSL    bool
	Region    string
}

// S3 returns the S3/MinIO config extracted from the main Config.
func (c *Config) S3() S3Config {
	return S3Config{
		Endpoint:  c.S3Endpoint,
		AccessKey: c.S3AccessKey,
		SecretKey: c.S3SecretKey,
		Bucket:    c.S3Bucket,
		UseSSL:    c.S3UseSSL,
		Region:    c.S3Region,
	}
}
