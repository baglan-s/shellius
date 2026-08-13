package sync

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/shellius/cloud/internal/middleware"
	"github.com/shellius/cloud/internal/storage"
)

type Handler struct {
	db *storage.Postgres
}

func NewHandler(db *storage.Postgres) *Handler {
	return &Handler{db: db}
}

type PushRequest struct {
	Items []PushItem `json:"items"`
}

type PushItem struct {
	ID        string          `json:"id"`
	Type      string          `json:"type"`
	Data      json.RawMessage `json:"data"`
	Version   int             `json:"version"`
	UpdatedAt time.Time       `json:"updated_at"`
}

func (h *Handler) Push(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req PushRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	for _, item := range req.Items {
		syncItem := &storage.SyncItem{
			ID:        item.ID,
			UserID:    userID,
			ItemType:  item.Type,
			Data:      item.Data,
			Version:   item.Version,
			UpdatedAt: item.UpdatedAt,
		}
		if err := h.db.UpsertSyncItem(syncItem); err != nil {
			http.Error(w, "sync failed", http.StatusInternalServerError)
			return
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (h *Handler) Pull(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	sinceStr := r.URL.Query().Get("since")
	since := time.Time{}
	if sinceStr != "" {
		var err error
		since, err = time.Parse(time.RFC3339, sinceStr)
		if err != nil {
			http.Error(w, "invalid since parameter", http.StatusBadRequest)
			return
		}
	}

	items, err := h.db.GetSyncItems(userID, since)
	if err != nil {
		http.Error(w, "sync failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"items":    items,
		"has_more": false,
	})
}
