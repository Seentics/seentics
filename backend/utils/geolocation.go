package utils

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/oschwald/geoip2-golang"
)

// LocationInfo contains comprehensive geolocation information
type LocationInfo struct {
	Country     string  `json:"country"`
	CountryCode string  `json:"country_code"`
	City        string  `json:"city"`
	Continent   string  `json:"continent"`
	Region      string  `json:"region"`
	Timezone    string  `json:"timezone,omitempty"`
	Latitude    float64 `json:"latitude,omitempty"`
	Longitude   float64 `json:"longitude,omitempty"`
}

// Cache entry for IP geolocation
type cacheEntry struct {
	location  LocationInfo
	timestamp time.Time
}

// GeolocationService provides IP geolocation with multiple backends
type GeolocationService struct {
	redisClient *redis.Client
	maxmindDB   *geoip2.Reader

	// Fallback in-memory cache
	memCache   map[string]cacheEntry
	cacheMutex sync.RWMutex
	cacheTTL   time.Duration
}

// Global service instance
var (
	globalGeoService *GeolocationService
	serviceOnce      sync.Once
)

// GetClientIP extracts the client IP address from the request context
func GetClientIP(ctx context.Context) string {
	if ctx == nil {
		return ""
	}

	// Try to get IP from context (set by middleware)
	if ip, ok := ctx.Value("client_ip").(string); ok && ip != "" {
		return ip
	}

	return ""
}

// NewGeolocationService creates a new geolocation service with Redis and MaxMind support
func NewGeolocationService() *GeolocationService {
	service := &GeolocationService{
		memCache: make(map[string]cacheEntry),
		cacheTTL: 24 * time.Hour,
	}

	// Initialize Redis client if available
	redisURL := os.Getenv("REDIS_URL")
	if redisURL != "" {
		opt, err := redis.ParseURL(redisURL)
		if err == nil {
			service.redisClient = redis.NewClient(opt)
			// Test connection with shorter timeout
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			if err := service.redisClient.Ping(ctx).Err(); err != nil {
				// Redis not available, close client and fallback to memory cache
				service.redisClient.Close()
				service.redisClient = nil
			}
		}
	}

	// Initialize MaxMind database if available
	maxmindPath := os.Getenv("MAXMIND_DB_PATH")
	if maxmindPath == "" {
		maxmindPath = "/data/GeoLite2-City.mmdb" // Default path
	}

	// Only try to open MaxMind if the file exists and license key is set
	if maxmindLicense := os.Getenv("MAXMIND_LICENSE_KEY"); maxmindLicense != "" {
		if db, err := geoip2.Open(maxmindPath); err == nil {
			service.maxmindDB = db
		}
		// If MaxMind fails to load, we'll fall back to other methods
	}

	return service
}

// GetGlobalGeolocationService returns the singleton geolocation service
func GetGlobalGeolocationService() *GeolocationService {
	serviceOnce.Do(func() {
		globalGeoService = NewGeolocationService()
	})
	return globalGeoService
}

// GetLocationFromIP determines location from IP address with caching (public interface)
func GetLocationFromIP(ip string) LocationInfo {
	return GetGlobalGeolocationService().GetLocation(ip)
}

// GetLocation determines location from IP address using the service
func (g *GeolocationService) GetLocation(ip string) LocationInfo {
	if ip == "" {
		return LocationInfo{
			Country:     "Unknown",
			CountryCode: "XX",
			City:        "Unknown",
			Continent:   "Unknown",
		}
	}

	// Handle localhost and private IPs
	if isPrivateIP(ip) {
		return LocationInfo{
			Country:     "Local",
			CountryCode: "LC",
			City:        "Local",
			Continent:   "Local",
		}
	}

	// Try Redis cache first
	if location := g.getFromRedisCache(ip); location != nil {
		return *location
	}

	// Try MaxMind database (most accurate)
	if location := g.getFromMaxMind(ip); location != nil {
		g.setInCache(ip, *location)
		return *location
	}

	// Fallback to in-memory cache
	if location := g.getFromMemoryCache(ip); location != nil {
		return *location
	}

	// Last resort: use free API
	location := g.getFromFreeAPI(ip)
	g.setInCache(ip, location)
	return location
}

// getFromRedisCache retrieves location from Redis cache
func (g *GeolocationService) getFromRedisCache(ip string) *LocationInfo {
	if g.redisClient == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	cacheKey := "geo:" + ip
	data, err := g.redisClient.Get(ctx, cacheKey).Result()
	if err != nil {
		return nil
	}

	var location LocationInfo
	if err := json.Unmarshal([]byte(data), &location); err != nil {
		return nil
	}

	return &location
}

