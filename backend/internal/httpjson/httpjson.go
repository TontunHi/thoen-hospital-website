// Package httpjson writes JSON responses the way the Node service does.
package httpjson

import (
	"bytes"
	"encoding/json"
	"net/http"
	"sync"
)

var buffers = sync.Pool{New: func() any { return new(bytes.Buffer) }}

// Write encodes v and sends it with the given status. HTML escaping is off
// so the bytes match JSON.stringify, and there is no trailing newline.
func Write(w http.ResponseWriter, status int, v any) {
	buf := buffers.Get().(*bytes.Buffer)
	buf.Reset()
	defer buffers.Put(buf)

	enc := json.NewEncoder(buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	body := bytes.TrimSuffix(buf.Bytes(), []byte("\n"))

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(body)
}
