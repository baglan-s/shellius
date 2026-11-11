package auth

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/smtp"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type ForgotPasswordRequest struct {
	Email string `json:"email"`
}

type ResetPasswordRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

func (h *Handler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req ForgotPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	// Always return OK to prevent email enumeration
	user, err := h.db.GetUserByEmail(req.Email)
	if err != nil {
		writeJSON(w, map[string]string{"status": "ok"})
		return
	}

	rawToken, tokenHash, err := GenerateRefreshToken()
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if err := h.db.CreatePasswordReset(user.ID, tokenHash, time.Now().Add(1*time.Hour)); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// Send email
	resetURL := fmt.Sprintf("%s/reset-password?token=%s", h.cfg.OAuthCallbackBase, rawToken)
	body := fmt.Sprintf("Subject: Shellius Password Reset\r\n"+
		"From: %s\r\n"+
		"To: %s\r\n"+
		"Content-Type: text/plain; charset=utf-8\r\n\r\n"+
		"Reset your password by visiting:\r\n%s\r\n\r\nThis link expires in 1 hour.\r\nIf you didn't request this, ignore this email.",
		h.cfg.SMTPFrom, req.Email, resetURL)

	if h.cfg.SMTPHost != "" {
		auth := smtp.PlainAuth("", h.cfg.SMTPUser, h.cfg.SMTPPass, h.cfg.SMTPHost)
		addr := fmt.Sprintf("%s:%s", h.cfg.SMTPHost, h.cfg.SMTPPort)
		smtp.SendMail(addr, auth, h.cfg.SMTPFrom, []string{req.Email}, []byte(body))
	}

	writeJSON(w, map[string]string{"status": "ok"})
}

func (h *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	if req.Token == "" || req.Password == "" {
		http.Error(w, "token and password required", http.StatusBadRequest)
		return
	}

	hashBytes := sha256.Sum256([]byte(req.Token))
	tokenHash := hex.EncodeToString(hashBytes[:])

	pr, err := h.db.GetPasswordReset(tokenHash)
	if err != nil || pr.Used {
		http.Error(w, "invalid or expired token", http.StatusBadRequest)
		return
	}

	if time.Now().After(pr.ExpiresAt) {
		http.Error(w, "token expired", http.StatusBadRequest)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if err := h.db.UpdatePassword(pr.UserID, string(hash)); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	h.db.MarkPasswordResetUsed(pr.ID)
	h.db.DeleteUserRefreshTokens(pr.UserID) // Invalidate all sessions

	writeJSON(w, map[string]string{"status": "password reset"})
}
