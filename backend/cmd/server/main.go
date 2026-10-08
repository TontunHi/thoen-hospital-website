// Command server is the Go backend for the Thoen Hospital website.
package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/TontunHi/thoen-hospital-website/backend/internal/config"
	"github.com/TontunHi/thoen-hospital-website/backend/internal/health"
	"github.com/TontunHi/thoen-hospital-website/backend/internal/httpserver"
	"github.com/TontunHi/thoen-hospital-website/backend/internal/mysqldb"
	"github.com/TontunHi/thoen-hospital-website/backend/internal/ratelimit"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "fatal:", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		return err
	}
	log := newLogger(cfg.LogLevel)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pools := make([]*sql.DB, 0, 3)
	defer func() {
		for _, p := range pools {
			if err := p.Close(); err != nil {
				log.Error("closing database pool", slog.Any("error", err))
			}
		}
	}()
	open := func(c config.DB) (*sql.DB, error) {
		db, err := mysqldb.Open(c, cfg.ProbeTimeout)
		if err != nil {
			return nil, err
		}
		pools = append(pools, db)
		return db, nil
	}
	primary, err := open(cfg.Primary)
	if err != nil {
		return err
	}
	hosxp, err := open(cfg.HOSxP)
	if err != nil {
		return err
	}
	salary, err := open(cfg.Salary)
	if err != nil {
		return err
	}

	checker := &health.Checker{
		Primary:      mysqldb.Probe{DB: primary},
		HOSxP:        mysqldb.Probe{DB: hosxp},
		Salary:       mysqldb.Probe{DB: salary},
		Environment:  cfg.Environment,
		ProbeTimeout: cfg.ProbeTimeout,
		Now:          time.Now,
		StartedAt:    time.Now(),
	}
	limiter := ratelimit.New(time.Now, cfg.Development())

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           httpserver.New(httpserver.Routes{Health: health.Handler(checker, limiter, log)}, log),
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       120 * time.Second,
		BaseContext:       func(net.Listener) context.Context { return ctx },
	}

	serveErr := make(chan error, 1)
	go func() {
		log.Info("backend listening", slog.String("addr", cfg.Addr), slog.String("environment", cfg.Environment))
		serveErr <- srv.ListenAndServe()
	}()

	select {
	case err := <-serveErr:
		return fmt.Errorf("http server: %w", err)
	case <-ctx.Done():
		log.Info("shutdown signal received, draining requests")
	}

	// The signal context is already cancelled, so draining gets its own deadline.
	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("graceful shutdown: %w", err)
	}
	if err := <-serveErr; err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("http server: %w", err)
	}
	log.Info("backend stopped")
	return nil
}

func newLogger(level string) *slog.Logger {
	var lv slog.Level
	if err := lv.UnmarshalText([]byte(level)); err != nil {
		lv = slog.LevelInfo
	}
	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: lv}))
}
