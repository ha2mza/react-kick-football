package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

// Configuration
var (
	port           = getEnv("PORT", "8080")
	redisURL       = getEnv("REDIS_URL", "localhost:6379")
	redisPassword  = getEnv("REDIS_PASSWORD", "")
	redisDB        = getEnvInt("REDIS_DB", 0)
	rateLimitTime  = 100 * time.Millisecond // Minimum time between clicks per IP
	saveInterval   = 10 * time.Minute       // Save to Redis every 10 minutes
)

// Redis keys
const (
	redisKeyClicks    = "football:clicks"
	redisKeyStartTime = "football:start_time"
)

// Data structures
type ClickPayload struct {
	Country string `json:"country"`
	Clicks  int    `json:"clicks"`
}

type ScorePayload struct {
	Country string `json:"country"`
	Score   int    `json:"score"`
}

type CountryStats struct {
	Country string  `json:"country"`
	Clicks  int64   `json:"clicks"`
	KPS     float64 `json:"kps,omitempty"`
}

type LeaderboardResponse []CountryStats

// In-memory storage with Redis persistence
type Storage struct {
	mu            sync.RWMutex
	countryClicks map[string]int64
	lastClickIP   map[string]time.Time // IP -> last click time
	startTime     time.Time
	dirty         bool // Flag to track if data changed since last save
}

var (
	storage = &Storage{
		countryClicks: make(map[string]int64),
		lastClickIP:   make(map[string]time.Time),
		startTime:     time.Now(),
		dirty:         false,
	}
	redisClient *redis.Client
	ctx         = context.Background()
)

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

// Initialize Redis connection
func initRedis() error {
	redisClient = redis.NewClient(&redis.Options{
		Addr:     redisURL,
		Password: redisPassword,
		DB:       redisDB,
	})

	// Test connection
	_, err := redisClient.Ping(ctx).Result()
	if err != nil {
		return fmt.Errorf("failed to connect to Redis: %v", err)
	}

	log.Printf("✅ Connected to Redis at %s", redisURL)
	return nil
}

// Load data from Redis on startup
func loadFromRedis() error {
	storage.mu.Lock()
	defer storage.mu.Unlock()

	// Load country clicks
	clicksData, err := redisClient.HGetAll(ctx, redisKeyClicks).Result()
	if err != nil && err != redis.Nil {
		return fmt.Errorf("failed to load clicks from Redis: %v", err)
	}

	if len(clicksData) > 0 {
		for country, clicksStr := range clicksData {
			clicks, err := strconv.ParseInt(clicksStr, 10, 64)
			if err == nil {
				storage.countryClicks[country] = clicks
			}
		}
		log.Printf("📊 Loaded %d countries from Redis", len(clicksData))
	}

	// Load start time
	startTimeStr, err := redisClient.Get(ctx, redisKeyStartTime).Result()
	if err == nil {
		startTimeUnix, err := strconv.ParseInt(startTimeStr, 10, 64)
		if err == nil {
			storage.startTime = time.Unix(startTimeUnix, 0)
			log.Printf("⏱️  Loaded start time: %v", storage.startTime)
		}
	} else if err == redis.Nil {
		// First run, save current start time
		redisClient.Set(ctx, redisKeyStartTime, storage.startTime.Unix(), 0)
		log.Printf("⏱️  Set new start time: %v", storage.startTime)
	}

	// Calculate total clicks
	var totalClicks int64
	for _, clicks := range storage.countryClicks {
		totalClicks += clicks
	}
	log.Printf("📈 Total clicks loaded: %d", totalClicks)

	return nil
}

// Save data to Redis
func saveToRedis() error {
	storage.mu.RLock()
	defer storage.mu.RUnlock()

	if !storage.dirty && len(storage.countryClicks) == 0 {
		return nil // Nothing to save
	}

	// Save country clicks as hash
	if len(storage.countryClicks) > 0 {
		clicksMap := make(map[string]interface{})
		for country, clicks := range storage.countryClicks {
			clicksMap[country] = clicks
		}
		
		err := redisClient.HSet(ctx, redisKeyClicks, clicksMap).Err()
		if err != nil {
			return fmt.Errorf("failed to save clicks to Redis: %v", err)
		}
	}

	storage.dirty = false
	
	// Calculate total for logging
	var totalClicks int64
	for _, clicks := range storage.countryClicks {
		totalClicks += clicks
	}
	log.Printf("💾 Saved to Redis: %d countries, %d total clicks", len(storage.countryClicks), totalClicks)

	return nil
}

// Periodic save goroutine
func startPeriodicSave(stopChan <-chan struct{}) {
	ticker := time.NewTicker(saveInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := saveToRedis(); err != nil {
				log.Printf("❌ Error saving to Redis: %v", err)
			}
		case <-stopChan:
			log.Println("🛑 Stopping periodic save...")
			// Final save before shutdown
			if err := saveToRedis(); err != nil {
				log.Printf("❌ Error in final save to Redis: %v", err)
			}
			return
		}
	}
}

