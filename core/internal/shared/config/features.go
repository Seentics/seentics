package config

import (
	"os"
	"strings"
)

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

// GetEventLimits returns event limits based on deployment type
func GetEventLimits() map[string]int {
	if IsOpenSource() {
		return map[string]int{
			"events_per_month": -1, // unlimited
			"batch_size":       1000,
		}
	}

	// Enterprise mode — gateway enforces limits, but keep sensible defaults
	return map[string]int{
		"events_per_month": -1, // unlimited at core level; gateway enforces
		"batch_size":       1000,
	}
}
