package config

import (
	"os"
	"strings"
)

// CloudEnabled checks if cloud features are enabled via environment variable
func CloudEnabled() bool {
	enabled := strings.ToLower(os.Getenv("CLOUD_ENABLED"))
	// Fallback for backward compatibility
	if enabled == "" {
		enabled = strings.ToLower(os.Getenv("CLOUD_FEATURES_ENABLED"))
	}
	return enabled == "true" || enabled == "1"
}

// IsOpenSource returns true if this is an open source deployment
func IsOpenSource() bool {
	return !CloudEnabled()
}

// ShouldEnforceUsageLimits returns true if usage limits should be enforced
func ShouldEnforceUsageLimits() bool {
	return CloudEnabled()
}

// GetEventLimits returns event limits based on deployment type
func GetEventLimits() map[string]int {
	if IsOpenSource() {
		return map[string]int{
			"events_per_month": -1, // unlimited
			"batch_size":       1000,
		}
	}

	// Cloud version has limits
	return map[string]int{
		"events_per_month": 10000, // default free tier
		"batch_size":       100,
	}
}
