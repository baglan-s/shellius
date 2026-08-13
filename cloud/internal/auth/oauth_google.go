package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

func (h *Handler) googleOAuthConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     h.cfg.GoogleClientID,
		ClientSecret: h.cfg.GoogleSecret,
		RedirectURL:  h.cfg.OAuthCallbackBase + "/api/auth/oauth/google/callback",
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint:     google.Endpoint,
	}
}

func (h *Handler) OAuthGoogle(w http.ResponseWriter, r *http.Request) {
	cfg := h.googleOAuthConfig()
	url := cfg.AuthCodeURL("state", oauth2.AccessTypeOffline)
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

func (h *Handler) OAuthGoogleCallback(w http.ResponseWriter, r *http.Request) {
	cfg := h.googleOAuthConfig()
	code := r.URL.Query().Get("code")

	token, err := cfg.Exchange(context.Background(), code)
	if err != nil {
		http.Error(w, "oauth exchange failed", http.StatusBadRequest)
		return
	}

	client := cfg.Client(context.Background(), token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		http.Error(w, "failed to get user info", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	var userInfo struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		http.Error(w, "failed to decode user info", http.StatusInternalServerError)
		return
	}

	user, err := h.db.GetOrCreateOAuthUser(userInfo.Email, "google")
	if err != nil {
		http.Error(w, "failed to create user", http.StatusInternalServerError)
		return
	}

	jwtToken, err := h.jwt.Generate(user.ID, user.Email)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// Redirect to Electron app via deep link
	redirectURL := fmt.Sprintf("shellius://auth/callback?token=%s", jwtToken)
	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}