// Rate limiting check
func checkRateLimit(ip string) bool {
	storage.mu.Lock()
	defer storage.mu.Unlock()

	lastClick, exists := storage.lastClickIP[ip]
	now := time.Now()

	if exists && now.Sub(lastClick) < rateLimitTime {
		return false
	}

	storage.lastClickIP[ip] = now
	return true
}

// Increment country clicks
func incrementClicks(country string, clicks int64) {
	storage.mu.Lock()
	defer storage.mu.Unlock()
	storage.countryClicks[country] += clicks
	storage.dirty = true // Mark data as changed
}

// Get leaderboard
func getLeaderboard() LeaderboardResponse {
	storage.mu.RLock()
	defer storage.mu.RUnlock()

	var totalClicks int64
	var result LeaderboardResponse

	for country, clicks := range storage.countryClicks {
		totalClicks += clicks
		result = append(result, CountryStats{
			Country: country,
			Clicks:  clicks,
		})
	}

	// Sort by clicks descending
	sort.Slice(result, func(i, j int) bool {
		return result[i].Clicks > result[j].Clicks
	})

	// Calculate KPS (kicks per second) for worldwide
	elapsed := time.Since(storage.startTime).Seconds()
	kps := 0.0
	if elapsed > 0 {
		kps = float64(totalClicks) / elapsed
	}

	// Prepend worldwide stats
	worldwide := CountryStats{
		Country: "Worldwide",
		Clicks:  totalClicks,
		KPS:     kps,
	}

	return append(LeaderboardResponse{worldwide}, result...)
}

// Get client IP
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header (for proxies)
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" {
		parts := strings.Split(forwarded, ",")
		return strings.TrimSpace(parts[0])
	}

	// Check X-Real-IP header
	realIP := r.Header.Get("X-Real-IP")
	if realIP != "" {
		return realIP
	}

	// Fall back to RemoteAddr
	return strings.Split(r.RemoteAddr, ":")[0]
}

// Handler: Submit click
func handleClick(w http.ResponseWriter, r *http.Request) {
	// Rate limiting
	clientIP := getClientIP(r)
	if !checkRateLimit(clientIP) {
		http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
		return
	}

	// Parse request body
	var payload ClickPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate payload
	if payload.Country == "" {
		payload.Country = "Unknown"
	}
	if payload.Clicks < 1 {
		payload.Clicks = 1
	}
	if payload.Clicks > 10 {
		payload.Clicks = 10 // Max clicks per request
	}

	// Increment clicks
	incrementClicks(payload.Country, int64(payload.Clicks))

	// Response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// Handler: Submit score
func handleScore(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var payload ScorePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Log high scores (could store in database)
	if payload.Score > 100 {
		log.Printf("High score: %d from %s", payload.Score, payload.Country)
	}

	// Response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// Handler: Get leaderboard
func handleLeaderboard(w http.ResponseWriter, r *http.Request) {
	leaderboard := getLeaderboard()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(leaderboard)
}

// Handler: Health check
func handleHealth(w http.ResponseWriter, r *http.Request) {
	// Check Redis connection
	redisStatus := "connected"
	if err := redisClient.Ping(ctx).Err(); err != nil {
		redisStatus = "disconnected"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "healthy",
		"redis":  redisStatus,
	})
}

func main() {
	// Initialize Redis
	if err := initRedis(); err != nil {
		log.Printf("⚠️  Warning: Redis not available: %v", err)
		log.Println("📝 Running in memory-only mode (data will not persist)")
	} else {
		// Load existing data from Redis
		if err := loadFromRedis(); err != nil {
			log.Printf("⚠️  Warning: Failed to load from Redis: %v", err)
		}

		// Start periodic save goroutine
		stopChan := make(chan struct{})
		go startPeriodicSave(stopChan)

		// Handle graceful shutdown
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

		go func() {
			<-sigChan
			log.Println("\n🛑 Received shutdown signal...")
			close(stopChan)
			
			// Final save
			if err := saveToRedis(); err != nil {
				log.Printf("❌ Error in final save: %v", err)
			} else {
				log.Println("✅ Data saved successfully")
			}
			
			// Close Redis connection
			if redisClient != nil {
				redisClient.Close()
			}
			
			os.Exit(0)
		}()
	}

	router := mux.NewRouter()

	// API routes
	api := router.PathPrefix("/api").Subrouter()
	api.HandleFunc("/click", handleClick).Methods("POST")
	api.HandleFunc("/score", handleScore).Methods("POST")
	api.HandleFunc("/leaderboard", handleLeaderboard).Methods("GET")
	api.HandleFunc("/health", handleHealth).Methods("GET")

	// CORS configuration
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"}, // Configure for your domain in production
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type"},
		AllowCredentials: false,
		MaxAge:           86400,
	})

	handler := c.Handler(router)

	// Start server
	addr := fmt.Sprintf(":%s", port)
	log.Printf("🚀 Football Game Backend starting on %s", addr)
	log.Printf("📊 Leaderboard: http://localhost%s/api/leaderboard", addr)
	log.Printf("❤️  Health check: http://localhost%s/api/health", addr)
	log.Printf("💾 Data saves to Redis every %v", saveInterval)

	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal(err)
	}
}
