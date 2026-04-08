package config

import (
	"os"
	"strings"
)

// IsProduction returns true when running in production environment
func IsProduction() bool {
	val := strings.ToLower(os.Getenv("ENVIRONMENT"))
	return val == "production"
}

// IsEnterprise checks if this instance is running in enterprise/cloud mode
func IsEnterprise() bool {
	val := strings.ToLower(os.Getenv("IS_ENTERPRISE"))
	return val == "true" || val == "1"
}

// CloudEnabled checks if cloud features are enabled via environment variable
// Used by UnifiedAuthMiddleware to accept gateway headers
func CloudEnabled() bool {
	enabled := strings.ToLower(os.Getenv("CLOUD_ENABLED"))
	// Fallback for backward compatibility
	if enabled == "" {
		enabled = strings.ToLower(os.Getenv("CLOUD_FEATURES_ENABLED"))
	}
	return enabled == "true" || enabled == "1"
}

// IsOpenSource returns true when NOT running in enterprise mode
func IsOpenSource() bool {
	return !IsEnterprise()
}

// ShouldEnforceUsageLimits returns true if usage limits should be enforced
// In OSS mode, all limits are removed. Enterprise gateway enforces its own limits.
func ShouldEnforceUsageLimits() bool {
	return IsEnterprise()
}

