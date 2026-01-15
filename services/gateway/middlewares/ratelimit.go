package middlewares

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/seentics/seentics/services/gateway/cache"
	"github.com/seentics/seentics/services/gateway/config"
	"github.com/seentics/seentics/services/gateway/utils"
)

// Rate limit rules with burst protection
var rateLimits = map[string]struct {
	requests    int
	window      time.Duration
	burstLimit  int
	burstWindow time.Duration
}{
	"public":      {1000, time.Hour, 100, time.Minute}, // 1000/hour, max 100/minute burst
	"protected":   {5000, time.Hour, 200, time.Minute}, // 5000/hour, max 200/minute burst
	"unprotected": {100, time.Hour, 20, time.Minute},   // 100/hour, max 20/minute burst
	"auth":        {50, time.Hour, 10, time.Minute},    // 50/hour, max 10/minute burst (stricter for auth)
}

// Rate limiter middleware
func RateLimiterMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip rate limiting in open source deployment
		if config.IsOpenSource() {
			next.ServeHTTP(w, r)
			return
		}
		// Determine route type
		routeType := "unprotected"
		if strings.HasPrefix(r.URL.Path, "/api/v1/auth/") {
			routeType = "auth"
		} else {
			routeType = utils.GetRouteType(r.URL.Path)
		}

		// Get rate limit config
		config, exists := rateLimits[routeType]
		if !exists {
			next.ServeHTTP(w, r)
			return
		}

		// Create rate limit key
		identifier := utils.GetRateLimitID(r, routeType)
		key := fmt.Sprintf("rate:%s:%s", routeType, identifier)

		// Check rate limit with burst protection
		allowed, count, err := utils.CheckRateLimitWithBurst(
			cache.GetRedisClient(),
			key,
			config.requests,
			config.window,
			config.burstLimit,
			config.burstWindow,
		)
		if err != nil {
			next.ServeHTTP(w, r) // Continue on error
			return
		}

		// Add headers
		w.Header().Set("X-RateLimit-Limit", strconv.Itoa(config.requests))
		w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(config.requests-count))
		w.Header().Set("X-RateLimit-Burst-Limit", strconv.Itoa(config.burstLimit))
		w.Header().Set("X-RateLimit-Window", config.window.String())

		if !allowed {
			http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
			return
		}

		next.ServeHTTP(w, r)
	})
}
