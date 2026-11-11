package config

import "os"

type Config struct {
	Port              int
	DatabaseURL       string
	JWTSecret         string
	GoogleClientID    string
	GoogleSecret      string
	GitHubClientID    string
	GitHubSecret      string
	OAuthCallbackBase string
	SMTPHost          string
	SMTPPort          string
	SMTPUser          string
	SMTPPass          string
	SMTPFrom          string
}

func Load() *Config {
	port := 8080

	return &Config{
		Port:              port,
		DatabaseURL:       getEnv("DATABASE_URL", "postgres://localhost:5432/shellius?sslmode=disable"),
		JWTSecret:         getEnv("JWT_SECRET", "change-me-in-production"),
		GoogleClientID:    os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleSecret:      os.Getenv("GOOGLE_CLIENT_SECRET"),
		GitHubClientID:    os.Getenv("GITHUB_CLIENT_ID"),
		GitHubSecret:      os.Getenv("GITHUB_CLIENT_SECRET"),
		OAuthCallbackBase: getEnv("OAUTH_CALLBACK_BASE", "http://localhost:8080"),
		SMTPHost:          os.Getenv("SMTP_HOST"),
		SMTPPort:          getEnv("SMTP_PORT", "587"),
		SMTPUser:          os.Getenv("SMTP_USER"),
		SMTPPass:          os.Getenv("SMTP_PASS"),
		SMTPFrom:          getEnv("SMTP_FROM", "noreply@shellcat.kz"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
