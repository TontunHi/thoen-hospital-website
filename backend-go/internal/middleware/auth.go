package middleware

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"thoen-hospital-backend/internal/config"
)

const (
	CookieName     = "member_session"
	AbsoluteMaxAge = 43200 * 1000 // 12 hours in milliseconds
)

type MemberSession struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	Aud      string `json:"aud"`
	Iat      int64  `json:"iat"`
	Exp      int64  `json:"exp"`
}

func VerifyMemberToken(token, secret string) *MemberSession {
	if token == "" || secret == "" {
		return nil
	}

	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return nil
	}

	encoded, signatureHex := parts[0], parts[1]

	// Compute expected HMAC-SHA256
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(encoded))
	expectedSignature := hex.EncodeToString(mac.Sum(nil))

	// Timing-safe comparison
	sigBytes, err1 := hex.DecodeString(signatureHex)
	expectedBytes, err2 := hex.DecodeString(expectedSignature)
	if err1 != nil || err2 != nil || !hmac.Equal(sigBytes, expectedBytes) {
		return nil
	}

	// Base64URL decode
	rawJSON, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		// Fallback to standard URL encoding with padding
		rawJSON, err = base64.URLEncoding.DecodeString(encoded)
		if err != nil {
			return nil
		}
	}

	var session MemberSession
	if err := json.Unmarshal(rawJSON, &session); err != nil {
		return nil
	}

	if session.Aud != "member" {
		return nil
	}

	nowMs := time.Now().UnixMilli()

	// Check 30-min expiration
	if session.Exp < nowMs {
		return nil
	}

	// Check 12-hour absolute session cap
	if session.Iat > 0 && (nowMs-session.Iat) > AbsoluteMaxAge {
		return nil
	}

	return &session
}

// OptionalAuth extracts member session from cookie if present without blocking
func OptionalAuth(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		cookie, err := c.Cookie(CookieName)
		if err == nil && cookie != "" {
			if session := VerifyMemberToken(cookie, cfg.MemberSessionSecret); session != nil {
				c.Set("memberSession", session)
			}
		}
		c.Next()
	}
}

// RequireAuth blocks request with 401 if valid session is not present
func RequireAuth(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		cookie, err := c.Cookie(CookieName)
		if err != nil || cookie == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "กรุณาเข้าสู่ระบบก่อนใช้งาน",
			})
			return
		}

		session := VerifyMemberToken(cookie, cfg.MemberSessionSecret)
		if session == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่",
			})
			return
		}

		c.Set("memberSession", session)
		c.Next()
	}
}
