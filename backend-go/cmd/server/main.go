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
	appointHandler := handlers.NewAppointmentHandler(hosxpDB)
	loratadineHandler := handlers.NewLoratadineHandler(hosxpDB)
	streamHandler := handlers.NewStreamHandler()
	clinicalLabHandler := handlers.NewClinicalLabHandler(hosxpDB)
	wardHandler := handlers.NewWardHandler(hosxpDB, memCache)
	drugStatusHandler := handlers.NewDrugStatusHandler(hosxpDB, memCache)

	// Rate limiter for appointment checks: max 30 attempts per 15 minutes per IP
	appointLimiter := middleware.NewIPRateLimiter(30, 15*time.Minute)

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
		// Public: Doctor Appointment Search (with IP rate limiting & PDPA masking)
		api.GET("/appointment", appointLimiter.Middleware(), appointHandler.Search)

		// Public/Zero-copy: Video and media streaming with HTTP 206 Partial Content
		api.GET("/stream", streamHandler.ServeStream)

		// ER Status API (Optional auth, public for TV mode)
		api.GET("/er/status", middleware.OptionalAuth(cfg), erHandler.GetStatus)

		// Loratadine Dispensing Monitor (Staff authenticated)
		api.GET("/service/loratadine-dispense", middleware.RequireAuth(cfg), loratadineHandler.GetDispenseSummary)

		// Clinical Lab Search & Visit Details (Staff authenticated)
		api.POST("/service/lab/search", middleware.RequireAuth(cfg), clinicalLabHandler.Search)
		api.GET("/service/lab/detail", middleware.RequireAuth(cfg), clinicalLabHandler.GetDetail)

		// Lab Tracker APIs (Staff authenticated)
		labTracker := api.Group("/service/lab-tracker")
		labTracker.Use(middleware.RequireAuth(cfg))
		{
			labTracker.GET("/report", labTrackerHandler.GetReport)
			labTracker.GET("/doctors", labTrackerHandler.GetDoctors)
			labTracker.GET("/detail", labTrackerHandler.GetDetail)
		}

		// IPD Ward Status & Bed Occupancy (Member authenticated)
		api.GET("/service/ward-status", middleware.RequireMemberSession(cfg), wardHandler.GetWardStatus)
		api.GET("/service/bed-occupancy", middleware.RequireMemberSession(cfg), middleware.ForbidRole("subdistrict"), wardHandler.GetBedOccupancy)

		// Drug Dispensing Queue & Appointment Mismatch (Member authenticated)
		api.GET("/service/status-drug", middleware.RequireMemberSession(cfg), drugStatusHandler.GetDrugStatus)
		api.GET("/service/appointment-mismatch", middleware.RequireMemberSession(cfg), middleware.ForbidRole("subdistrict"), drugStatusHandler.GetAppointmentMismatch)

		// Systems Public Summary & Operating Room Status (Cached)
		api.GET("/systems/ward-status", wardHandler.GetWardSummary)
		api.GET("/systems/status-or", wardHandler.GetOrRoomStatus)
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
