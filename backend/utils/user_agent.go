package utils

import (
	"strings"

	"github.com/mssola/user_agent"
)

// UserAgentInfo contains parsed user agent information
type UserAgentInfo struct {
	Browser string `json:"browser"`
	Device  string `json:"device"`
	OS      string `json:"os"`
}

// ParseUserAgent parses a user agent string and returns browser, device, and OS information
func ParseUserAgent(userAgentString string) UserAgentInfo {
	if userAgentString == "" {
		return UserAgentInfo{
			Browser: "Unknown",
			Device:  "Unknown",
			OS:      "Unknown",
		}
	}

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

	return UserAgentInfo{
		Browser: browser,
		Device:  device,
		OS:      os,
	}
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
		return "Unknown"
	}
}

// normalizeOSName normalizes OS names for consistency
func normalizeOSName(os string) string {
	os = strings.ToLower(os)

	switch {
	case strings.Contains(os, "windows"):
		return "Windows"
	case strings.Contains(os, "mac") || strings.Contains(os, "darwin"):
		return "macOS"
	case strings.Contains(os, "linux"):
		return "Linux"
	case strings.Contains(os, "android"):
		return "Android"
	case strings.Contains(os, "ios"):
		return "iOS"
	case strings.Contains(os, "ubuntu"):
		return "Ubuntu"
	case strings.Contains(os, "centos"):
		return "CentOS"
	case strings.Contains(os, "debian"):
		return "Debian"
	default:
		return "Unknown"
	}
}
