package database

import (
	"context"
	"fmt"
	"log"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"
	"thoen-hospital-backend/internal/config"
)

type HosxpDB struct {
	*sqlx.DB
}

func InitHosxpDB(cfg *config.Config) (*HosxpDB, error) {
	dsn := cfg.HosxpDSN()
	db, err := sqlx.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open HOSxP database: %w", err)
	}

	// Connection Pool Optimization (Prevents HOSxP DB exhaustion)
	db.SetMaxOpenConns(15)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	db.SetConnMaxIdleTime(1 * time.Minute)

	// Quick non-blocking ping with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		log.Printf("[WARNING] HOSxP ping failed (%s:%d): %v (will retry on incoming requests)", cfg.HosxpHost, cfg.HosxpPort, err)
	} else {
		log.Printf("[INFO] Connected to HOSxP Database successfully (%s:%d/%s)", cfg.HosxpHost, cfg.HosxpPort, cfg.HosxpDatabase)
	}

	return &HosxpDB{db}, nil
}
