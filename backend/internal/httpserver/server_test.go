package httpserver

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
)

func newTestServer(health http.HandlerFunc) http.Handler {
	return New(Routes{Health: health}, slog.New(slog.NewTextHandler(io.Discard, nil)))
}

func ok(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"status":"healthy"}`))
}

// Routing is tested over a real connection so HEAD behaves as it does in
// production: net/http drops the body, a ResponseRecorder would not.
func TestRouting(t *testing.T) {
	srv := httptest.NewServer(newTestServer(ok))
	defer srv.Close()

	tests := []struct {
		name, method, path string
		wantStatus         int
		wantBody           string
	}{
		{"GET health", http.MethodGet, "/api/health", 200, `{"status":"healthy"}`},
		{"HEAD health has no body", http.MethodHead, "/api/health", 200, ""},
		{"POST health is not allowed", http.MethodPost, "/api/health", 405, ""},
		{"unknown path", http.MethodGet, "/api/nope", 404, "404 page not found\n"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := http.NewRequest(tt.method, srv.URL+tt.path, nil)
			if err != nil {
				t.Fatal(err)
			}
			resp, err := srv.Client().Do(req)
			if err != nil {
				t.Fatal(err)
			}
			defer resp.Body.Close()
			body, err := io.ReadAll(resp.Body)
			if err != nil {
				t.Fatal(err)
			}
			if resp.StatusCode != tt.wantStatus {
				t.Errorf("status = %d, want %d", resp.StatusCode, tt.wantStatus)
			}
			if got := string(body); got != tt.wantBody {
				t.Errorf("body = %q, want %q", got, tt.wantBody)
			}
		})
	}
}

func TestSecurityHeadersOnEveryResponse(t *testing.T) {
	for _, path := range []string{"/api/health", "/api/nope"} {
		w := httptest.NewRecorder()
		newTestServer(ok).ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
		for k, want := range securityHeaderValues {
			if got := w.Header().Get(k); got != want {
				t.Errorf("%s: %s = %q, want %q", path, k, got, want)
			}
		}
	}
}

func TestPanicBecomes500WithoutDetails(t *testing.T) {
	boom := func(http.ResponseWriter, *http.Request) { panic("patient HN 123456 leaked") }
	w := httptest.NewRecorder()
	newTestServer(boom).ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/health", nil))

	if w.Code != 500 {
		t.Fatalf("status = %d, want 500", w.Code)
	}
	if got, want := w.Body.String(), `{"error":"Internal server error"}`; got != want {
		t.Errorf("body = %q, want %q", got, want)
	}
}
