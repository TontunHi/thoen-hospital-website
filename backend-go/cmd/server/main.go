package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"thoen-hospital-backend/internal/cache"
	"thoen-hospital-backend/internal/config"
	"thoen-hospital-backend/internal/database"
	"thoen-hospital-backend/internal/handlers"
	"thoen-hospital-backend/internal/middleware"
)

func main() {
	log.Println("[STARTING] Thoen Hospital High-Performance Go Backend Service...")

	// 1. Load Configuration
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("[FATAL] Failed to load configuration: %v", err)
	}

	gin.SetMode(cfg.GinMode)

	// 2. Connect to HOSxP Database Pool
	hosxpDB, err := database.InitHosxpDB(cfg)
	if err != nil {
		log.Fatalf("[FATAL] Database initialization failed: %v", err)
	}
	defer hosxpDB.Close()

	// 3. Initialize In-Memory Cache
	memCache := cache.NewMemoryCache()

	// 4. Initialize Handlers
	erHandler := handlers.NewERHandler(hosxpDB, memCache)
	labTrackerHandler := handlers.NewLabTrackerHandler(hosxpDB)

	// 5. Setup Gin Router
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(gin.Logger())

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"service":   "thoen-hospital-go-backend",
			"timestamp": time.Now().Format(time.RFC3339),
		})
	})

	// API Routes (Identical paths to Next.js for seamless Strangler Fig proxying)
	api := r.Group("/api")
	{
		// ER Status API (Optional auth, public for TV mode)
		api.GET("/er/status", middleware.OptionalAuth(cfg), erHandler.GetStatus)

		// Lab Tracker APIs (Staff authenticated)
		labTracker := api.Group("/service/lab-tracker")
		labTracker.Use(middleware.RequireAuth(cfg))
		{
			labTracker.GET("/report", labTrackerHandler.GetReport)
			labTracker.GET("/doctors", labTrackerHandler.GetDoctors)
			labTracker.GET("/detail", labTrackerHandler.GetDetail)
		}
	}

	// 6. Graceful Server Startup & Shutdown
	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("[INFO] Go Backend listening on port :%s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("[FATAL] Server listen failed: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("[INFO] Shutting down server gracefully...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("[FATAL] Server forced to shutdown: %v", err)
	}

	log.Println("[INFO] Server exited successfully.")
}
