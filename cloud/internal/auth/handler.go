package auth

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/shellius/cloud/config"
	"github.com/shellius/cloud/internal/storage"
	"golang.org/x/crypto/bcrypt"
)

type oauthResult struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refresh_token"`
	Email        string `json:"email"`
	CreatedAt    time.Time
}

type Handler struct {
	db  *storage.Postgres
	jwt *JWTService
	cfg *config.Config

	oauthResults   map[string]*oauthResult
	oauthResultsMu sync.Mutex
}

func NewHandler(db *storage.Postgres, jwt *JWTService, cfg *config.Config) *Handler {
	return &Handler{db: db, jwt: jwt, cfg: cfg, oauthResults: make(map[string]*oauthResult)}
}

// StoreOAuthResult saves tokens for polling by the desktop app.
func (h *Handler) StoreOAuthResult(state, token, refreshToken, email string) {
	h.oauthResultsMu.Lock()
	h.oauthResults[state] = &oauthResult{
		Token: token, RefreshToken: refreshToken, Email: email,
		CreatedAt: time.Now(),
	}
	h.oauthResultsMu.Unlock()
}

// OAuthPoll is called by the desktop app to retrieve OAuth tokens after browser auth.
func (h *Handler) OAuthPoll(w http.ResponseWriter, r *http.Request) {
	state := r.URL.Query().Get("state")
	if state == "" {
		http.Error(w, "state required", http.StatusBadRequest)
		return
	}

	h.oauthResultsMu.Lock()
	result, ok := h.oauthResults[state]
	if ok {
		delete(h.oauthResults, state)
	}
	// Cleanup old entries
	for k, v := range h.oauthResults {
		if time.Since(v.CreatedAt) > 5*time.Minute {
			delete(h.oauthResults, k)
		}
	}
	h.oauthResultsMu.Unlock()

	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"pending"}`))
		return
	}

	writeJSON(w, map[string]string{
		"status":        "ok",
		"token":         result.Token,
		"refresh_token": result.RefreshToken,
		"email":         result.Email,
	})
}

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token        string  `json:"token"`
	RefreshToken string  `json:"refresh_token"`
	User         UserDTO `json:"user"`
}

type UserDTO struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type RefreshResponse struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refresh_token"`
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.Password == "" {
		http.Error(w, "email and password required", http.StatusBadRequest)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	user, err := h.db.CreateUser(req.Email, string(hash), "local")
	if err != nil {
		http.Error(w, "user already exists", http.StatusConflict)
		return
	}

	h.respondWithTokens(w, user)
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	user, err := h.db.GetUserByEmail(req.Email)
	if err != nil {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	h.respondWithTokens(w, user)
}

func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req RefreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	if req.RefreshToken == "" {
		http.Error(w, "refresh_token required", http.StatusBadRequest)
		return
	}

	// Hash the incoming token to look up in DB
	hashBytes := sha256.Sum256([]byte(req.RefreshToken))
	oldHash := hex.EncodeToString(hashBytes[:])

	rt, err := h.db.GetRefreshToken(oldHash)
	if err != nil {
		http.Error(w, "invalid refresh token", http.StatusUnauthorized)
		return
	}

	if time.Now().After(rt.ExpiresAt) {
		h.db.DeleteRefreshToken(oldHash)
		http.Error(w, "refresh token expired", http.StatusUnauthorized)
		return
	}

	// Delete old refresh token (rotation)
	h.db.DeleteRefreshToken(oldHash)

	// Get user
	user, err := h.db.GetUserByID(rt.UserID)
	if err != nil {
		http.Error(w, "user not found", http.StatusUnauthorized)
		return
	}

	// Generate new access + refresh tokens
	accessToken, err := h.jwt.Generate(user.ID, user.Email)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	newRaw, newHash, err := GenerateRefreshToken()
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if err := h.db.CreateRefreshToken(user.ID, newHash, time.Now().Add(30*24*time.Hour)); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, RefreshResponse{
		Token:        accessToken,
		RefreshToken: newRaw,
	})
}

func (h *Handler) respondWithTokens(w http.ResponseWriter, user *storage.User) {
	accessToken, err := h.jwt.Generate(user.ID, user.Email)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	rawRefresh, hashRefresh, err := GenerateRefreshToken()
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if err := h.db.CreateRefreshToken(user.ID, hashRefresh, time.Now().Add(30*24*time.Hour)); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, AuthResponse{
		Token:        accessToken,
		RefreshToken: rawRefresh,
		User:         UserDTO{ID: user.ID, Email: user.Email},
	})
}

func writeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}
