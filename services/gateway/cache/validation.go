package cache

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"regexp"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/seentics/seentics/services/gateway/database"
	"github.com/seentics/seentics/services/gateway/models"
)

// createSecureCacheKey creates a hashed cache key for sensitive data
func createSecureCacheKey(prefix string, parts ...string) string {
	combined := prefix
	for _, part := range parts {
		combined += ":" + part
	}
	hash := sha256.Sum256([]byte(combined))
	return prefix + "_hash:" + hex.EncodeToString(hash[:16])
}

// sanitizeInput sanitizes input strings
func sanitizeInput(input string) string {
	input = strings.ReplaceAll(input, "\x00", "")
	if len(input) > 255 {
		input = input[:255]
	}
	dangerousChars := regexp.MustCompile(`[<>'";&|$\x00-\x1f\x7f-\x9f]`)
	input = dangerousChars.ReplaceAllString(input, "")
	return strings.TrimSpace(input)
}

func validateInputs(websiteID, domain string) error {
	if websiteID == "" {
		return fmt.Errorf("websiteID cannot be empty")
	}
	return nil
}

// ValidateWebsite checks cache first, then calls the DB
func ValidateWebsite(siteID, domain string) (map[string]interface{}, error) {
	siteID = sanitizeInput(siteID)
	domain = sanitizeInput(domain)

	cacheKey := fmt.Sprintf("val:site:%s:dom:%s", siteID, domain)

	// 1. Check Redis
	if cachedData, err := GetCachedData(cacheKey); err == nil {
		return cachedData, nil
	}

	// 2. Call DB
	var website models.Website
	if err := database.DB.Where("site_id = ?", siteID).First(&website).Error; err != nil {
		return nil, fmt.Errorf("website not found: %s", siteID)
	}

	websiteData := map[string]interface{}{
		"id":         fmt.Sprintf("%d", website.ID),
		"siteId":     website.SiteID,
		"domain":     website.URL,
		"name":       website.Name,
		"isVerified": website.IsVerified,
		"isActive":   website.IsActive,
		"userId":     fmt.Sprintf("%d", website.UserID),
	}

	// 3. Cache
	_ = CacheData(cacheKey, websiteData, VALIDATION_CACHE_TTL)

	return websiteData, nil
}

// ValidateJWTToken parses and validates JWT locally
func ValidateJWTToken(tokenString string) (map[string]interface{}, error) {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "seentics-default-secret-change-me"
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(jwtSecret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token")
}

// ValidateWebsiteOwnership checks if user owns website via DB
func ValidateWebsiteOwnership(userID, websiteID string) (map[string]interface{}, error) {
	var website models.Website
	if err := database.DB.Where("id = ? AND user_id = ?", websiteID, userID).First(&website).Error; err != nil {
		return nil, fmt.Errorf("user %s does not own website %s", userID, websiteID)
	}

	websiteData := map[string]interface{}{
		"id":     fmt.Sprintf("%d", website.ID),
		"siteId": website.SiteID,
		"userId": fmt.Sprintf("%d", website.UserID),
	}

	return websiteData, nil
}

func isTrackingRequest(path string) bool {
	return strings.Contains(path, "/analytics/") || strings.Contains(path, "/track")
}

func checkRateLimit(websiteID string) error {
	return nil // Handled by RateLimiterMiddleware
}
