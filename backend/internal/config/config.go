// Package config loads all runtime settings from environment variables.
// Nothing here falls back to a host, credential or listen address: a missing
// required value stops the service at startup.
package config

import (
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// DB describes one MySQL connection pool.
type DB struct {
	Host     string
	Port     int
	User     string
	Password string
	Name     string
	Charset  string
	MaxConns int
}

// Config is the full service configuration.
type Config struct {
	Addr            string // listen address, e.g. 127.0.0.1:6061
	Environment     string // mirrors NODE_ENV so both services report the same value
	LogLevel        string
	ProbeTimeout    time.Duration
	ShutdownTimeout time.Duration
	Primary         DB
	HOSxP           DB
	Salary          DB
}

// Development reports whether rate limiting is bypassed, as it is in Node.
func (c Config) Development() bool { return c.Environment == "development" }

// Load reads configuration through getenv (os.Getenv in production).
func Load(getenv func(string) string) (Config, error) {
	l := loader{getenv: getenv}

	cfg := Config{
		Addr:            l.required("BACKEND_ADDR"),
		Environment:     l.optional("production", "NODE_ENV"),
		LogLevel:        l.optional("info", "LOG_LEVEL"),
		ProbeTimeout:    l.duration("BACKEND_DB_PROBE_TIMEOUT", 5*time.Second),
		ShutdownTimeout: l.duration("BACKEND_SHUTDOWN_TIMEOUT", 15*time.Second),
	}

	cfg.Primary = l.primary()
	cfg.HOSxP = DB{
		Host:     l.required("HOSXP_DB_HOST", "APPOINT_DB_HOST", "ER_DB_HOST"),
		Port:     l.port(3306, "HOSXP_DB_PORT", "APPOINT_DB_PORT", "ER_DB_PORT"),
		User:     l.required("HOSXP_DB_USER", "APPOINT_DB_USER", "ER_DB_USER"),
		Password: l.optional("", "HOSXP_DB_PASSWORD", "APPOINT_DB_PASSWORD", "ER_DB_PASSWORD"),
		Name:     l.required("HOSXP_DB_NAME", "APPOINT_DB_NAME", "ER_DB_NAME"),
		Charset:  l.optional("tis620", "HOSXP_DB_CHARSET", "APPOINT_DB_CHARSET", "ER_DB_CHARSET"),
		MaxConns: l.positiveInt("BACKEND_HOSXP_DB_MAX_CONNS", 15),
	}
	cfg.Salary = DB{
		Host:     l.required("SALARY_DB_HOST"),
		Port:     l.port(3306, "SALARY_DB_PORT"),
		User:     l.required("SALARY_DB_USER"),
		Password: l.optional("", "SALARY_DB_PASSWORD"),
		Name:     l.required("SALARY_DB_NAME"),
		Charset:  l.optional("tis620", "SALARY_DB_CHARSET"),
		MaxConns: l.positiveInt("BACKEND_SALARY_DB_MAX_CONNS", 10),
	}

	if len(l.errs) > 0 {
		return Config{}, fmt.Errorf("invalid configuration: %w", errors.Join(l.errs...))
	}
	return cfg, nil
}

type loader struct {
	getenv func(string) string
	errs   []error
}

func (l *loader) lookup(keys ...string) (string, bool) {
	for _, k := range keys {
		if v := strings.TrimSpace(l.getenv(k)); v != "" {
			return v, true
		}
	}
	return "", false
}

func (l *loader) required(keys ...string) string {
	v, ok := l.lookup(keys...)
	if !ok {
		l.errs = append(l.errs, fmt.Errorf("%s is required", strings.Join(keys, " or ")))
	}
	return v
}

func (l *loader) optional(def string, keys ...string) string {
	if v, ok := l.lookup(keys...); ok {
		return v
	}
	return def
}

func (l *loader) port(def int, keys ...string) int {
	v, ok := l.lookup(keys...)
	if !ok {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < 1 || n > 65535 {
		l.errs = append(l.errs, fmt.Errorf("%s must be a port number", keys[0]))
		return def
	}
	return n
}

func (l *loader) positiveInt(key string, def int) int {
	v, ok := l.lookup(key)
	if !ok {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < 1 {
		l.errs = append(l.errs, fmt.Errorf("%s must be a positive integer", key))
		return def
	}
	return n
}

func (l *loader) duration(key string, def time.Duration) time.Duration {
	v, ok := l.lookup(key)
	if !ok {
		return def
	}
	d, err := time.ParseDuration(v)
	if err != nil || d <= 0 {
		l.errs = append(l.errs, fmt.Errorf("%s must be a positive duration such as 5s", key))
		return def
	}
	return d
}

// primary parses DATABASE_URL, the same variable Prisma reads.
func (l *loader) primary() DB {
	raw := l.required("DATABASE_URL")
	db := DB{Port: 3306, Charset: "utf8mb4", MaxConns: l.positiveInt("BACKEND_PRIMARY_DB_MAX_CONNS", 10)}
	if raw == "" {
		return db
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "mysql" || u.Hostname() == "" || u.User == nil || strings.Trim(u.Path, "/") == "" {
		// The URL holds a password, so the message never echoes it.
		l.errs = append(l.errs, errors.New("DATABASE_URL must look like mysql://user:password@host:port/database"))
		return db
	}
	db.Host = u.Hostname()
	db.User = u.User.Username()
	db.Password, _ = u.User.Password()
	db.Name = strings.Trim(u.Path, "/")
	if p := u.Port(); p != "" {
		n, err := strconv.Atoi(p)
		if err != nil || n < 1 || n > 65535 {
			l.errs = append(l.errs, errors.New("DATABASE_URL has an invalid port"))
		} else {
			db.Port = n
		}
	}
	if cs := u.Query().Get("charset"); cs != "" {
		db.Charset = cs
	}
	return db
}
