package health

import (
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/TontunHi/thoen-hospital-website/backend/internal/httpjson"
	"github.com/TontunHi/thoen-hospital-website/backend/internal/ratelimit"
)

// Rule is the health check's rate limit: 60 calls per minute per client.
var Rule = ratelimit.Rule{Key: "health-check", Max: 60, Window: time.Minute}

type tooManyRequests struct {
	Error             string `json:"error"`
	RetryAfterSeconds int    `json:"retryAfterSeconds"`
}

// Handler serves GET /api/health.
func Handler(checker *Checker, limiter *ratelimit.Limiter, log *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		d := limiter.Check(Rule, ratelimit.ClientIP(r))
		if !d.Allowed {
			h := w.Header()
			h.Set("Retry-After", strconv.Itoa(d.RetryAfter))
			h.Set("X-RateLimit-Limit", strconv.Itoa(d.Limit))
			h.Set("X-RateLimit-Remaining", "0")
			h.Set("X-RateLimit-Reset", strconv.FormatInt(d.ResetAt.UnixMilli(), 10))
			httpjson.Write(w, http.StatusTooManyRequests, tooManyRequests{
				Error:             "คำขอมากเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง",
				RetryAfterSeconds: d.RetryAfter,
			})
			return
		}

		report := checker.Check(r.Context())
		if report.Status != Healthy {
			log.WarnContext(r.Context(), "System health check reported degraded or unhealthy services",
				slog.Any("health", report))
		}

		status := http.StatusOK
		if report.Status == Unhealthy {
			status = http.StatusServiceUnavailable
		}
		w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")
		httpjson.Write(w, status, report)
	}
}
