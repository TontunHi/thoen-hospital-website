// Package ratelimit is a fixed-window, in-memory, per-process rate limiter
// that behaves like src/lib/rateLimit.ts in the Node service.
package ratelimit

import (
	"net/http"
	"strings"
	"sync"
	"time"
)

const cleanupInterval = 5 * time.Minute

// Rule is one limiter: Max requests per Window, keyed by Key and client IP.
type Rule struct {
	Key    string
	Max    int
	Window time.Duration
}

// Decision is the outcome of one check.
type Decision struct {
	Allowed    bool
	Limit      int
	Remaining  int
	ResetAt    time.Time
	RetryAfter int // whole seconds, rounded up; set only when blocked
}

type entry struct {
	count   int
	resetAt time.Time
}

// Limiter is safe for concurrent use.
type Limiter struct {
	now      func() time.Time
	disabled bool

	mu          sync.Mutex
	entries     map[string]entry
	lastCleanup time.Time
}

// New returns a limiter. When disabled it allows everything, which is what
// the Node service does in development.
func New(now func() time.Time, disabled bool) *Limiter {
	return &Limiter{now: now, disabled: disabled, entries: make(map[string]entry), lastCleanup: now()}
}

// Check counts one request for rule and clientIP.
func (l *Limiter) Check(rule Rule, clientIP string) Decision {
	now := l.now()
	if l.disabled {
		return Decision{Allowed: true, Limit: rule.Max, Remaining: rule.Max, ResetAt: now.Add(rule.Window)}
	}

	l.mu.Lock()
	defer l.mu.Unlock()
	l.cleanup(now)

	key := rule.Key + ":" + clientIP
	e, ok := l.entries[key]
	if !ok || now.After(e.resetAt) {
		e = entry{resetAt: now.Add(rule.Window)}
	}
	e.count++
	l.entries[key] = e

	if e.count > rule.Max {
		left := e.resetAt.Sub(now)
		retry := int(left / time.Second)
		if left%time.Second != 0 {
			retry++
		}
		return Decision{Limit: rule.Max, ResetAt: e.resetAt, RetryAfter: retry}
	}
	return Decision{Allowed: true, Limit: rule.Max, Remaining: rule.Max - e.count, ResetAt: e.resetAt}
}

// cleanup drops expired entries so the map cannot grow without bound.
func (l *Limiter) cleanup(now time.Time) {
	if now.Sub(l.lastCleanup) < cleanupInterval {
		return
	}
	l.lastCleanup = now
	for k, e := range l.entries {
		if now.After(e.resetAt) {
			delete(l.entries, k)
		}
	}
}

// ClientIP resolves the caller the way the Node service does: first
// X-Forwarded-For entry, then X-Real-IP, then "unknown". IIS sets
// X-Forwarded-For in front of both services.
func ClientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		first, _, _ := strings.Cut(fwd, ",")
		return strings.TrimSpace(first)
	}
	if real := strings.TrimSpace(r.Header.Get("X-Real-IP")); real != "" {
		return real
	}
	return "unknown"
}
