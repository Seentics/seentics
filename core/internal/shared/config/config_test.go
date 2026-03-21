package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestLoad_RequiresJWTSecret(t *testing.T) {
	t.Setenv("JWT_SECRET", "")
	t.Setenv("ENVIRONMENT", "development")

	_, err := Load()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "JWT_SECRET")
}

func TestLoad_RequiresLongJWTSecretInProduction(t *testing.T) {
	t.Setenv("JWT_SECRET", "short")
	t.Setenv("ENVIRONMENT", "production")
	t.Setenv("DATABASE_URL", "postgres://localhost/test")

	_, err := Load()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "at least 32 characters")
}

func TestLoad_RequiresDatabaseURLInProduction(t *testing.T) {
	t.Setenv("JWT_SECRET", "a-very-long-secret-that-is-at-least-32-characters")
	t.Setenv("ENVIRONMENT", "production")
	t.Setenv("DATABASE_URL", "")

	_, err := Load()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "DATABASE_URL")
}

func TestLoad_SucceedsWithValidConfig(t *testing.T) {
	t.Setenv("JWT_SECRET", "a-very-long-secret-that-is-at-least-32-characters")
	t.Setenv("ENVIRONMENT", "development")
	t.Setenv("PORT", "3002")

	cfg, err := Load()
	assert.NoError(t, err)
	assert.Equal(t, "3002", cfg.Port)
	assert.Equal(t, "development", cfg.Environment)
}

func TestLoad_DefaultValues(t *testing.T) {
	t.Setenv("JWT_SECRET", "a-very-long-secret-that-is-at-least-32-characters")
	t.Setenv("ENVIRONMENT", "")
	t.Setenv("PORT", "")
	t.Setenv("LOG_LEVEL", "")

	cfg, err := Load()
	assert.NoError(t, err)
	assert.Equal(t, "development", cfg.Environment)
	assert.Equal(t, "3002", cfg.Port)
	assert.Equal(t, "info", cfg.LogLevel)
}

func TestGetEnvAsInt_Default(t *testing.T) {
	t.Setenv("TEST_INT", "")
	result := GetEnvAsInt("TEST_INT", 42)
	assert.Equal(t, 42, result)
}

func TestGetEnvAsInt_Parsed(t *testing.T) {
	t.Setenv("TEST_INT", "100")
	result := GetEnvAsInt("TEST_INT", 42)
	assert.Equal(t, 100, result)
}

func TestGetEnvAsInt_InvalidFallsBack(t *testing.T) {
	t.Setenv("TEST_INT", "not-a-number")
	result := GetEnvAsInt("TEST_INT", 42)
	assert.Equal(t, 42, result)
}

func TestGetEnvAsBool_Parsed(t *testing.T) {
	t.Setenv("TEST_BOOL", "true")
	assert.True(t, GetEnvAsBool("TEST_BOOL", false))

	t.Setenv("TEST_BOOL", "false")
	assert.False(t, GetEnvAsBool("TEST_BOOL", true))
}

func TestGetEnvAsBool_Default(t *testing.T) {
	t.Setenv("TEST_BOOL", "")
	assert.True(t, GetEnvAsBool("TEST_BOOL", true))
	assert.False(t, GetEnvAsBool("TEST_BOOL", false))
}

func TestIsProduction(t *testing.T) {
	t.Setenv("ENVIRONMENT", "production")
	assert.True(t, IsProduction())

	t.Setenv("ENVIRONMENT", "development")
	assert.False(t, IsProduction())

	t.Setenv("ENVIRONMENT", "")
	assert.False(t, IsProduction())
}

func TestIsEnterprise(t *testing.T) {
	t.Setenv("IS_ENTERPRISE", "true")
	assert.True(t, IsEnterprise())

	t.Setenv("IS_ENTERPRISE", "false")
	assert.False(t, IsEnterprise())

	t.Setenv("IS_ENTERPRISE", "")
	assert.False(t, IsEnterprise())
}

func TestCloudEnabled(t *testing.T) {
	t.Setenv("CLOUD_ENABLED", "true")
	t.Setenv("CLOUD_FEATURES_ENABLED", "")
	assert.True(t, CloudEnabled())

	t.Setenv("CLOUD_ENABLED", "")
	t.Setenv("CLOUD_FEATURES_ENABLED", "true")
	assert.True(t, CloudEnabled())

	t.Setenv("CLOUD_ENABLED", "")
	t.Setenv("CLOUD_FEATURES_ENABLED", "")
	assert.False(t, CloudEnabled())
}
