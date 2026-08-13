package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/shellius/cloud/config"
	"github.com/shellius/cloud/internal/auth"
	"github.com/shellius/cloud/internal/middleware"
	"github.com/shellius/cloud/internal/storage"
	cloudsync "github.com/shellius/cloud/internal/sync"
)

func main() {
	cfg := config.Load()

	db, err := storage.NewPostgres(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer db.Close()

	jwtService := auth.NewJWTService(cfg.JWTSecret)
	authHandler := auth.NewHandler(db, jwtService, cfg)
	syncHandler := cloudsync.NewHandler(db)
	authMiddleware := middleware.NewAuth(jwtService)

	mux := http.NewServeMux()

	// Auth routes
	mux.HandleFunc("POST /api/auth/register", authHandler.Register)
	mux.HandleFunc("POST /api/auth/login", authHandler.Login)
	mux.HandleFunc("GET /api/auth/oauth/google", authHandler.OAuthGoogle)
	mux.HandleFunc("GET /api/auth/oauth/google/callback", authHandler.OAuthGoogleCallback)
	mux.HandleFunc("GET /api/auth/oauth/github", authHandler.OAuthGitHub)
	mux.HandleFunc("GET /api/auth/oauth/github/callback", authHandler.OAuthGitHubCallback)

	// Protected routes
	mux.Handle("POST /api/sync/push", authMiddleware.Wrap(http.HandlerFunc(syncHandler.Push)))
	mux.Handle("GET /api/sync/pull", authMiddleware.Wrap(http.HandlerFunc(syncHandler.Pull)))

	// Health
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Port),
		Handler: mux,
	}

	go func() {
		fmt.Printf("Shellius cloud server listening on :%d\n", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	fmt.Println("\nShutting down...")
}