// getFromMaxMind retrieves location from MaxMind database
func (g *GeolocationService) getFromMaxMind(ip string) *LocationInfo {
	if g.maxmindDB == nil {
		return nil
	}

	parsedIP := net.ParseIP(ip)
	if parsedIP == nil {
		return nil
	}

	record, err := g.maxmindDB.City(parsedIP)
	if err != nil {
		return nil
	}

	// Extract comprehensive location data
	location := &LocationInfo{
		Country:     "Unknown",
		CountryCode: "XX",
		City:        "Unknown",
		Continent:   "Unknown",
		Region:      "Unknown",
	}

	// Country information
	if record.Country.Names["en"] != "" {
		location.Country = record.Country.Names["en"]
	}
	if record.Country.IsoCode != "" {
		location.CountryCode = record.Country.IsoCode
	}

	// City information
	if record.City.Names["en"] != "" {
		location.City = record.City.Names["en"]
	}

	// Continent information
	if record.Continent.Names["en"] != "" {
		location.Continent = record.Continent.Names["en"]
	}

	// Region/State information
	if len(record.Subdivisions) > 0 && record.Subdivisions[0].Names["en"] != "" {
		location.Region = record.Subdivisions[0].Names["en"]
	}

	// Timezone information
	if record.Location.TimeZone != "" {
		location.Timezone = record.Location.TimeZone
	}

	// Coordinates
	if record.Location.Latitude != 0 && record.Location.Longitude != 0 {
		location.Latitude = float64(record.Location.Latitude)
		location.Longitude = float64(record.Location.Longitude)
	}

	return location
}

// getFromMemoryCache retrieves location from in-memory cache
func (g *GeolocationService) getFromMemoryCache(ip string) *LocationInfo {
	g.cacheMutex.RLock()
	defer g.cacheMutex.RUnlock()

	if entry, exists := g.memCache[ip]; exists {
		if time.Since(entry.timestamp) < g.cacheTTL {
			return &entry.location
		}
	}
	return nil
}

// getFromFreeAPI retrieves location from free geolocation APIs
func (g *GeolocationService) getFromFreeAPI(ip string) LocationInfo {
	geoService := NewFreeGeoIPService()
	location, err := geoService.Lookup(ip)
	if err != nil {
		return LocationInfo{
			Country:     "Unknown",
			CountryCode: "XX",
			City:        "Unknown",
			Continent:   "Unknown",
		}
	}
	return *location
}

// setInCache stores location in available caches
func (g *GeolocationService) setInCache(ip string, location LocationInfo) {
	// Set in Redis cache
	if g.redisClient != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		cacheKey := "geo:" + ip
		data, err := json.Marshal(location)
		if err == nil {
			g.redisClient.Set(ctx, cacheKey, data, g.cacheTTL)
		}
	}

	// Set in memory cache as fallback
	g.cacheMutex.Lock()
	g.memCache[ip] = cacheEntry{
		location:  location,
		timestamp: time.Now(),
	}
	g.cacheMutex.Unlock()
}

// Close closes the geolocation service resources
func (g *GeolocationService) Close() error {
	if g.redisClient != nil {
		g.redisClient.Close()
	}
	if g.maxmindDB != nil {
		return g.maxmindDB.Close()
	}
	return nil
}

// isPrivateIP checks if an IP address is private/local
func isPrivateIP(ip string) bool {
	parsedIP := net.ParseIP(ip)
	if parsedIP == nil {
		return false
	}

	// Check for private IP ranges
	privateRanges := []string{
		"10.0.0.0/8",     // Class A private
		"172.16.0.0/12",  // Class B private
		"192.168.0.0/16", // Class C private
		"127.0.0.0/8",    // Loopback
		"::1/128",        // IPv6 loopback
		"fc00::/7",       // IPv6 unique local
		"fe80::/10",      // IPv6 link local
	}

	for _, cidr := range privateRanges {
		_, network, err := net.ParseCIDR(cidr)
		if err != nil {
			continue
		}
		if network.Contains(parsedIP) {
			return true
		}
	}

	return false
}

// SetClientIPInContext sets the client IP in the context for middleware
func SetClientIPInContext(ctx context.Context, ip string) context.Context {
	return context.WithValue(ctx, "client_ip", ip)
}

// --- Free API Service Implementation ---

// FreeGeoIPResponse contains the response from free geolocation APIs
type FreeGeoIPResponse struct {
	Country       string  `json:"country"`
	CountryCode   string  `json:"country_code"`
	CountryCode3  string  `json:"country_code3"`
	City          string  `json:"city"`
	Region        string  `json:"region"`
	RegionCode    string  `json:"region_code"`
	Continent     string  `json:"continent_code"`
	ContinentName string  `json:"continent_name"`
	Timezone      string  `json:"timezone"`
	Latitude      float64 `json:"latitude"`
	Longitude     float64 `json:"longitude"`
	IP            string  `json:"ip"`
}

