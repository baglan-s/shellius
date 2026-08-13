package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/shellius/backend/internal/config"
	"github.com/shellius/backend/internal/server"
	"github.com/shellius/backend/internal/storage"
)

func main() {
	port := flag.Int("port", 9800, "WebSocket server port")
	dbPath := flag.String("db", "", "SQLite database path")
	flag.Parse()

	cfg := config.New(*port, *dbPath)

	db, err := storage.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	defer db.Close()

	srv := server.New(cfg, db)

	go func() {
		fmt.Printf("Shellius backend listening on :%d\n", cfg.Port)
		if err := srv.Start(); err != nil {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	fmt.Println("\nShutting down...")
	srv.Stop()
}
