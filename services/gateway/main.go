package main

import (
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"time"

	"github.com/joho/godotenv"
	"github.com/seentics/seentics/services/gateway/cache"
	"github.com/seentics/seentics/services/gateway/config"
	"github.com/seentics/seentics/services/gateway/database"
	"github.com/seentics/seentics/services/gateway/handlers"
	middlewares "github.com/seentics/seentics/services/gateway/middlewares"
	"github.com/seentics/seentics/services/gateway/models"
)

func main() {
	// Load .env file
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found or failed to load")
	}

	// Initialize Database
	if err := database.InitDB(); err != nil {
		log.Fatal("Database initialization error:", err)
	}

	// Auto Migration
	database.DB.AutoMigrate(&models.User{}, &models.Website{}, &models.Subscription{})

	// Initialize Redis
	redis_err := cache.InitRedis(os.Getenv("REDIS_URL"))
	if redis_err != nil {
		log.Println("Redis connection warning (proceeding without it):", redis_err)
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Seentics API Gateway & User Management Service"))
	})

	// --- Auth Handlers (Internal) ---
	mux.HandleFunc("/api/v1/user/auth/register", handlers.Register)
	mux.HandleFunc("/api/v1/user/auth/login", handlers.Login)
	// Profile and other user routes
	mux.HandleFunc("/api/v1/user/profile", handlers.GetProfile)
	mux.HandleFunc("/api/internal/users/", handlers.GetUserWebsitesInternal)

	// --- Website Management (Internal) ---
	mux.HandleFunc("/api/v1/user/websites", handlers.WebsiteHandler)
	mux.HandleFunc("/api/v1/user/websites/", handlers.SingleWebsiteHandler)

	// --- Billing (Cloud Only) ---
	if config.CloudEnabled() {
		mux.HandleFunc("/api/v1/user/subscription", handlers.GetSubscription)
		mux.HandleFunc("/api/v1/user/billing/usage", handlers.GetBillingUsage)
		mux.HandleFunc("/api/v1/user/billing/usage/increment", handlers.IncrementBillingUsage)
		mux.HandleFunc("/api/v1/webhooks/lemon-squeezy", handlers.LemonSqueezyWebhook)
	}

	// --- Analytics Proxy (External Service) ---
	mux.HandleFunc("/api/v1/analytics/", func(w http.ResponseWriter, r *http.Request) {
		proxyTo(w, r, os.Getenv("ANALYTICS_SERVICE_URL"))
	})

	// --- Admin routes ---
	mux.HandleFunc("/api/v1/admin/stats", handlers.GetAdminStats)
	mux.HandleFunc("/api/v1/admin/users", handlers.GetUsersList)
	mux.HandleFunc("/api/v1/admin/websites", handlers.GetWebsitesList)

	// Add health check endpoint
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"gateway-monolith"}`))
	})

	// Initialize events tracker
	middlewares.InitEventsTracker()

	handler := middlewares.ApplyMiddleware(mux,
		middlewares.LoggingMiddleware,
		middlewares.CORSMiddleware,
		middlewares.RateLimiterMiddleware,
		middlewares.AuthMiddleware,
		middlewares.EventsLimitMiddleware)

	port := os.Getenv("API_GATEWAY_PORT")
	if port == "" {
		port = "8080" // default port
	}

	log.Printf("Gateway is running on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}

func proxyTo(w http.ResponseWriter, r *http.Request, target string) {
	if target == "" {
		http.Error(w, "Service unavailable", http.StatusServiceUnavailable)
		return
	}

	targetURL, err := url.Parse(target)
	if err != nil {
		log.Printf("Invalid target URL %s: %v", target, err)
		http.Error(w, "Service configuration error", http.StatusInternalServerError)
		return
	}
	proxy := httputil.NewSingleHostReverseProxy(targetURL)

	// Add timeout configuration
	proxy.Transport = &http.Transport{
		ResponseHeaderTimeout: 30 * time.Second,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	// Add API key header for inter-service communication
	globalAPIKey := os.Getenv("GLOBAL_API_KEY")
	if globalAPIKey != "" {
		r.Header.Set("X-API-Key", globalAPIKey)
	}

	proxy.ServeHTTP(w, r)
}
