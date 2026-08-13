package server

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/shellius/backend/internal/config"
	"github.com/shellius/backend/internal/storage"
	"github.com/shellius/backend/pkg/protocol"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Electron connects locally
	},
}

type Server struct {
	cfg     *config.Config
	db      *storage.DB
	http    *http.Server
	sessMgr *SessionManager
}

func New(cfg *config.Config, db *storage.DB) *Server {
	s := &Server{
		cfg:     cfg,
		db:      db,
		sessMgr: NewSessionManager(db),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", s.handleWebSocket)
	mux.HandleFunc("/health", s.handleHealth)

	s.http = &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Port),
		Handler: mux,
	}

	return s
}

func (s *Server) Start() error {
	return s.http.ListenAndServe()
}

func (s *Server) Stop() {
	s.sessMgr.CloseAll()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	s.http.Shutdown(ctx)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("ok"))
}

func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("websocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	log.Println("WebSocket client connected")

	for {
		_, rawMsg, err := conn.ReadMessage()
		if err != nil {
			log.Printf("read error: %v", err)
			break
		}

		var msg protocol.Message
		if err := json.Unmarshal(rawMsg, &msg); err != nil {
			log.Printf("invalid message: %v", err)
			continue
		}

		log.Printf("received: type=%s id=%s session=%s", msg.Type, msg.ID, msg.SessionID)
		s.sessMgr.HandleMessage(conn, &msg)
	}

	log.Println("WebSocket client disconnected")
}
