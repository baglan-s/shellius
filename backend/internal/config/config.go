package config

import (
	"os"
	"path/filepath"
)

type Config struct {
	Port     int
	DBPath   string
	CloudURL string
}

func New(port int, dbPath string) *Config {
	if dbPath == "" {
		home, _ := os.UserHomeDir()
		dbPath = filepath.Join(home, ".shellius", "shellius.db")
	}

	cloudURL := os.Getenv("SHELLIUS_CLOUD_URL")
	if cloudURL == "" {
		cloudURL = "https://api.shellius.io"
	}

	return &Config{
		Port:     port,
		DBPath:   dbPath,
		CloudURL: cloudURL,
	}
}
