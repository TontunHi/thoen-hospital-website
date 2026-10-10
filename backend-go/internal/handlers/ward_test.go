package handlers

import (
	"testing"
)

func TestResolveWardGroupId(t *testing.T) {
	tests := []struct {
		name     string
		ward     string
		bedno    string
		expected string
	}{
		{"Ward 06 Bed 10", "06", "10", "w1"},
		{"Ward 06 Bed 1", "06", "1", "w1"},
		{"Ward 06 Bed 20", "06", "20", "w1"},
		{"Ward 06 Bed 21", "06", "21", "w2"},
		{"Ward 06 Bed 40", "06", "40", "w2"},
		{"Ward 06 Isolation Bed", "06", "Wย01", "w3"},
		{"Ward 05 ICU", "05", "1", "icu"},
		{"Ward 04 VIP", "04", "v01", "special"},
		{"Ward 02 Labor", "02", "C01", "lr"},
		{"Ward 09 Surgery", "09", "1", "surgery"},
		{"Unknown Ward", "99", "1", "other"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := resolveWardGroupId(tt.ward, tt.bedno)
			if got != tt.expected {
				t.Errorf("resolveWardGroupId(%q, %q) = %q; want %q", tt.ward, tt.bedno, got, tt.expected)
			}
		})
	}
}

func TestRound2(t *testing.T) {
	tests := []struct {
		input    float64
		expected float64
	}{
		{54.3456, 54.35},
		{54.3421, 54.34},
		{100.0, 100.0},
		{0.0, 0.0},
	}

	for _, tt := range tests {
		got := round2(tt.input)
		if got != tt.expected {
			t.Errorf("round2(%f) = %f; want %f", tt.input, got, tt.expected)
		}
	}
}
