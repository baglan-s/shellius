package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
)

func (h *Handler) githubOAuthConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     h.cfg.GitHubClientID,
		ClientSecret: h.cfg.GitHubSecret,
		RedirectURL:  h.cfg.OAuthCallbackBase + "/api/auth/oauth/github/callback",
		Scopes:       []string{"user:email"},
		Endpoint:     github.Endpoint,
	}
}

func (h *Handler) OAuthGitHub(w http.ResponseWriter, r *http.Request) {
	cfg := h.githubOAuthConfig()
	url := cfg.AuthCodeURL("state", oauth2.AccessTypeOffline)
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

func (h *Handler) OAuthGitHubCallback(w http.ResponseWriter, r *http.Request) {
	cfg := h.githubOAuthConfig()
	code := r.URL.Query().Get("code")

	token, err := cfg.Exchange(context.Background(), code)
	if err != nil {
		http.Error(w, "oauth exchange failed", http.StatusBadRequest)
		return
	}

	client := cfg.Client(context.Background(), token)
	resp, err := client.Get("https://api.github.com/user/emails")
	if err != nil {
		http.Error(w, "failed to get user emails", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	var emails []struct {
		Email   string `json:"email"`
		Primary bool   `json:"primary"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&emails); err != nil {
		http.Error(w, "failed to decode emails", http.StatusInternalServerError)
		return
	}

	var primaryEmail string
	for _, e := range emails {
		if e.Primary {
			primaryEmail = e.Email
			break
		}
	}
	if primaryEmail == "" && len(emails) > 0 {
		primaryEmail = emails[0].Email
	}

	user, err := h.db.GetOrCreateOAuthUser(primaryEmail, "github")
	if err != nil {
		http.Error(w, "failed to create user", http.StatusInternalServerError)
		return
	}

	jwtToken, err := h.jwt.Generate(user.ID, user.Email)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	redirectURL := fmt.Sprintf("shellius://auth/callback?token=%s", jwtToken)
	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}
