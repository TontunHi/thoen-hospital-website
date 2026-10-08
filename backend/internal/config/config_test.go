package config

import (
	"strings"
	"testing"
	"time"
)

func env(m map[string]string) func(string) string {
	return func(k string) string { return m[k] }
}

func valid() map[string]string {
	return map[string]string{
		"BACKEND_ADDR":   "127.0.0.1:6061",
		"DATABASE_URL":   "mysql://app:p%40ss@db.internal:3307/website?charset=utf8mb4&connection_limit=5",
		"HOSXP_DB_HOST":  "hosxp.internal",
		"HOSXP_DB_USER":  "reader",
		"HOSXP_DB_NAME":  "hos",
		"SALARY_DB_HOST": "salary.internal",
		"SALARY_DB_USER": "reader",
		"SALARY_DB_NAME": "salary",
	}
}

func TestLoadValid(t *testing.T) {
	cfg, err := Load(env(valid()))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	want := DB{Host: "db.internal", Port: 3307, User: "app", Password: "p@ss", Name: "website", Charset: "utf8mb4", MaxConns: 10}
	if cfg.Primary != want {
		t.Errorf("Primary = %+v, want %+v", cfg.Primary, want)
	}
	if cfg.HOSxP.Port != 3306 || cfg.HOSxP.Charset != "tis620" || cfg.HOSxP.MaxConns != 15 {
		t.Errorf("HOSxP defaults = %+v", cfg.HOSxP)
	}
	if cfg.Salary.Charset != "tis620" || cfg.Salary.MaxConns != 10 {
		t.Errorf("Salary defaults = %+v", cfg.Salary)
	}
	if cfg.Environment != "production" || cfg.Development() {
		t.Errorf("Environment = %q", cfg.Environment)
	}
	if cfg.ProbeTimeout != 5*time.Second || cfg.ShutdownTimeout != 15*time.Second {
		t.Errorf("timeouts = %v, %v", cfg.ProbeTimeout, cfg.ShutdownTimeout)
	}
}

func TestLoadLegacyHOSxPFallback(t *testing.T) {
	m := valid()
	delete(m, "HOSXP_DB_HOST")
	delete(m, "HOSXP_DB_USER")
	delete(m, "HOSXP_DB_NAME")
	m["APPOINT_DB_HOST"] = "appoint.internal"
	m["ER_DB_USER"] = "er_reader"
	m["APPOINT_DB_NAME"] = "hos_legacy"
	m["ER_DB_PORT"] = "3310"

	cfg, err := Load(env(m))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.HOSxP.Host != "appoint.internal" || cfg.HOSxP.User != "er_reader" || cfg.HOSxP.Name != "hos_legacy" || cfg.HOSxP.Port != 3310 {
		t.Errorf("HOSxP = %+v", cfg.HOSxP)
	}
}

func TestLoadErrors(t *testing.T) {
	tests := []struct {
		name    string
		mutate  func(map[string]string)
		wantMsg string
	}{
		{"missing listen address", func(m map[string]string) { delete(m, "BACKEND_ADDR") }, "BACKEND_ADDR is required"},
		{"missing database url", func(m map[string]string) { delete(m, "DATABASE_URL") }, "DATABASE_URL is required"},
		{"wrong scheme", func(m map[string]string) { m["DATABASE_URL"] = "postgres://u:p@h/db" }, "DATABASE_URL must look like"},
		{"no database name", func(m map[string]string) { m["DATABASE_URL"] = "mysql://u:p@h:3306/" }, "DATABASE_URL must look like"},
		{"missing hosxp host", func(m map[string]string) { delete(m, "HOSXP_DB_HOST") }, "HOSXP_DB_HOST or APPOINT_DB_HOST or ER_DB_HOST is required"},
		{"missing salary user", func(m map[string]string) { delete(m, "SALARY_DB_USER") }, "SALARY_DB_USER is required"},
		{"bad port", func(m map[string]string) { m["SALARY_DB_PORT"] = "abc" }, "SALARY_DB_PORT must be a port number"},
		{"bad duration", func(m map[string]string) { m["BACKEND_DB_PROBE_TIMEOUT"] = "5" }, "BACKEND_DB_PROBE_TIMEOUT must be a positive duration"},
		{"bad pool size", func(m map[string]string) { m["BACKEND_HOSXP_DB_MAX_CONNS"] = "0" }, "BACKEND_HOSXP_DB_MAX_CONNS must be a positive integer"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := valid()
			tt.mutate(m)
			_, err := Load(env(m))
			if err == nil || !strings.Contains(err.Error(), tt.wantMsg) {
				t.Fatalf("err = %v, want containing %q", err, tt.wantMsg)
			}
		})
	}
}

func TestLoadReportsAllProblemsAndHidesPassword(t *testing.T) {
	m := valid()
	delete(m, "BACKEND_ADDR")
	delete(m, "SALARY_DB_HOST")
	m["DATABASE_URL"] = "mysql://app:topsecret@:3306/website"

	_, err := Load(env(m))
	if err == nil {
		t.Fatal("want error")
	}
	msg := err.Error()
	for _, want := range []string{"BACKEND_ADDR", "SALARY_DB_HOST", "DATABASE_URL"} {
		if !strings.Contains(msg, want) {
			t.Errorf("error %q does not mention %s", msg, want)
		}
	}
	if strings.Contains(msg, "topsecret") {
		t.Errorf("error leaks the database password: %q", msg)
	}
}