// FreeGeoIPService provides free IP geolocation using public APIs
type FreeGeoIPService struct {
	client *http.Client
}

// NewFreeGeoIPService creates a new free geolocation service
func NewFreeGeoIPService() *FreeGeoIPService {
	return &FreeGeoIPService{
		client: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

// Lookup performs a geolocation lookup using free APIs
func (f *FreeGeoIPService) Lookup(ip string) (*LocationInfo, error) {
	if ip == "" {
		return nil, fmt.Errorf("IP address is required")
	}

	// Skip private IPs
	if isPrivateIP(ip) {
		return &LocationInfo{
			Country:     "Local",
			CountryCode: "LC",
			City:        "Local",
			Continent:   "Local",
		}, nil
	}

	// Try multiple free geolocation APIs for redundancy
	apis := []struct {
		url    string
		parser func([]byte) (*LocationInfo, error)
	}{
		{"http://ip-api.com/json/", f.parseIPAPI},
		{"https://ipapi.co/" + ip + "/json/", f.parseIPAPICo},
		{"https://freegeoip.app/json/", f.parseFreeGeoIP},
	}

	for _, api := range apis {
		if location, err := f.lookupFromAPI(api.url, ip, api.parser); err == nil {
			return location, nil
		}
	}

	// If all APIs fail, return Unknown
	return &LocationInfo{
		Country:     "Unknown",
		CountryCode: "XX",
		City:        "Unknown",
		Continent:   "Unknown",
	}, nil
}

// lookupFromAPI performs lookup from a specific API
func (f *FreeGeoIPService) lookupFromAPI(apiURL, ip string, parser func([]byte) (*LocationInfo, error)) (*LocationInfo, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	url := apiURL
	if !containsSubstring(apiURL, ip) {
		url = apiURL + ip
	}

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	// Set user agent to avoid being blocked
	req.Header.Set("User-Agent", "Seentics-Analytics/1.0")

	resp, err := f.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	return parser(body)
}

// parseIPAPI parses response from ip-api.com
func (f *FreeGeoIPService) parseIPAPI(body []byte) (*LocationInfo, error) {
	var resp struct {
		Country       string  `json:"country"`
		CountryCode   string  `json:"countryCode"`
		City          string  `json:"city"`
		Region        string  `json:"regionName"`
		Continent     string  `json:"continent"`
		ContinentCode string  `json:"continentCode"`
		Timezone      string  `json:"timezone"`
		Lat           float64 `json:"lat"`
		Lon           float64 `json:"lon"`
		Status        string  `json:"status"`
	}

	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}

	if resp.Status != "success" {
		return nil, fmt.Errorf("API returned error status")
	}

	return &LocationInfo{
		Country:     resp.Country,
		CountryCode: resp.CountryCode,
		City:        resp.City,
		Continent:   resp.Continent,
		Region:      resp.Region,
		Timezone:    resp.Timezone,
		Latitude:    resp.Lat,
		Longitude:   resp.Lon,
	}, nil
}

// parseIPAPICo parses response from ipapi.co
func (f *FreeGeoIPService) parseIPAPICo(body []byte) (*LocationInfo, error) {
	var resp struct {
		Country     string  `json:"country_name"`
		CountryCode string  `json:"country_code"`
		City        string  `json:"city"`
		Region      string  `json:"region"`
		Continent   string  `json:"continent_code"`
		Timezone    string  `json:"timezone"`
		Latitude    float64 `json:"latitude"`
		Longitude   float64 `json:"longitude"`
	}

	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}

	continent := resp.Continent
	// Convert continent codes to names
	continentMap := map[string]string{
		"AF": "Africa",
		"AN": "Antarctica",
		"AS": "Asia",
		"EU": "Europe",
		"NA": "North America",
		"OC": "Oceania",
		"SA": "South America",
	}
	if name, exists := continentMap[continent]; exists {
		continent = name
	}

	return &LocationInfo{
		Country:     resp.Country,
		CountryCode: resp.CountryCode,
		City:        resp.City,
		Continent:   continent,
		Region:      resp.Region,
		Timezone:    resp.Timezone,
		Latitude:    resp.Latitude,
		Longitude:   resp.Longitude,
	}, nil
}

// parseFreeGeoIP parses response from freegeoip.app
func (f *FreeGeoIPService) parseFreeGeoIP(body []byte) (*LocationInfo, error) {
	var resp FreeGeoIPResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}

	continent := resp.ContinentName
	if continent == "" {
		continent = resp.Continent
	}

	return &LocationInfo{
		Country:     resp.Country,
		CountryCode: resp.CountryCode,
		City:        resp.City,
		Continent:   continent,
		Region:      resp.Region,
		Timezone:    resp.Timezone,
		Latitude:    resp.Latitude,
		Longitude:   resp.Longitude,
	}, nil
}

// containsSubstring checks if a string contains a substring
func containsSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
