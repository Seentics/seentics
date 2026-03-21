package utils

import (
	"strings"
	"sync"

	"github.com/mssola/user_agent"
)

// UserAgentInfo contains parsed user agent information
type UserAgentInfo struct {
	Browser string `json:"browser"`
	Device  string `json:"device"`
	OS      string `json:"os"`
}

// uaCache is an in-memory LRU-ish cache for parsed User-Agent strings.
// Common UA strings repeat constantly — caching avoids re-parsing the same
// string thousands of times per minute.
var (
	uaCache   = make(map[string]UserAgentInfo, 256)
	uaCacheMu sync.RWMutex
	uaCacheMax = 2048
)

// ParseUserAgent parses a user agent string and returns browser, device, and OS information.
// Results are cached in-memory since the same UA strings repeat constantly.
func ParseUserAgent(userAgentString string) UserAgentInfo {
	if userAgentString == "" {
		return UserAgentInfo{
			Browser: "Unknown",
			Device:  "Unknown",
			OS:      "Unknown",
		}
	}

	// Fast path: check cache
	uaCacheMu.RLock()
	if info, ok := uaCache[userAgentString]; ok {
		uaCacheMu.RUnlock()
		return info
	}
	uaCacheMu.RUnlock()

	ua := user_agent.New(userAgentString)

	// Get browser info
	browser, _ := ua.Browser()
	if browser == "" {
		browser = "Unknown"
	}

	// Get OS info
	os := ua.OS()
	if os == "" {
		os = "Unknown"
	}

	// Detect device type
	var device string
	if ua.Mobile() {
		device = "mobile"
	} else {
		// Check if it's a tablet by looking for tablet-specific keywords in user agent
		uaLower := strings.ToLower(userAgentString)
		if strings.Contains(uaLower, "tablet") || strings.Contains(uaLower, "ipad") {
			device = "tablet"
		} else {
			device = "desktop"
		}
	}

	// Normalize browser names
	browser = normalizeBrowserName(browser)

	// Normalize OS names
	os = normalizeOSName(os)

	info := UserAgentInfo{
		Browser: browser,
		Device:  device,
		OS:      os,
	}

	// Store in cache (evict all if too large — simple but effective)
	uaCacheMu.Lock()
	if len(uaCache) >= uaCacheMax {
		uaCache = make(map[string]UserAgentInfo, 256)
	}
	uaCache[userAgentString] = info
	uaCacheMu.Unlock()

	return info
}

// normalizeBrowserName normalizes browser names for consistency
func normalizeBrowserName(browser string) string {
	browser = strings.ToLower(browser)

	switch {
	case strings.Contains(browser, "chrome"):
		return "Chrome"
	case strings.Contains(browser, "firefox"):
		return "Firefox"
	case strings.Contains(browser, "safari"):
		return "Safari"
	case strings.Contains(browser, "edge"):
		return "Edge"
	case strings.Contains(browser, "opera"):
		return "Opera"
	case strings.Contains(browser, "ie") || strings.Contains(browser, "internet explorer"):
		return "Internet Explorer"
	default:
		if len(browser) > 0 {
			return strings.ToUpper(browser[:1]) + browser[1:]
		}
		return "Unknown"
	}
}

// normalizeOSName normalizes OS names for consistency
func normalizeOSName(os string) string {
	osLower := strings.ToLower(os)

	switch {
	case strings.Contains(osLower, "windows"):
		return "Windows"
	case strings.Contains(osLower, "mac") || strings.Contains(osLower, "darwin"):
		return "macOS"
	case strings.Contains(osLower, "linux"):
		return "Linux"
	case strings.Contains(osLower, "android"):
		return "Android"
	case strings.Contains(osLower, "ios"):
		return "iOS"
	case strings.Contains(osLower, "ubuntu"):
		return "Ubuntu"
	case strings.Contains(osLower, "centos"):
		return "CentOS"
	case strings.Contains(osLower, "debian"):
		return "Debian"
	default:
		if len(os) > 0 {
			return strings.ToUpper(os[:1]) + os[1:]
		}
		return "Unknown"
	}
}
