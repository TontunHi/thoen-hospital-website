package ratelimit

import (
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

type clock struct {
	mu sync.Mutex
	t  time.Time
}

func (c *clock) now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.t
}

func (c *clock) advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.t = c.t.Add(d)
}

var rule = Rule{Key: "health-check", Max: 3, Window: time.Minute}

func TestCheckWindow(t *testing.T) {
	c := &clock{t: time.UnixMilli(1_700_000_000_000)}
	l := New(c.now, false)

	for i, wantRemaining := range []int{2, 1, 0} {
		d := l.Check(rule, "10.0.0.1")
		if !d.Allowed || d.Remaining != wantRemaining {
			t.Fatalf("call %d: %+v, want allowed with %d remaining", i+1, d, wantRemaining)
		}
	}

	c.advance(1500 * time.Millisecond)
	d := l.Check(rule, "10.0.0.1")
	if d.Allowed {
		t.Fatal("4th call inside the window must be blocked")
	}
	if d.RetryAfter != 59 { // 58.5s left, rounded up
		t.Errorf("RetryAfter = %d, want 59", d.RetryAfter)
	}
	if got, want := d.ResetAt.UnixMilli(), int64(1_700_000_060_000); got != want {
		t.Errorf("ResetAt = %d, want %d", got, want)
	}

	if d := l.Check(rule, "10.0.0.2"); !d.Allowed {
		t.Error("another client must have its own window")
	}

	// The window ends strictly after resetAt, as in Node (now > resetTime).
	c.advance(58500 * time.Millisecond)
	if d := l.Check(rule, "10.0.0.1"); d.Allowed {
		t.Error("exactly at resetAt the window is still open")
	}
	c.advance(time.Millisecond)
	if d := l.Check(rule, "10.0.0.1"); !d.Allowed || d.Remaining != 2 {
		t.Errorf("after the window: %+v, want a fresh window", d)
	}
}

func TestDisabledAllowsEverything(t *testing.T) {
	l := New(time.Now, true)
	for range 100 {
		if d := l.Check(rule, "10.0.0.1"); !d.Allowed || d.Remaining != rule.Max {
			t.Fatalf("disabled limiter returned %+v", d)
		}
	}
}

func TestCleanupDropsExpiredEntries(t *testing.T) {
	c := &clock{t: time.UnixMilli(1_700_000_000_000)}
	l := New(c.now, false)
	l.Check(rule, "10.0.0.1")
	l.Check(rule, "10.0.0.2")

	c.advance(6 * time.Minute)
	l.Check(rule, "10.0.0.3")

	l.mu.Lock()
	defer l.mu.Unlock()
	if len(l.entries) != 1 {
		t.Errorf("entries = %d, want only the live one", len(l.entries))
	}
}

func TestConcurrentChecksCountExactly(t *testing.T) {
	l := New(time.Now, false)
	r := Rule{Key: "k", Max: 50, Window: time.Minute}
	var wg sync.WaitGroup
	var mu sync.Mutex
	allowed := 0
	for range 200 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if l.Check(r, "10.0.0.1").Allowed {
				mu.Lock()
				allowed++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	if allowed != 50 {
		t.Errorf("allowed = %d, want 50", allowed)
	}
}

func TestClientIP(t *testing.T) {
	tests := []struct {
		name, forwarded, realIP, want string
	}{
		{"first forwarded entry", "203.0.113.7, 10.0.0.1", "10.9.9.9", "203.0.113.7"},
		{"single forwarded entry", " 203.0.113.7 ", "", "203.0.113.7"},
		{"real ip fallback", "", " 198.51.100.4 ", "198.51.100.4"},
		{"unknown", "", "", "unknown"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := httptest.NewRequest("GET", "/api/health", nil)
			if tt.forwarded != "" {
				r.Header.Set("X-Forwarded-For", tt.forwarded)
			}
			if tt.realIP != "" {
				r.Header.Set("X-Real-IP", tt.realIP)
			}
			if got := ClientIP(r); got != tt.want {
				t.Errorf("ClientIP = %q, want %q", got, tt.want)
			}
		})
	}
}
