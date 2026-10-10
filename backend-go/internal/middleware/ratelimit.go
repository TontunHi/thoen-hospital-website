package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type clientRecord struct {
	count      int
	windowOpen time.Time
}

type IPRateLimiter struct {
	mu            sync.Mutex
	clients       map[string]*clientRecord
	maxAttempts   int
	windowSeconds time.Duration
}

func NewIPRateLimiter(maxAttempts int, windowSeconds time.Duration) *IPRateLimiter {
	limiter := &IPRateLimiter{
		clients:       make(map[string]*clientRecord),
		maxAttempts:   maxAttempts,
		windowSeconds: windowSeconds,
	}

	// Periodic cleanup of stale IP records every 5 minutes
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		for range ticker.C {
			limiter.cleanup()
		}
	}()

	return limiter
}

func (l *IPRateLimiter) cleanup() {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	for ip, record := range l.clients {
		if now.Sub(record.windowOpen) > l.windowSeconds {
			delete(l.clients, ip)
		}
	}
}

func (l *IPRateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		now := time.Now()

		l.mu.Lock()
		record, exists := l.clients[ip]
		if !exists || now.Sub(record.windowOpen) > l.windowSeconds {
			l.clients[ip] = &clientRecord{
				count:      1,
				windowOpen: now,
			}
			l.mu.Unlock()
			c.Next()
			return
		}

		if record.count >= l.maxAttempts {
			l.mu.Unlock()
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "คุณสืบค้นข้อมูลเกินจำนวนครั้งที่กำหนด กรุณารอ 15 นาทีแล้วลองใหม่อีกครั้ง",
			})
			return
		}

		record.count++
		l.mu.Unlock()
		c.Next()
	}
}
