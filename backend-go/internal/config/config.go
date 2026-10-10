package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port                string
	GinMode             string
	HosxpHost           string
	HosxpPort           int
	HosxpUser           string
	HosxpPassword       string
	HosxpDatabase       string
	HosxpCharset        string
	MemberSessionSecret string
}

func LoadConfig() (*Config, error) {
	// Try loading .env from current dir, then parent dir
	_ = godotenv.Load(".env")
	parentEnv := filepath.Join("..", ".env")
	if _, err := os.Stat(parentEnv); err == nil {
		_ = godotenv.Load(parentEnv)
	}

	port := getEnv("PORT", "8080")
	ginMode := getEnv("GIN_MODE", "release")

	hosxpHost := getEnvFallback("HOSXP_DB_HOST", "APPOINT_DB_HOST", "ER_DB_HOST", "localhost")
	hosxpPortStr := getEnvFallback("HOSXP_DB_PORT", "APPOINT_DB_PORT", "ER_DB_PORT", "3306")
	hosxpPort, err := strconv.Atoi(hosxpPortStr)
	if err != nil {
		hosxpPort = 3306
	}

	hosxpUser := getEnvFallback("HOSXP_DB_USER", "APPOINT_DB_USER", "ER_DB_USER", "guest")
	hosxpPass := getEnvFallback("HOSXP_DB_PASSWORD", "APPOINT_DB_PASSWORD", "ER_DB_PASSWORD", "guest")
	hosxpDB := getEnvFallback("HOSXP_DB_NAME", "APPOINT_DB_NAME", "ER_DB_NAME", "hos")
	hosxpCharset := getEnvFallback("HOSXP_DB_CHARSET", "APPOINT_DB_CHARSET", "ER_DB_CHARSET", "utf8")

	secret := os.Getenv("MEMBER_SESSION_SECRET")

	return &Config{
		Port:                port,
		GinMode:             ginMode,
		HosxpHost:           hosxpHost,
		HosxpPort:           hosxpPort,
		HosxpUser:           hosxpUser,
		HosxpPassword:       hosxpPass,
		HosxpDatabase:       hosxpDB,
		HosxpCharset:        hosxpCharset,
		MemberSessionSecret: secret,
	}, nil
}

func (c *Config) HosxpDSN() string {
	// Standard MySQL DSN format with parseTime and location
	charset := c.HosxpCharset
	if charset == "" || charset == "tis620" {
		// When connecting from Go, utf8 allows MySQL server to transcode tis620 columns into utf8 transparently
		charset = "utf8"
	}
	return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=%s&parseTime=true&loc=Asia%%2FBangkok&interpolateParams=true",
		c.HosxpUser,
		c.HosxpPassword,
		c.HosxpHost,
		c.HosxpPort,
		c.HosxpDatabase,
		charset,
	)
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getEnvFallback(keys ...string) string {
	for i, key := range keys {
		if val := os.Getenv(key); val != "" {
			return val
		}
		if i == len(keys)-1 {
			return key // Last element is the default value
		}
	}
	return ""
}
