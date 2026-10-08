// Package httpserver wires routes and cross-cutting middleware.
package httpserver

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/TontunHi/thoen-hospital-website/backend/internal/httpjson"
)

// Routes are the handlers this service owns. Each one replaces the Node
// route at the same path once IIS sends that path here.
type Routes struct {
	Health http.HandlerFunc
}

// New builds the router.
func New(routes Routes, log *slog.Logger) http.Handler {
	r := chi.NewRouter()
	r.Use(recoverer(log))
	r.Use(securityHeaders)
	r.Use(middleware.GetHead)

	r.Get("/api/health", routes.Health)
	return r
}

// securityHeaderValues mirrors headers() in next.config.ts, which Next
// applies to every response including API routes. Keep the two in step.
var securityHeaderValues = map[string]string{
	"Strict-Transport-Security": "max-age=31536000; includeSubDomains",
	"X-Frame-Options":           "DENY",
	"X-Content-Type-Options":    "nosniff",
	"Referrer-Policy":           "strict-origin-when-cross-origin",
	"Content-Security-Policy": strings.Join([]string{
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
		"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
		"img-src 'self' data: blob: https:",
		"font-src 'self' https://fonts.gstatic.com",
		"frame-src 'self' https://app.powerbi.com https://*.moph.go.th https://www.youtube.com https://youtube.com https://docs.google.com https://www.facebook.com https://facebook.com https://www.google.com https://google.com",
		"connect-src 'self' ws: wss:",
		"media-src 'self' data: blob: https:",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'self'",
	}, "; "),
	"Permissions-Policy":     "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
	"X-DNS-Prefetch-Control": "on",
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		for k, v := range securityHeaderValues {
			h.Set(k, v)
		}
		next.ServeHTTP(w, r)
	})
}

// recoverer turns a panic into a 500 without leaking details to the client.
func recoverer(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					if rec == http.ErrAbortHandler {
						panic(rec)
					}
					log.ErrorContext(r.Context(), "handler panic", slog.Any("panic", rec), slog.String("path", r.URL.Path))
					httpjson.Write(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}
