package middleware

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func createTestToken(payload MemberSession, secret string) string {
	rawJSON, _ := json.Marshal(payload)
	encoded := base64.RawURLEncoding.EncodeToString(rawJSON)

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(encoded))
	sig := hex.EncodeToString(mac.Sum(nil))

	return encoded + "." + sig
}

func TestVerifyMemberToken(t *testing.T) {
	secret := "test_secret_key_minimum_32_characters_long"

	t.Run("valid token", func(t *testing.T) {
		now := time.Now().UnixMilli()
		payload := MemberSession{
			Username: "doctor1",
			Email:    "doctor1@thoen.moph.go.th",
			Role:     "doctor",
			Aud:      "member",
			Iat:      now,
			Exp:      now + 1800*1000,
		}
		token := createTestToken(payload, secret)

		session := VerifyMemberToken(token, secret)
		if session == nil {
			t.Fatalf("expected valid session, got nil")
		}
		if session.Username != "doctor1" || session.Role != "doctor" {
			t.Errorf("unexpected payload: %+v", session)
		}
	})

	t.Run("expired token", func(t *testing.T) {
		now := time.Now().UnixMilli()
		payload := MemberSession{
			Username: "doctor1",
			Email:    "doctor1@thoen.moph.go.th",
			Role:     "doctor",
			Aud:      "member",
			Iat:      now - 3600*1000,
			Exp:      now - 1000, // Expired 1 second ago
		}
		token := createTestToken(payload, secret)

		session := VerifyMemberToken(token, secret)
		if session != nil {
			t.Fatalf("expected nil for expired token, got session")
		}
	})

	t.Run("tampered signature", func(t *testing.T) {
		now := time.Now().UnixMilli()
		payload := MemberSession{
			Username: "doctor1",
			Email:    "doctor1@thoen.moph.go.th",
			Role:     "doctor",
			Aud:      "member",
			Iat:      now,
			Exp:      now + 1800*1000,
		}
		token := createTestToken(payload, secret)
		tamperedToken := token + "bad"

		session := VerifyMemberToken(tamperedToken, secret)
		if session != nil {
			t.Fatalf("expected nil for tampered token, got session")
		}
	})

	t.Run("wrong secret", func(t *testing.T) {
		now := time.Now().UnixMilli()
		payload := MemberSession{
			Username: "doctor1",
			Email:    "doctor1@thoen.moph.go.th",
			Role:     "doctor",
			Aud:      "member",
			Iat:      now,
			Exp:      now + 1800*1000,
		}
		token := createTestToken(payload, secret)

		session := VerifyMemberToken(token, "wrong_secret_key")
		if session != nil {
			t.Fatalf("expected nil for wrong secret, got session")
		}
	})

	t.Run("wrong audience", func(t *testing.T) {
		now := time.Now().UnixMilli()
		payload := MemberSession{
			Username: "doctor1",
			Email:    "doctor1@thoen.moph.go.th",
			Role:     "doctor",
			Aud:      "admin_portal", // not 'member'
			Iat:      now,
			Exp:      now + 1800*1000,
		}
		token := createTestToken(payload, secret)

		session := VerifyMemberToken(token, secret)
		if session != nil {
			t.Fatalf("expected nil for non-member audience, got session")
		}
	})
}

func TestForbidRole(t *testing.T) {
	forbidSubdistrict := ForbidRole("subdistrict")

	t.Run("subdistrict role blocked", func(t *testing.T) {
		session := &MemberSession{Username: "sub1", Role: "subdistrict"}
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("memberSession", session)

		forbidSubdistrict(c)

		if w.Code != http.StatusForbidden {
			t.Errorf("expected 403 Forbidden, got %d", w.Code)
		}
	})

	t.Run("doctor role allowed", func(t *testing.T) {
		session := &MemberSession{Username: "doc1", Role: "doctor"}
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("memberSession", session)

		forbidSubdistrict(c)

		if w.Code == http.StatusForbidden {
			t.Errorf("expected doctor role to pass, but got 403")
		}
	})
}

