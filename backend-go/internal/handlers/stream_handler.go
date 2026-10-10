package handlers

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

var allowedPrefixes = []string{
	"public/uploads",
	"public/documents",
	"storage",
}

type StreamHandler struct {
	baseDir string
}

func NewStreamHandler() *StreamHandler {
	// Find project root (either . or ..)
	base := "."
	if _, err := os.Stat("public"); os.IsNotExist(err) {
		if _, err := os.Stat("../public"); err == nil {
			base = ".."
		}
	}
	return &StreamHandler{baseDir: base}
}

func (h *StreamHandler) ServeStream(c *gin.Context) {
	rawPath := strings.TrimSpace(c.Query("path"))
	if rawPath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Path parameter is required"})
		return
	}

	// Normalize path
	cleanRel := filepath.ToSlash(filepath.Clean(rawPath))
	cleanRel = strings.TrimPrefix(cleanRel, "/")

	if strings.HasPrefix(cleanRel, "uploads/") || strings.HasPrefix(cleanRel, "documents/") {
		cleanRel = "public/" + cleanRel
	}

	// Check path traversal and whitelist
	isAllowed := false
	for _, prefix := range allowedPrefixes {
		if strings.HasPrefix(cleanRel, prefix) {
			isAllowed = true
			break
		}
	}

	if !isAllowed || strings.Contains(cleanRel, "..") {
		c.String(http.StatusForbidden, "Forbidden")
		return
	}

	fullPath := filepath.Join(h.baseDir, cleanRel)
	info, err := os.Stat(fullPath)
	if err != nil || info.IsDir() {
		c.String(http.StatusNotFound, "Not Found")
		return
	}

	// Set caching header
	c.Header("Cache-Control", "public, max-age=31536000, immutable")

	// http.ServeFile natively supports HTTP 206 Partial Content (Range requests)
	http.ServeFile(c.Writer, c.Request, fullPath)
}
