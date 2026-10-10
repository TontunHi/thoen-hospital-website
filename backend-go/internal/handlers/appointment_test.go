package handlers

import (
	"strings"
	"testing"
)

func TestMaskThaiPatientName(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "empty input",
			input:    "",
			expected: "ผู้รับบริการ",
		},
		{
			name:     "single name with Mr prefix",
			input:    "นาย สมชาย ใจดี",
			expected: "นาย สมช** ใจ**",
		},
		{
			name:     "long name with Mrs prefix",
			input:    "นางสาว วิภาวดี รักสงบ",
			expected: "นางสาว วิภา** รัก***",
		},
		{
			name:     "Dr prefix",
			input:    "พญ. สุดา สุขสันต์",
			expected: "พญ. สุ** สุข***",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := MaskThaiPatientName(tt.input)
			if actual == "" {
				t.Errorf("expected non-empty masked name")
			}
			// Must contain star mask for privacy
			if tt.input != "" && !strings.Contains(actual, "*") {
				t.Errorf("expected masked name to contain '*', got %q", actual)
			}
		})
	}
}
