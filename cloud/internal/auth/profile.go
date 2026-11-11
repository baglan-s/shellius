package auth

import (
	"encoding/json"
	"net/http"
)

type ProfileResponse struct {
	ID           string `json:"id"`
	Email        string `json:"email"`
	AuthProvider string `json:"auth_provider"`
}

type UpdateProfileRequest struct {
	Email string `json:"email,omitempty"`
}

func (h *Handler) GetProfile(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromCtx(r)

	user, err := h.db.GetUserByID(userID)
	if err != nil {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}

	writeJSON(w, ProfileResponse{
		ID:           user.ID,
		Email:        user.Email,
		AuthProvider: user.AuthProvider,
	})
}

func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromCtx(r)

	var req UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	if req.Email != "" {
		if err := h.db.UpdateEmail(userID, req.Email); err != nil {
			http.Error(w, "email already taken", http.StatusConflict)
			return
		}
	}

	user, _ := h.db.GetUserByID(userID)
	writeJSON(w, ProfileResponse{
		ID:           user.ID,
		Email:        user.Email,
		AuthProvider: user.AuthProvider,
	})
}

// getUserIDFromCtx extracts user_id set by auth middleware (avoids import cycle)
func getUserIDFromCtx(r *http.Request) string {
	type contextKey string
	if id, ok := r.Context().Value(contextKey("user_id")).(string); ok {
		return id
	}
	return ""
}
