package health

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/TontunHi/thoen-hospital-website/backend/internal/ratelimit"
)

type probeFunc func(ctx context.Context) error

func (f probeFunc) Check(ctx context.Context) error { return f(ctx) }

var (
	up   = probeFunc(func(context.Context) error { return nil })
	down = probeFunc(func(context.Context) error { return errors.New("connection refused") })
)

var fixedNow = time.Date(2026, 10, 8, 15, 4, 5, 678_000_000, time.UTC)

func newChecker(primary, hosxp, salary Prober) *Checker {
	return &Checker{
		Primary: primary, HOSxP: hosxp, Salary: salary,
		Environment:  "production",
		ProbeTimeout: time.Second,
		Now:          func() time.Time { return fixedNow },
		StartedAt:    fixedNow.Add(-90*time.Second - 400*time.Millisecond),
	}
}

func quiet() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

func serve(h http.Handler, ip string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	r.Header.Set("X-Forwarded-For", ip)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func TestStatusRules(t *testing.T) {
	tests := []struct {
		name                   string
		primary, hosxp, salary Prober
		wantStatus             string
		wantHTTP               int
	}{
		{"all up", up, up, up, Healthy, 200},
		{"hosxp down", up, down, up, Degraded, 200},
		{"salary down", up, up, down, Degraded, 200},
		{"both read-only down", up, down, down, Degraded, 200},
		{"primary down", down, up, up, Unhealthy, 503},
		{"everything down", down, down, down, Unhealthy, 503},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := Handler(newChecker(tt.primary, tt.hosxp, tt.salary), ratelimit.New(time.Now, false), quiet())
			w := serve(h, "10.0.0.1")

			if w.Code != tt.wantHTTP {
				t.Errorf("HTTP status = %d, want %d", w.Code, tt.wantHTTP)
			}
			var got Report
			if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
				t.Fatalf("body is not JSON: %v", err)
			}
			if got.Status != tt.wantStatus {
				t.Errorf("status = %q, want %q", got.Status, tt.wantStatus)
			}
		})
	}
}

// The exact bytes are the contract: field names, order and formats must match
// what the Node route returns.
func TestResponseContract(t *testing.T) {
	h := Handler(newChecker(up, down, up), ratelimit.New(time.Now, false), quiet())
	w := serve(h, "10.0.0.1")

	const want = `{"status":"degraded","timestamp":"2026-10-08T15:04:05.678Z","uptimeSeconds":90,"environment":"production",` +
		`"services":{"primaryDatabase":{"status":"UP","latencyMs":0},` +
		`"hosxpReplicaDatabase":{"status":"DOWN","latencyMs":0,"error":"connection refused"},` +
		`"salaryDatabase":{"status":"UP","latencyMs":0}}}`
	if got := w.Body.String(); got != want {
		t.Errorf("body mismatch\n got: %s\nwant: %s", got, want)
	}
	if got := w.Header().Get("Content-Type"); got != "application/json" {
		t.Errorf("Content-Type = %q", got)
	}
	if got := w.Header().Get("Cache-Control"); got != "no-store, no-cache, must-revalidate" {
		t.Errorf("Cache-Control = %q", got)
	}
}

func TestRateLimited(t *testing.T) {
	now := time.UnixMilli(1_700_000_000_000)
	limiter := ratelimit.New(func() time.Time { return now }, false)
	h := Handler(newChecker(up, up, up), limiter, quiet())

	for i := range 60 {
		if w := serve(h, "10.0.0.1"); w.Code != 200 {
			t.Fatalf("call %d: status %d", i+1, w.Code)
		}
	}
	w := serve(h, "10.0.0.1")
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("61st call: status %d, want 429", w.Code)
	}
	const wantBody = `{"error":"คำขอมากเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง","retryAfterSeconds":60}`
	if got := w.Body.String(); got != wantBody {
		t.Errorf("body mismatch\n got: %s\nwant: %s", got, wantBody)
	}
	for k, want := range map[string]string{
		"Retry-After":           "60",
		"X-RateLimit-Limit":     "60",
		"X-RateLimit-Remaining": "0",
		"X-RateLimit-Reset":     "1700000060000",
		"Content-Type":          "application/json",
	} {
		if got := w.Header().Get(k); got != want {
			t.Errorf("%s = %q, want %q", k, got, want)
		}
	}
	if w := serve(h, "10.0.0.2"); w.Code != 200 {
		t.Errorf("a different client was limited: status %d", w.Code)
	}
}

func TestDevelopmentBypassesRateLimit(t *testing.T) {
	h := Handler(newChecker(up, up, up), ratelimit.New(time.Now, true), quiet())
	for i := range 100 {
		if w := serve(h, "10.0.0.1"); w.Code != 200 {
			t.Fatalf("call %d: status %d", i+1, w.Code)
		}
	}
}

func TestProbesRunInParallelAndRespectTimeout(t *testing.T) {
	hang := probeFunc(func(ctx context.Context) error {
		<-ctx.Done()
		return ctx.Err()
	})
	c := newChecker(hang, hang, hang)
	c.Now = time.Now
	c.StartedAt = time.Now()
	c.ProbeTimeout = 100 * time.Millisecond

	start := time.Now()
	report := c.Check(context.Background())
	elapsed := time.Since(start)

	if elapsed > 250*time.Millisecond {
		t.Errorf("three hanging probes took %v; they must run in parallel under one timeout", elapsed)
	}
	if report.Status != Unhealthy {
		t.Errorf("status = %q, want unhealthy", report.Status)
	}
	for name, s := range map[string]ServiceCheck{
		"primary": report.Services.PrimaryDatabase,
		"hosxp":   report.Services.HOSxPReplicaDatabase,
		"salary":  report.Services.SalaryDatabase,
	} {
		if s.Status != "DOWN" || !strings.Contains(s.Error, "deadline exceeded") {
			t.Errorf("%s = %+v, want DOWN with a deadline error", name, s)
		}
	}
}

func TestCancelledRequestStopsProbes(t *testing.T) {
	seen := make(chan error, 3)
	wait := probeFunc(func(ctx context.Context) error {
		<-ctx.Done()
		seen <- ctx.Err()
		return ctx.Err()
	})
	c := newChecker(wait, wait, wait)
	c.ProbeTimeout = time.Minute

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	c.Check(ctx)

	for range 3 {
		if err := <-seen; !errors.Is(err, context.Canceled) {
			t.Errorf("probe saw %v, want context.Canceled", err)
		}
	}
}

func BenchmarkHandlerHealthy(b *testing.B) {
	h := Handler(newChecker(up, up, up), ratelimit.New(time.Now, true), quiet())
	r := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	b.ReportAllocs()
	b.ResetTimer()
	for b.Loop() {
		h.ServeHTTP(httptest.NewRecorder(), r)
	}
}
