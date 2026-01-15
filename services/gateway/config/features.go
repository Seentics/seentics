package config

import (
	"os"
	"strings"
)

// CloudEnabled checks if cloud features are enabled via environment variable
func CloudEnabled() bool {
	enabled := strings.ToLower(os.Getenv("CLOUD_ENABLED"))
	// Also fallback to CLOUD_FEATURES_ENABLED for backward compatibility if needed,
	// but user specifically asked for CLOUD_ENABLED
	if enabled == "" {
		enabled = strings.ToLower(os.Getenv("CLOUD_FEATURES_ENABLED"))
	}
	return enabled == "true" || enabled == "1"
}

// IsOpenSource returns true if this is an open source deployment
func IsOpenSource() bool {
	return !CloudEnabled()
}

// ShouldEnforceRateLimit returns true if rate limiting should be enforced
func ShouldEnforceRateLimit() bool {
	return CloudEnabled()
}

// GetRateLimits returns rate limits based on deployment type
func GetRateLimits() map[string]int {
	if IsOpenSource() {
		return map[string]int{
			"requests_per_minute": -1, // unlimited
			"burst_size":          -1, // unlimited
		}
	}

	// Cloud version has rate limits
	return map[string]int{
		"requests_per_minute": 100, // default limit
		"burst_size":          20,  // burst allowance
	}
}
